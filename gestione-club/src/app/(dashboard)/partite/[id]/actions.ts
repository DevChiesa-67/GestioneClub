"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

type SalvaStatisticheInput = {
  partita_id: string;
  punti_fatti: number;
  punti_subiti: number;
  mete_fatte: number;
  mete_subite: number;
  // ex calci_fatti / calci_subiti: contenevano le trasformazioni.
  trasformazioni_fatte: number;
  trasformazioni_subite: number;
  calci_piazzati_totali: number;
  calci_piazzati_fatti: number;
  ammonizioni: number;
  espulsioni: number;
  punti_incontro_vinti: number;
  punti_incontro_persi: number;
  touche_vinte: number;
  touche_perse: number;
  touche_totali: number;
  mischie_vinte: number;
  mischie_perse: number;
  mischie_totali: number;
  placcaggi_efficaci: number;
  placcaggi_non_efficaci: number;
  note?: string | null;
};

type ModificaDettagliInput = {
  partita_id: string;
  squadra_casa_id: string;
  squadra_fuori_id: string;
  data_partita: string;
  ora_partita: string;
  luogo?: string | null;
  tipo_partita: string;
  note?: string | null;
};

type ConvocazioneInput = {
  giocatore_id: string;
  convocato: boolean;
  titolare: boolean;
  capitano: boolean;
  vicecapitano?: boolean;
  posizione:
    | "pilone_sx"
    | "tallonatore"
    | "pilone_dx"
    | "seconda_linea_sx"
    | "seconda_linea_dx"
    | "terza_linea_sx"
    | "terza_linea_dx"
    | "numero_8"
    | "mediano_mischia"
    | "mediano_apertura"
    | "ala_sx"
    | "primo_centro"
    | "secondo_centro"
    | "ala_dx"
    | "estremo"
    | "panchina";
  numero_maglia: number | null;
  ordine: number | null;
  ruolo_panchina?: string | null;
  note?: string | null;
};

async function getContestoUtente() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo, error } = await supabase
    .from("profili")
    .select("id,tipo_profilo,last_club_id,last_squadra_id")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !profilo?.last_club_id) {
    throw new Error("Nessun club attivo selezionato.");
  }

  if (String(profilo.tipo_profilo || "").toLowerCase() !== "admin") {
    throw new Error("Non hai i permessi per modificare questa partita.");
  }

  return {
    supabase,
    user,
    profilo,
    clubId: profilo.last_club_id as string,
    squadraId: profilo.last_squadra_id as string | null,
  };
}

export async function salvaStatistichePartita(input: SalvaStatisticheInput) {
  const { supabase, user, clubId } = await getContestoUtente();

  const { data: partita, error: partitaError } = await supabase
    .from("partite")
    .select("id,club_id,squadra_id")
    .eq("id", input.partita_id)
    .eq("club_id", clubId)
    .single();

  if (partitaError || !partita) {
    throw new Error("Partita non trovata.");
  }

  const risultato = `${input.punti_fatti}-${input.punti_subiti}`;

  const { error: statisticheError } = await supabase
    .from("partite_statistiche")
    .upsert(
      {
        club_id: clubId,
        squadra_id: partita.squadra_id,
        partita_id: partita.id,
        punti_fatti: input.punti_fatti,
        punti_subiti: input.punti_subiti,
        mete_fatte: input.mete_fatte,
        mete_subite: input.mete_subite,
        trasformazioni_fatte: input.trasformazioni_fatte,
        trasformazioni_subite: input.trasformazioni_subite,
        calci_piazzati_totali: input.calci_piazzati_totali,
        calci_piazzati_fatti: input.calci_piazzati_fatti,
        ammonizioni: input.ammonizioni,
        espulsioni: input.espulsioni,
        punti_incontro_vinti: input.punti_incontro_vinti,
        punti_incontro_persi: input.punti_incontro_persi,
        touche_vinte: input.touche_vinte,
        touche_perse: input.touche_perse,
        touche_totali: input.touche_totali,
        mischie_vinte: input.mischie_vinte,
        mischie_perse: input.mischie_perse,
        mischie_totali: input.mischie_totali,
        placcaggi_efficaci: input.placcaggi_efficaci,
        placcaggi_non_efficaci: input.placcaggi_non_efficaci,
        note: input.note ?? null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "partita_id",
      }
    );

  if (statisticheError) {
    throw new Error(statisticheError.message);
  }

  const { error: partitaUpdateError } = await supabase
    .from("partite")
    .update({
      punti_fatti: input.punti_fatti,
      punti_subiti: input.punti_subiti,
      risultato,
      stato_partita: "giocata",
    })
    .eq("id", partita.id)
    .eq("club_id", clubId);

  if (partitaUpdateError) {
    throw new Error(partitaUpdateError.message);
  }

  revalidatePath(`/partite/${input.partita_id}`);
  revalidatePath("/partite");
}

export async function salvaConvocazioniPartita(
  partitaId: string,
  convocazioni: ConvocazioneInput[]
) {
  const { supabase, user, clubId } = await getContestoUtente();

  const { data: partita, error: partitaError } = await supabase
    .from("partite")
    .select("id,club_id,squadra_id")
    .eq("id", partitaId)
    .eq("club_id", clubId)
    .single();

  if (partitaError || !partita) {
    throw new Error("Partita non trovata.");
  }

  /*
   * Il client manda l'intera rosa: i convocati vengono salvati, i non
   * convocati vengono RIMOSSI. Senza la rimozione, togliere un giocatore
   * da una convocazione gia' salvata non aveva effetto, perche' l'upsert
   * aggiorna solo le righe che riceve e non sa nulla di quelle sparite.
   */
  const daConvocare = convocazioni.filter(
    (convocazione) => convocazione.convocato
  );

  const daRimuovere = convocazioni
    .filter((convocazione) => !convocazione.convocato)
    .map((convocazione) => convocazione.giocatore_id);

  /*
   * Controllo dei numeri di maglia PRIMA di scrivere qualsiasi cosa.
   * Sul database esiste il vincolo partite_convocazioni_unique_numero
   * (un numero non puo' essere usato da due giocatori nella stessa
   * partita): senza questo controllo l'utente vedeva il messaggio grezzo
   * di Postgres, che non dice ne' quale numero ne' chi lo condivide.
   */
  const numeriUsati = new Map<number, string[]>();

  for (const convocazione of daConvocare) {
    const numero = convocazione.numero_maglia;

    if (numero === null || numero === undefined) continue;

    const elenco = numeriUsati.get(numero) ?? [];
    elenco.push(convocazione.giocatore_id);
    numeriUsati.set(numero, elenco);
  }

  const numeriDuplicati = Array.from(numeriUsati.entries()).filter(
    ([, giocatoriIds]) => giocatoriIds.length > 1
  );

  if (numeriDuplicati.length > 0) {
    const idCoinvolti = Array.from(
      new Set(numeriDuplicati.flatMap(([, giocatoriIds]) => giocatoriIds))
    );

    const { data: anagrafiche } = await supabase
      .from("giocatori")
      .select("id, nome, cognome")
      .in("id", idCoinvolti);

    const nomePerId = new Map<string, string>(
      (anagrafiche ?? []).map((giocatore) => [
        giocatore.id as string,
        `${giocatore.cognome ?? ""} ${giocatore.nome ?? ""}`.trim() ||
          "giocatore senza nome",
      ])
    );

    const dettagli = numeriDuplicati
      .map(
        ([numero, giocatoriIds]) =>
          `il numero ${numero} è assegnato a ${giocatoriIds
            .map((id) => nomePerId.get(id) ?? "giocatore sconosciuto")
            .join(" e ")}`
      )
      .join("; ");

    throw new Error(
      `Numeri di maglia duplicati: ${dettagli}. In una partita ogni numero può appartenere a un solo giocatore: correggi i numeri e riprova.`
    );
  }

  if (daRimuovere.length > 0) {
    const { error: rimozioneError } = await supabase
      .from("partite_convocazioni")
      .delete()
      .eq("partita_id", partita.id)
      .eq("club_id", clubId)
      .in("giocatore_id", daRimuovere);

    if (rimozioneError) {
      throw new Error(rimozioneError.message);
    }
  }

  const righe = daConvocare.map((convocazione) => ({
    club_id: clubId,
    squadra_id: partita.squadra_id,
    partita_id: partita.id,
    giocatore_id: convocazione.giocatore_id,
    convocato: convocazione.convocato,
    titolare: convocazione.titolare,
    capitano: convocazione.capitano,
    vicecapitano: convocazione.vicecapitano ?? false,
    posizione: convocazione.posizione,
    numero_maglia: convocazione.numero_maglia,
    ordine: convocazione.ordine,
    ruolo_panchina: convocazione.ruolo_panchina ?? null,
    note: convocazione.note ?? null,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  }));

  if (righe.length > 0) {
    /*
     * I numeri di maglia gia' salvati vengono azzerati PRIMA dell'upsert.
     *
     * Il vincolo partite_convocazioni_unique_numero viene verificato riga
     * per riga durante l'INSERT ... ON CONFLICT: scambiare due numeri fra
     * giocatori gia' salvati (il 10 passa a chi aveva il 12 e viceversa)
     * lo faceva scattare sul valore "vecchio" dell'altro giocatore, che
     * in quell'istante esiste ancora. Il risultato era che una formazione
     * salvata non si poteva piu' riordinare.
     *
     * Liberando prima tutti i numeri della partita, l'upsert li riassegna
     * su un insieme vuoto e nessuna collisione temporanea e' possibile.
     * I duplicati veri sono gia' stati intercettati sopra.
     */
    const { error: liberaNumeriError } = await supabase
      .from("partite_convocazioni")
      .update({ numero_maglia: null })
      .eq("partita_id", partita.id)
      .eq("club_id", clubId)
      .not("numero_maglia", "is", null);

    if (liberaNumeriError) {
      throw new Error(liberaNumeriError.message);
    }

    const { error } = await supabase
      .from("partite_convocazioni")
      .upsert(righe, {
        onConflict: "partita_id,giocatore_id",
      });

    if (error) {
      /*
       * Rete di sicurezza: se il vincolo scatta comunque (dati gia'
       * incoerenti sul database, o un numero ripetuto arrivato da un
       * percorso diverso), almeno il messaggio spiega il problema.
       */
      if (error.message.includes("partite_convocazioni_unique_numero")) {
        throw new Error(
          "Due giocatori hanno lo stesso numero di maglia in questa partita. Controlla i numeri della formazione e della panchina e riprova."
        );
      }

      throw new Error(error.message);
    }
  }

  await supabase
    .from("partite")
    .update({
      stato_partita: "convocazioni",
    })
    .eq("id", partita.id)
    .eq("club_id", clubId);

  revalidatePath(`/partite/${partitaId}`);
  revalidatePath("/partite");
}

export async function eliminaPartita(partitaId: string) {
  const { supabase, clubId } = await getContestoUtente();

  const { data: partita, error: partitaError } = await supabase
    .from("partite")
    .select("id,club_id")
    .eq("id", partitaId)
    .eq("club_id", clubId)
    .single();

  if (partitaError || !partita) {
    throw new Error("Partita non trovata.");
  }

  const { error: convocazioniError } = await supabase
    .from("partite_convocazioni")
    .delete()
    .eq("partita_id", partitaId)
    .eq("club_id", clubId);

  if (convocazioniError) {
    throw new Error(convocazioniError.message);
  }

  const { error: statisticheError } = await supabase
    .from("partite_statistiche")
    .delete()
    .eq("partita_id", partitaId)
    .eq("club_id", clubId);

  if (statisticheError) {
    throw new Error(statisticheError.message);
  }

  const { error: partitaDeleteError } = await supabase
    .from("partite")
    .delete()
    .eq("id", partitaId)
    .eq("club_id", clubId);

  if (partitaDeleteError) {
    throw new Error(partitaDeleteError.message);
  }

  revalidatePath("/partite");
}

export async function modificaDettagliPartita(input: ModificaDettagliInput) {
  const { supabase, clubId } = await getContestoUtente();

  if (!input.squadra_casa_id || !input.squadra_fuori_id) {
    throw new Error("Seleziona entrambe le squadre.");
  }

  if (input.squadra_casa_id === input.squadra_fuori_id) {
    throw new Error("Le due squadre devono essere diverse.");
  }

  if (!input.data_partita || !input.ora_partita) {
    throw new Error("Inserisci data e ora della partita.");
  }

  const { data: partita, error: partitaError } = await supabase
    .from("partite")
    .select("id,club_id")
    .eq("id", input.partita_id)
    .eq("club_id", clubId)
    .single();

  if (partitaError || !partita) {
    throw new Error("Partita non trovata.");
  }

  const { data: squadre, error: squadreError } = await supabase
    .from("squadre_partite")
    .select("id")
    .eq("club_id", clubId)
    .in("id", [input.squadra_casa_id, input.squadra_fuori_id]);

  if (squadreError) {
    throw new Error(squadreError.message);
  }

  if (!squadre || squadre.length !== 2) {
    throw new Error(
      "Una o entrambe le squadre non appartengono al club attivo."
    );
  }

  const { error: updateError } = await supabase
    .from("partite")
    .update({
      squadra_casa_id: input.squadra_casa_id,
      squadra_fuori_id: input.squadra_fuori_id,
      data_partita: input.data_partita,
      ora_partita: input.ora_partita,
      luogo: input.luogo?.trim() || null,
      tipo_partita: input.tipo_partita,
      note: input.note?.trim() || null,
    })
    .eq("id", input.partita_id)
    .eq("club_id", clubId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath(`/partite/${input.partita_id}`);
  revalidatePath("/partite");
}
