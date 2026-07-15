// src/app/(dashboard)/misurazioni/page.tsx

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import MisurazioniAdminClient from "@/components/misurazioni/MisurazioniAdminClient";
import MisurazioniGiocatoreClient from "@/components/misurazioni/MisurazioniGiocatoreClient";

export type GiocatoreMisurazioni = {
  id: string;
  id_atleta: string | null;
  nome: string;
  cognome: string;
  foto_url: string | null;
  squadra_id: string | null;
};

export type MisurazioneAntropometrica = {
  id: string;
  giocatore_id: string;
  data_misurazione: string;
  peso_kg: number | null;
  altezza_cm: number | null;
  bmi: number | null;
  massa_grassa_percentuale: number | null;
  massa_magra_kg: number | null;
  circonferenza_vita_cm: number | null;
  note: string | null;
  created_at: string;
  giocatore: {
    id: string;
    id_atleta: string | null;
    nome: string;
    cognome: string;
    foto_url: string | null;
  } | null;
};

export type MisurazionePostAllenamento = {
  id: string;
  data_compilazione: string;
  umore: number;
  qualita_sonno: number | null;
  dolore_presente: boolean;
  zona_dolore: string | null;
  created_at: string;
};

export default async function MisurazioniPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profilo, error: profiloError } = await supabase
    .from("profili")
    .select("id, tipo_profilo, last_club_id, last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (profiloError || !profilo) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          Profilo non trovato.
        </div>
      </div>
    );
  }

  if (!profilo.last_club_id) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
          Seleziona prima un club.
        </div>
      </div>
    );
  }

  const { data: club } = await supabase
    .from("club")
    .select("id, nome, colore_flag")
    .eq("id", profilo.last_club_id)
    .single();

  const coloreClub = club?.colore_flag || "#2563eb";
  const tipoProfilo = String(profilo.tipo_profilo || "").toLowerCase();

  /*
   * ADMIN
   */
  if (tipoProfilo === "admin") {
    let giocatoriQuery = supabase
      .from("giocatori")
      .select("id, id_atleta, nome, cognome, foto_url, squadra_id")
      .eq("club_id", profilo.last_club_id)
      .eq("attivo", true)
      .order("cognome", { ascending: true })
      .order("nome", { ascending: true });

    let misurazioniQuery = supabase
      .from("misurazioni_antropometriche")
      .select(`
        id,
        giocatore_id,
        data_misurazione,
        peso_kg,
        altezza_cm,
        bmi,
        massa_grassa_percentuale,
        massa_magra_kg,
        circonferenza_vita_cm,
        note,
        created_at,
        giocatore:giocatori (
          id,
          id_atleta,
          nome,
          cognome,
          foto_url
        )
      `)
      .eq("club_id", profilo.last_club_id)
      .order("data_misurazione", { ascending: false })
      .order("created_at", { ascending: false });

    if (profilo.last_squadra_id) {
      giocatoriQuery = giocatoriQuery.eq(
        "squadra_id",
        profilo.last_squadra_id,
      );

      misurazioniQuery = misurazioniQuery.eq(
        "squadra_id",
        profilo.last_squadra_id,
      );
    }

    const [
      { data: giocatori, error: giocatoriError },
      { data: misurazioni, error: misurazioniError },
    ] = await Promise.all([giocatoriQuery, misurazioniQuery]);

    if (giocatoriError || misurazioniError) {
      console.error("Errore caricamento misurazioni admin", {
        giocatoriError,
        misurazioniError,
      });
    }

    return (
      <MisurazioniAdminClient
        coloreClub={coloreClub}
        nomeClub={club?.nome || "Club"}
        giocatori={(giocatori || []) as GiocatoreMisurazioni[]}
        misurazioni={
          (misurazioni || []) as unknown as MisurazioneAntropometrica[]
        }
      />
    );
  }

  /*
   * GIOCATORE
   */
  if (tipoProfilo === "giocatore") {
    let giocatoreQuery = supabase
      .from("giocatori")
      .select(
        "id, id_atleta, nome, cognome, foto_url, club_id, squadra_id",
      )
      .eq("id_atleta", profilo.id)
      .eq("club_id", profilo.last_club_id);

    if (profilo.last_squadra_id) {
      giocatoreQuery = giocatoreQuery.eq(
        "squadra_id",
        profilo.last_squadra_id,
      );
    }

    const { data: giocatore, error: giocatoreError } =
      await giocatoreQuery.maybeSingle();

    if (giocatoreError) {
      console.error(
        "Errore caricamento giocatore:",
        giocatoreError,
      );
    }

    if (!giocatore) {
      return (
        <div className="p-4 sm:p-6">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            Il tuo profilo non è ancora collegato a un giocatore della
            squadra attiva.
          </div>
        </div>
      );
    }

    const [
      { data: antropometria, error: antropometriaError },
      { data: postAllenamento, error: postAllenamentoError },
    ] = await Promise.all([
      supabase
        .from("misurazioni_antropometriche")
        .select(`
          id,
          giocatore_id,
          data_misurazione,
          peso_kg,
          altezza_cm,
          bmi,
          massa_grassa_percentuale,
          massa_magra_kg,
          circonferenza_vita_cm,
          note,
          created_at
        `)
        .eq("club_id", profilo.last_club_id)
        .eq("giocatore_id", giocatore.id)
        .order("data_misurazione", { ascending: false }),

      supabase
        .from("misurazioni_post_allenamento")
        .select(`
          id,
          data_compilazione,
          umore,
          qualita_sonno,
          dolore_presente,
          zona_dolore,
          created_at
        `)
        .eq("club_id", profilo.last_club_id)
        .eq("giocatore_id", giocatore.id)
        .order("data_compilazione", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (antropometriaError || postAllenamentoError) {
      console.error("Errore caricamento misurazioni giocatore", {
        antropometriaError,
        postAllenamentoError,
      });
    }

    const antropometriaNormalizzata =
      (antropometria || []).map((misurazione) => ({
        ...misurazione,
        giocatore: {
          id: giocatore.id,
          id_atleta: giocatore.id_atleta,
          nome: giocatore.nome,
          cognome: giocatore.cognome,
          foto_url: giocatore.foto_url,
        },
      })) as MisurazioneAntropometrica[];

    return (
      <MisurazioniGiocatoreClient
        coloreClub={coloreClub}
        giocatore={{
          id: giocatore.id,
          id_atleta: giocatore.id_atleta,
          nome: giocatore.nome,
          cognome: giocatore.cognome,
          foto_url: giocatore.foto_url,
          squadra_id: giocatore.squadra_id,
        }}
        antropometria={antropometriaNormalizzata}
        postAllenamento={
          (postAllenamento || []) as MisurazionePostAllenamento[]
        }
      />
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
        Non hai i permessi per visualizzare questa pagina.
      </div>
    </div>
  );
}