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

/*
 * Ogni seduta importata da Catapult produce più righe in catapult_data
 * per lo stesso giocatore: una riga con split_name = "all" che contiene
 * i totali dell'intera seduta, più eventuali righe aggiuntive per i
 * sotto-split configurati sul dispositivo (es. 1°/2° tempo, blocchi di
 * lavoro). Se non si filtra esplicitamente per split_name, una query
 * prende TUTTE queste righe insieme, sommando/mediando sia il totale
 * "all" sia i suoi sotto-split e gonfiando ogni statistica. Per questo,
 * quando l'utente non ha selezionato uno split/tempo specifico, va
 * sempre applicato il filtro sullo split "all" (già usato altrove
 * nell'app, vedi dashboard.service.ts).
 */
export const SPLIT_TUTTA_SEDUTA = "all";

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
 * - un array di tag (sempre non vuoto in questo caso) da passare a
 *   filtroTagIlike() per filtrare catapult_data ignorando maiuscole/
 *   minuscole.
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
 * Costruisce il filtro PostgREST da passare a `.or(...)` per confrontare
 * la colonna tags ignorando maiuscole/minuscole.
 *
 * I file esportati da Catapult non hanno un formato tags garantito al
 * 100% (a seconda del dispositivo/versione può arrivare "Training",
 * "training", "TRAINING", ecc.). Un `.in("tags", ["Training","Game"])`
 * è case-sensitive e con una variazione di maiuscole/minuscole non
 * trova più nulla: da qui i filtri "Allenamento"/"Partita" che
 * sembravano non funzionare. `ilike` (senza wildcard `%`) fa un
 * confronto esatto ma case-insensitive.
 */
export function filtroTagIlike(tags: string[]): string {
  return tags.map((tag) => `tags.ilike.${tag}`).join(",");
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
    .or(filtroTagIlike(tags));

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
