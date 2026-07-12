import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Utente autenticato
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Utente non autenticato" },
        { status: 401 }
      );
    }

    // 2. Recupero profilo e club attivo
    const { data: profilo, error: profiloError } = await supabase
      .from("profili")
      .select("id,last_club_id")
      .eq("auth_user_id", user.id)
      .single();

    if (profiloError || !profilo?.last_club_id) {
      return NextResponse.json(
        { error: "Club attivo non trovato" },
        { status: 404 }
      );
    }

    // 3. Recupero club attivo
    const { data: club, error: clubError } = await supabase
      .from("club")
      .select(`
        id,
        nome,
        logo_url
      `)
      .eq("id", profilo.last_club_id)
      .single();

    if (clubError || !club) {
      console.error("Errore recupero club:", clubError);

      return NextResponse.json(
        { error: "Club non trovato" },
        { status: 404 }
      );
    }

    if (!club.logo_url) {
      return NextResponse.json(
        { error: "Logo club non disponibile" },
        { status: 404 }
      );
    }

    // 4. Dimensione richiesta
    const sizeParam = request.nextUrl.searchParams.get("size");

    const size = sizeParam === "512" ? 512 : 192;

    // 5. Recupero immagine
    const imageResponse = await fetch(club.logo_url, {
      cache: "no-store",
    });

    if (!imageResponse.ok) {
      console.error(
        "Errore download logo:",
        imageResponse.status,
        imageResponse.statusText
      );

      return NextResponse.json(
        { error: "Impossibile recuperare il logo" },
        { status: 502 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    const contentType =
      imageResponse.headers.get("content-type") ?? "image/png";

    // 6. Restituzione immagine
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,

        // Il club può cambiare, quindi evitiamo cache lunga
        "Cache-Control": "private, no-store, max-age=0",

        // Informativo
        "X-PWA-Icon-Size": String(size),
      },
    });
  } catch (error) {
    console.error("Errore API icona PWA:", error);

    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}