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

// Rimuove QUALSIASI spazio/a-capo (non solo ai bordi: .trim() da solo non
// basta se il valore ha un a-capo interno, es. incollato da un pannello di
// hosting o da un terminale che ha "spezzato" la riga). Un valore VAPID
// "sporco" produce un header Authorization non valido e fa fallire l'intera
// build già in fase di "Collecting page data" con un poco chiaro
// "Headers.append: ... is an invalid header value".
const rimuoviSpazi = (valore: string) => valore.replace(/\s+/g, "");

const vapidSubject = rimuoviSpazi(
  process.env.VAPID_SUBJECT ?? "mailto:admin@example.com"
);
const vapidPublicKey = rimuoviSpazi(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "");
const vapidPrivateKey = rimuoviSpazi(process.env.VAPID_PRIVATE_KEY ?? "");

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

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
      .select("id,last_club_id,club_id,tipo_profilo")
      .eq("auth_user_id", user.id)
      .single();

    /*
     * "Club attivo" per la richiesta: preferiamo last_club_id, ma
     * ripieghiamo sul primo club della lista (club_id, array per i
     * profili multi-club) se last_club_id non è ancora impostato.
     * Stessa logica usata lato client (ComunicazioniClient): tenerle
     * allineate evita che qui si consideri "attivo" un club diverso
     * da quello effettivamente usato al momento della creazione.
     */
    const clubIdAttivo =
      profilo?.last_club_id ??
      (Array.isArray(profilo?.club_id) ? profilo.club_id[0] : null) ??
      null;

    if (profiloError || !profilo || !clubIdAttivo) {
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

    /*
     * La comunicazione viene cercata SOLO per id (non filtrando già
     * per club): filtrare subito per il "club attivo" dell'admin
     * mascherava con un fuorviante "Comunicazione non trovata" ogni
     * caso in cui last_club_id fosse anche solo momentaneamente
     * disallineato rispetto al club_id con cui la riga era stata
     * creata (es. cambio squadra/club tra la creazione e l'invio,
     * più tab aperte, ecc.). Il controllo di appartenenza al club
     * viene fatto subito dopo, con un messaggio esplicito.
     */
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
      .single();

    if (comunicazioneError || !comunicazione) {
      return NextResponse.json(
        { success: false, message: "Comunicazione non trovata." },
        { status: 404 }
      );
    }

    const clubDelProfilo = Array.isArray(profilo.club_id) ? profilo.club_id : [];

    const appartieneAlClub =
      comunicazione.club_id === clubIdAttivo ||
      clubDelProfilo.includes(comunicazione.club_id);

    if (!appartieneAlClub) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Non hai i permessi per inviare notifiche per questa comunicazione (club diverso da quello attivo).",
        },
        { status: 403 }
      );
    }

    /*
     * Usiamo il club_id effettivo della comunicazione (non quello
     * "attivo" dell'admin) per risolvere destinatari e subscription:
     * è il dato autorevole, non soggetto a disallineamenti di stato.
     */
    const clubId = comunicazione.club_id;

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
     *
     * Filtriamo solo per profilo_id (già scoperto/scoperto sopra in
     * base al club corretto), NON anche per club_id: la subscription
     * salvata su un dispositivo riflette il club che era "attivo" nel
     * browser al momento della registrazione, che può disallinearsi
     * da quello con cui viene creata una comunicazione (stesso tipo di
     * problema del controllo sopra su "Comunicazione non trovata").
     * Un profilo appartiene comunque in modo univoco ai destinatari
     * già filtrati per club, quindi il filtro extra è ridondante e,
     * come visto, può far perdere dispositivi validi.
     */
    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id,profilo_id,endpoint,p256dh,auth")
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
              .eq("id", sub.id);
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
