import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type Body = {
  message?: string;
  conversazione_id?: string | null;
};

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY non configurata." },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const supabase = await createClient();
    const body = (await req.json()) as Body;

    const message = String(body.message ?? "").trim();
    let conversazioneId = body.conversazione_id ?? null;

    if (!message) {
      return NextResponse.json(
        { error: "Messaggio obbligatorio." },
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
      .select("id,last_club_id,last_squadra_id,tipo_profilo")
      .eq("auth_user_id", user.id)
      .single();

    if (profiloError || !profilo) {
      return NextResponse.json(
        { error: "Profilo utente non trovato." },
        { status: 404 }
      );
    }

    if (!profilo.last_club_id) {
      return NextResponse.json(
        { error: "Nessun club attivo selezionato." },
        { status: 400 }
      );
    }

    const { data: club } = await supabase
      .from("club")
      .select("id,nome,colore_flag")
      .eq("id", profilo.last_club_id)
      .single();

    const { data: squadra } = profilo.last_squadra_id
      ? await supabase
          .from("squadre")
          .select("id,nome,categoria,stagione")
          .eq("id", profilo.last_squadra_id)
          .eq("club_id", profilo.last_club_id)
          .single()
      : { data: null };

    if (!conversazioneId) {
      const titolo =
        message.length > 45 ? `${message.slice(0, 45)}...` : message;

      const { data: nuovaConversazione, error: convError } = await supabase
        .from("ai_conversazioni")
        .insert({
          club_id: profilo.last_club_id,
          squadra_id: profilo.last_squadra_id,
          user_id: user.id,
          titolo,
          model: "claude-sonnet-4-5",
        })
        .select("id")
        .single();

      if (convError || !nuovaConversazione) {
        return NextResponse.json(
          { error: "Errore creazione conversazione AI." },
          { status: 500 }
        );
      }

      conversazioneId = nuovaConversazione.id;
    }

    const { data: messaggiPrecedenti } = await supabase
      .from("ai_messaggi")
      .select("ruolo,contenuto")
      .eq("conversazione_id", conversazioneId)
      .eq("club_id", profilo.last_club_id)
      .order("created_at", { ascending: true })
      .limit(12);

    await supabase.from("ai_messaggi").insert({
      conversazione_id: conversazioneId,
      club_id: profilo.last_club_id,
      squadra_id: profilo.last_squadra_id,
      user_id: user.id,
      ruolo: "user",
      contenuto: message,
    });

    const messages: Anthropic.Messages.MessageParam[] = [
  ...(messaggiPrecedenti ?? []).map((m): Anthropic.Messages.MessageParam => ({
    role: m.ruolo === "assistant" ? "assistant" : "user",
    content: String(m.contenuto ?? ""),
  })),
  {
    role: "user" as const,
    content: message,
  },
];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      system: `
Sei l'assistente AI del gestionale sportivo "Fabio - Gestione Club".

Regole obbligatorie:
- Rispetta sempre il contesto multi-club.
- Usa sempre il club attivo tramite profili.last_club_id.
- Usa la squadra attiva tramite profili.last_squadra_id quando rilevante.
- Non inventare dati.
- Se un dato non è disponibile nel contesto fornito, dillo chiaramente.
- Non suggerire query globali senza filtro club_id.
- Quando proponi codice UI, usa il branding dinamico del club tramite club.colore_flag.

Contesto:
- User ID: ${user.id}
- Tipo profilo: ${profilo.tipo_profilo ?? "non definito"}
- Club ID: ${profilo.last_club_id}
- Club nome: ${club?.nome ?? "non disponibile"}
- Club colore_flag: ${club?.colore_flag ?? "non disponibile"}
- Squadra ID: ${profilo.last_squadra_id ?? "nessuna"}
- Squadra nome: ${squadra?.nome ?? "nessuna"}
- Categoria: ${squadra?.categoria ?? "non disponibile"}
- Stagione: ${squadra?.stagione ?? "non disponibile"}
      `.trim(),
      messages,
    });

    const text =
      response.content.find((block) => block.type === "text")?.text ?? "";

    await supabase.from("ai_messaggi").insert({
      conversazione_id: conversazioneId,
      club_id: profilo.last_club_id,
      squadra_id: profilo.last_squadra_id,
      user_id: user.id,
      ruolo: "assistant",
      contenuto: text,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    });

    await supabase
      .from("ai_conversazioni")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversazioneId)
      .eq("club_id", profilo.last_club_id);

    return NextResponse.json({
      conversazione_id: conversazioneId,
      text,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error("Errore Claude API:", error);

    return NextResponse.json(
      { error: "Errore durante la richiesta a Claude." },
      { status: 500 }
    );
  }
}