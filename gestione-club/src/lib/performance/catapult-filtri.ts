import { supabase } from "@/lib/supabase-client";

export type TipoSedutaSingolo = "allenamento" | "partita";

/**
 * catapult_data non ha una colonna che indica se una sessione è un
 * allenamento o una partita: quell'informazione vive su
 * catapult_importazioni.tipo_seduta, collegata via
 * catapult_data.importazione_id.
 *
 * In precedenza si usava un embed Supabase
 * (`catapult_importazioni!inner(tipo_seduta)`), ma richiede una foreign
 * key riconosciuta da PostgREST tra le due tabelle: se non è presente
 * nello schema, la query fallisce silenziosamente e non torna più
 * nessun dato. Questo helper evita il problema facendo due query
 * separate, sempre valide indipendentemente dalla presenza di una FK.
 *
 * Ritorna:
 * - null se non va applicato nessun filtro per tipo seduta (nessun tipo
 *   selezionato, oppure selezionati sia allenamento che partita).
 * - un array di importazione_id (anche vuoto) su cui filtrare
 *   catapult_data con `.in("importazione_id", ids)`.
 */
export async function idsImportazioniPerTipoSeduta(params: {
  clubId: string;
  tipiSeduta: TipoSedutaSingolo[];
}): Promise<string[] | null> {
  const tipiValidi = Array.from(
    new Set(
      params.tipiSeduta.filter(
        (tipo): tipo is TipoSedutaSingolo =>
          tipo === "allenamento" || tipo === "partita"
      )
    )
  );

  // Nessun filtro, oppure entrambi i tipi selezionati: equivale a "tutte".
  if (tipiValidi.length === 0 || tipiValidi.length === 2) {
    return null;
  }

  const { data, error } = await supabase
    .from("catapult_importazioni")
    .select("id")
    .eq("club_id", params.clubId)
    .in("tipo_seduta", tipiValidi);

  if (error) {
    console.error(
      "Errore caricamento catapult_importazioni per filtro tipo seduta:",
      error
    );

    return [];
  }

  return (data ?? []).map((row) => row.id);
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
