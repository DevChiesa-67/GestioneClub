// src/app/api/push/send/route.ts

import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type SendPushBody = {
  comunicazione_id: string;
};

type WebPushSendError = Error & {
  statusCode?: number;
};

function isWebPushSendError(error: unknown): error is WebPushSendError {
  return error instanceof Error;
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
);

const CATEGORIA_TIPO_PROFILO: Record<string, string> = {
  giocatori: "giocatore",
  allenatori: "allenatore",
  preparatori: "preparatore",
};

function normalizza(valore: string) {
  return valore.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: "Utente non autenticato." },
        { status: 401 }
      );
    }

    const { data: profilo, error: profiloError } = await supabase
      .from("profili")
      .select("id,last_club_id,tipo_profilo")
      .eq("auth_user_id", user.id)
      .single();

    if (profiloError || !profilo?.last_club_id) {
      return NextResponse.json(
        { success: false, message: "Profilo o club attivo non trovato." },
        { status: 400 }
      );
    }

    if (String(profilo.tipo_profilo || "").toLowerCase() !== "admin") {
      return NextResponse.json(
        {
          success: false,
          message: "Solo un amministratore può inviare notifiche.",
        },
        { status: 403 }
      );
    }

    const clubId = profilo.last_club_id;

    /*
     * Da qui in poi operiamo per conto di TUTTI i destinatari del
     * club (inserimento notifiche altrui, lettura subscription push
     * altrui): serve il client service-role, perché le policy RLS
     * legano correttamente le scritture solo al proprio profilo.
     * L'autorizzazione è già stata verificata sopra (solo admin).
     */

    const body = (await request.json()) as SendPushBody;

    if (!body.comunicazione_id) {
      return NextResponse.json(
        { success: false, message: "comunicazione_id mancante." },
        { status: 400 }
      );
    }

    const { data: comunicazione, error: comunicazioneError } = await supabaseAdmin
      .from("comunicazioni")
      .select(
        `
        id,
        club_id,
        titolo,
        descrizione,
        destinatari_tipo,
        destinatari_profili
      `
      )
      .eq("id", body.comunicazione_id)
      .eq("club_id", clubId)
      .single();

    if (comunicazioneError || !comunicazione) {
      return NextResponse.json(
        { success: false, message: "Comunicazione non trovata." },
        { status: 404 }
      );
    }

    /*
     * Risoluzione destinatari:
     * - Se sono stati selezionati profili specifici (destinatari_profili),
     *   la comunicazione va solo a quegli utenti.
     * - "Tutti" -> tutti i profili del club.
     * - Altrimenti unione dei profili corrispondenti alle categorie
     *   selezionate (Giocatori -> tipo_profilo "giocatore", ecc.).
     */
    const destinatariProfiloIds = new Set<string>();

    if (
      Array.isArray(comunicazione.destinatari_profili) &&
      comunicazione.destinatari_profili.length > 0
    ) {
      for (const id of comunicazione.destinatari_profili) {
        if (typeof id === "string") destinatariProfiloIds.add(id);
      }
    } else {
      const categorie = Array.isArray(comunicazione.destinatari_tipo)
        ? comunicazione.destinatari_tipo.map(normalizza)
        : [];

      if (categorie.includes("tutti")) {
        const { data: profili } = await supabaseAdmin
          .from("profili")
          .select("id")
          .contains("club_id", [clubId]);

        profili?.forEach((p) => destinatariProfiloIds.add(p.id));
      } else {
        for (const categoria of categorie) {
          const tipoProfilo = CATEGORIA_TIPO_PROFILO[categoria];

          if (!tipoProfilo) continue;

          const { data: profiliPerTipo } = await supabaseAdmin
            .from("profili")
            .select("id")
            .contains("club_id", [clubId])
            .eq("tipo_profilo", tipoProfilo);

          profiliPerTipo?.forEach((p) => destinatariProfiloIds.add(p.id));
        }
      }
    }

    const profiloIds = Array.from(destinatariProfiloIds);

    if (profiloIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nessun destinatario trovato.",
        sent: 0,
      });
    }

    const titolo = comunicazione.titolo || "Nuova comunicazione";
    const messaggio =
      comunicazione.descrizione || "Hai ricevuto una nuova comunicazione.";
    const url = `/comunicazioni/${comunicazione.id}`;

    /*
     * Notifiche in-app: una riga per destinatario.
     */
    const { error: notificheError } = await supabaseAdmin.from("notifiche").insert(
      profiloIds.map((profiloId) => ({
        club_id: clubId,
        profilo_id: profiloId,
        titolo,
        messaggio,
        url,
      }))
    );

    if (notificheError) {
      console.error("Errore inserimento notifiche:", notificheError);
    }

    /*
     * Push browser: solo per chi ha una subscription attiva.
     */
    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id,profilo_id,endpoint,p256dh,auth")
      .eq("club_id", clubId)
      .in("profilo_id", profiloIds);

    if (subscriptionsError) {
      return NextResponse.json(
        {
          success: false,
          message: "Errore recupero dispositivi.",
          error: subscriptionsError.message,
        },
        { status: 500 }
      );
    }

    const payload = JSON.stringify({
      title: titolo,
      body: messaggio,
      url,
    });

    let sent = 0;
    let failed = 0;

    await Promise.all(
      (subscriptions ?? []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          );

          sent++;
        } catch (error: unknown) {
          failed++;

          if (
            isWebPushSendError(error) &&
            (error.statusCode === 404 || error.statusCode === 410)
          ) {
            await supabaseAdmin
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id)
              .eq("club_id", clubId);
          }

          console.error("Errore invio push:", error);
        }
      })
    );

    return NextResponse.json({
      success: true,
      sent,
      failed,
      destinatari: profiloIds.length,
      dispositivi: subscriptions?.length ?? 0,
    });
  } catch (error) {
    console.error("Errore API push send:", error);

    return NextResponse.json(
      { success: false, message: "Errore interno del server." },
      { status: 500 }
    );
  }
}
