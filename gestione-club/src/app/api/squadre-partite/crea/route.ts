import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const formData = await req.formData();

    const nome = String(formData.get("nome") || "").trim();
    const abbreviazione = String(formData.get("abbreviazione") || "").trim();
    const colore_1 = String(formData.get("colore_1") || "").trim();
    const colore_2 = String(formData.get("colore_2") || "").trim();
    const logo = formData.get("logo") as File | null;

    if (!nome) {
      return NextResponse.json(
        { error: "Nome squadra obbligatorio." },
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
      .select("last_club_id,last_squadra_id, tipo_profilo")
      .eq("auth_user_id", user.id)
      .single();

    if (profiloError || !profilo?.last_club_id) {
      return NextResponse.json(
        { error: "Nessun club attivo selezionato." },
        { status: 400 }
      );
    }

    const ruolo = String(profilo.tipo_profilo || "").toLowerCase();

    if (ruolo !== "admin") {
      return NextResponse.json(
        { error: "Solo gli ADMIN possono creare squadre." },
        { status: 403 }
      );
    }

    let logo_path: string | null = null;

    if (logo && logo.size > 0) {
      const ext = logo.name.split(".").pop() || "png";
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const path = `${profilo.last_club_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("loghi-squadre")
        .upload(path, logo, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: uploadError.message },
          { status: 500 }
        );
      }

      logo_path = path;
    }

    const { data, error } = await supabase
      .from("squadre_partite")
      .insert({
        club_id: profilo.last_club_id,
        squadra_id: profilo.last_squadra_id,
        nome,
        abbreviazione: abbreviazione || null,
        logo_path,
        colore_1: colore_1 || null,
        colore_2: colore_2 || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Errore durante la creazione della squadra.",
      },
      { status: 500 }
    );
  }
}