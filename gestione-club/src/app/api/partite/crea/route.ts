import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!calendarId || !clientEmail || !privateKey) {
      return NextResponse.json(
        { error: "Variabili Google Calendar mancanti." },
        { status: 500 }
      );
    }

    const body = await req.json();

    const squadraCasaId = String(body.squadra_casa_id || "");
    const squadraFuoriId = String(body.squadra_fuori_id || "");
    const dataPartita = String(body.data_partita || "");
    const oraPartita = String(body.ora_partita || "");
    const luogo = String(body.luogo || "");
    const tipoPartita = String(body.tipo_partita || "campionato");

    if (!squadraCasaId || !squadraFuoriId || !dataPartita || !oraPartita) {
      return NextResponse.json(
        { error: "Compila squadre, data e ora partita." },
        { status: 400 }
      );
    }

    if (squadraCasaId === squadraFuoriId) {
      return NextResponse.json(
        { error: "Le due squadre devono essere diverse." },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Utente non autenticato." },
        { status: 401 }
      );
    }

    const { data: profilo, error: profiloError } = await supabase
      .from("profili")
      .select("last_club_id, last_squadra_id, tipo_profilo")
      .eq("auth_user_id", user.id)
      .single();

    if (profiloError || !profilo?.last_club_id) {
      return NextResponse.json(
        { error: "Nessun club attivo selezionato." },
        { status: 400 }
      );
    }

    if (String(profilo.tipo_profilo).toLowerCase() !== "admin") {
      return NextResponse.json(
        { error: "Solo gli admin possono creare partite." },
        { status: 403 }
      );
    }

    const { data: squadre, error: squadreError } = await supabase
      .from("squadre_partite")
      .select("id, nome")
      .eq("club_id", profilo.last_club_id)
      .in("id", [squadraCasaId, squadraFuoriId]);

    if (squadreError) {
      return NextResponse.json(
        { error: squadreError.message },
        { status: 500 }
      );
    }

    if (!squadre || squadre.length !== 2) {
      return NextResponse.json(
        { error: "Una o entrambe le squadre non appartengono al club attivo." },
        { status: 400 }
      );
    }

    const squadraCasa = squadre.find((s) => s.id === squadraCasaId);
    const squadraFuori = squadre.find((s) => s.id === squadraFuoriId);

    const { data: partita, error: insertError } = await supabase
      .from("partite")
      .insert({
        club_id: profilo.last_club_id,
        squadra_id: profilo.last_squadra_id,
        squadra_casa_id: squadraCasaId,
        squadra_fuori_id: squadraFuoriId,
        data_partita: dataPartita,
        ora_partita: oraPartita,
        luogo: luogo || null,
        tipo_partita: tipoPartita,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: partita,
      squadre: {
        casa: squadraCasa,
        fuori: squadraFuori,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Errore durante la creazione della partita.",
      },
      { status: 500 }
    );
  }
}