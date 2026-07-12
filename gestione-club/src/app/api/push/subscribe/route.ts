// src/app/api/push/subscribe/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type PushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Recupero utente autenticato
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          message: "Utente non autenticato.",
        },
        { status: 401 }
      );
    }

    // 2. Recupero profilo corrente
    // Il club attivo è SEMPRE last_club_id
    const { data: profilo, error: profiloError } = await supabase
      .from("profili")
      .select("id,last_club_id,last_squadra_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profiloError || !profilo) {
      console.error("Errore recupero profilo:", profiloError);

      return NextResponse.json(
        {
          success: false,
          message: "Profilo utente non trovato.",
        },
        { status: 404 }
      );
    }

    if (!profilo.last_club_id) {
      return NextResponse.json(
        {
          success: false,
          message: "Nessun club attivo selezionato.",
        },
        { status: 400 }
      );
    }

    // 3. Leggo la subscription inviata dal browser
    const body = (await request.json()) as PushSubscriptionInput;

    if (!body.endpoint) {
      return NextResponse.json(
        {
          success: false,
          message: "Endpoint push mancante.",
        },
        { status: 400 }
      );
    }

    if (!body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        {
          success: false,
          message: "Chiavi push mancanti.",
        },
        { status: 400 }
      );
    }

    // 4. Salvo / aggiorno la subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          profilo_id: profilo.id,
          club_id: profilo.last_club_id,
          squadra_id: profilo.last_squadra_id ?? null,

          endpoint: body.endpoint,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,

          expiration_time: body.expirationTime ?? null,
          user_agent: request.headers.get("user-agent"),

          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "profilo_id,endpoint",
        }
      )
      .select(
        `
          id,
          profilo_id,
          club_id,
          squadra_id,
          endpoint,
          created_at,
          updated_at
        `
      )
      .single();

    if (subscriptionError) {
      console.error(
        "Errore salvataggio push subscription:",
        subscriptionError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Errore durante il salvataggio della subscription.",
          error: subscriptionError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Dispositivo registrato correttamente.",
        subscription,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Errore API push subscribe:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Errore interno del server.",
      },
      { status: 500 }
    );
  }
}