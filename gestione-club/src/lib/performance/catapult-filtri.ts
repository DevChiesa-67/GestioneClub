import { supabase } from "@/lib/supabase-client";

export type TipoSedutaSingolo = "allenamento" | "partita";

/*
 * catapult_data viene popolato direttamente dai file esportati da
 * Catapult: la colonna "tags" (proveniente dalla colonna "Tags" del
 * CSV) è la fonte autoritativa per distinguere allenamento da
 * partita — non il campo tipo_seduta impostato manualmente
 * sull'importazione. Mapping confermato con il club: "Training" per
 * gli allenamenti, "Game" per le partite.
 */
export const TAG_ALLENAMENTO = "Training";
export const TAG_PARTITA = "Game";

const TAG_PER_TIPO: Record<TipoSedutaSingolo, string> = {
  allenamento: TAG_ALLENAMENTO,
  partita: TAG_PARTITA,
};

function tipiValidiUnivoci(tipiSeduta: TipoSedutaSingolo[]): TipoSedutaSingolo[] {
  return Array.from(
    new Set(
      tipiSeduta.filter(
        (tipo): tipo is TipoSedutaSingolo =>
          tipo === "allenamento" || tipo === "partita"
      )
    )
  );
}

/**
 * Converte i tipi seduta selezionati ("allenamento"/"partita") nei
 * tag Catapult corrispondenti ("Training"/"Game").
 *
 * Ritorna:
 * - null se non va applicato nessun filtro (nessun tipo selezionato,
 *   oppure selezionati sia allenamento che partita).
 * - un array di tag (sempre non vuoto in questo caso) su cui
 *   filtrare catapult_data con `.in("tags", tags)`.
 */
export function tagsPerTipiSeduta(
  tipiSeduta: TipoSedutaSingolo[]
): string[] | null {
  const tipiValidi = tipiValidiUnivoci(tipiSeduta);

  if (tipiValidi.length === 0 || tipiValidi.length === 2) {
    return null;
  }

  return tipiValidi.map((tipo) => TAG_PER_TIPO[tipo]);
}

/**
 * catapult_acwr ha una riga per giocatore/giorno (medie mobili di
 * carico) ma nessuna colonna tags propria: non è quindi possibile un
 * filtro esatto per tipo seduta. Come approssimazione filtriamo per
 * le date di catapult_data che hanno il tag richiesto: la riga ACWR
 * di un giorno viene mostrata solo se quel giorno corrisponde a una
 * seduta del tipo selezionato (funziona salvo più sedute di tipo
 * diverso nello stesso giorno).
 *
 * Ritorna null se non va applicato nessun filtro.
 */
export async function dateCatapultPerTipiSeduta(params: {
  clubId: string;
  tipiSeduta: TipoSedutaSingolo[];
}): Promise<string[] | null> {
  const tags = tagsPerTipiSeduta(params.tipiSeduta);

  if (tags === null) return null;

  const { data, error } = await supabase
    .from("catapult_data")
    .select("date")
    .eq("club_id", params.clubId)
    .in("tags", tags);

  if (error) {
    console.error(
      "Errore caricamento date catapult_data per filtro tipo seduta (ACWR):",
      error
    );

    return [];
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.date)
        .filter((value): value is string => Boolean(value))
    )
  );
}

/**
 * Unifica il vecchio prop singolo (tipoSeduta) con quello nuovo a
 * multiselezione (tipiSeduta), dando priorità al secondo quando
 * presente.
 */
export function risolviTipiSeduta(
  tipoSeduta: "tutte" | TipoSedutaSingolo | undefined,
  tipiSeduta: TipoSedutaSingolo[] | undefined
): TipoSedutaSingolo[] {
  if (tipiSeduta && tipiSeduta.length > 0) {
    return tipiSeduta;
  }

  if (tipoSeduta && tipoSeduta !== "tutte") {
    return [tipoSeduta];
  }

  return [];
}
