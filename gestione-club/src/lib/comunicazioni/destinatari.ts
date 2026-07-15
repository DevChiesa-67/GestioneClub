// src/lib/comunicazioni/destinatari.ts

/*
 * Regole di destinazione di una comunicazione (condivise tra il filtro
 * di visualizzazione e l'invio delle notifiche):
 *
 * - Se sono stati selezionati profili specifici (destinatari_profili
 *   non vuoto), la comunicazione è visibile SOLO a quei profili,
 *   indipendentemente dalle categorie selezionate.
 * - "Tutti" -> visibile a tutti i profili del club.
 * - Altrimenti visibile solo a chi ha un tipo_profilo che corrisponde
 *   a una delle categorie selezionate (Giocatori -> giocatore, ecc.).
 * - L'admin vede sempre tutte le comunicazioni del club, per poterle
 *   gestire (modifica/eliminazione), a prescindere dai destinatari.
 */
export const CATEGORIA_PER_TIPO_PROFILO: Record<string, string> = {
  giocatore: "Giocatori",
  allenatore: "Allenatori",
  preparatore: "Preparatori",
};

export type ComunicazioneDestinatari = {
  destinatari_tipo: string[] | null | undefined;
  destinatari_profili: string[] | null | undefined;
};

export type ProfiloDestinatario = {
  id: string;
  tipoProfilo: string | null | undefined;
};

export function comunicazioneVisibilePerProfilo(
  comunicazione: ComunicazioneDestinatari,
  profilo: ProfiloDestinatario
): boolean {
  const tipoProfiloNormalizzato = String(
    profilo.tipoProfilo ?? ""
  )
    .trim()
    .toLowerCase();

  if (tipoProfiloNormalizzato === "admin") {
    return true;
  }

  const destinatariProfili = comunicazione.destinatari_profili ?? [];

  if (destinatariProfili.length > 0) {
    return destinatariProfili.includes(profilo.id);
  }

  const destinatariTipo = (comunicazione.destinatari_tipo ?? []).map((tipo) =>
    String(tipo).trim().toLowerCase()
  );

  if (destinatariTipo.includes("tutti")) {
    return true;
  }

  const categoriaPropria = CATEGORIA_PER_TIPO_PROFILO[tipoProfiloNormalizzato];

  if (!categoriaPropria) {
    return false;
  }

  return destinatariTipo.includes(categoriaPropria.toLowerCase());
}

/*
 * Ambito della comunicazione dal punto di vista del destinatario:
 * usato per distinguere a colpo d'occhio (icona/colore) se è diretta
 * a tutti, a un gruppo/categoria, o specificamente al singolo utente.
 */
export type ComunicazioneScope = "tutti" | "gruppo" | "personale";

export function getComunicazioneScope(
  comunicazione: ComunicazioneDestinatari,
  profiloId: string
): ComunicazioneScope {
  const destinatariProfili = comunicazione.destinatari_profili ?? [];

  if (destinatariProfili.length > 0) {
    return destinatariProfili.includes(profiloId) ? "personale" : "gruppo";
  }

  const destinatariTipo = (comunicazione.destinatari_tipo ?? []).map((tipo) =>
    String(tipo).trim().toLowerCase()
  );

  return destinatariTipo.includes("tutti") ? "tutti" : "gruppo";
}
