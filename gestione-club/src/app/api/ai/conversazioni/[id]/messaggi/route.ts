import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Utente non autenticato." },
      { status: 401 }
    );
  }

  const { data: profilo } = await supabase
    .from("profili")
    .select("last_club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("ai_messaggi")
    .select("id,ruolo,contenuto,input_tokens,output_tokens,created_at")
    .eq("conversazione_id", id)
    .eq("club_id", profilo.last_club_id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Errore caricamento messaggi." },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}