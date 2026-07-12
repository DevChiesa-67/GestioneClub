import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
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
    .from("ai_conversazioni")
    .select("id,titolo,created_at,updated_at")
    .eq("club_id", profilo.last_club_id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Errore caricamento conversazioni." },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}