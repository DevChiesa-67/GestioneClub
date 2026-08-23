// src/lib/allenamenti/filtri-sezione.ts

/*
 * Memoria temporanea dei filtri della pagina Allenamenti.
 *
 * IL PROBLEMA
 * I filtri (vista, "Data da", "Data a") vivono nello stato di un
 * componente client. Aprire una seduta significa navigare a
 * /allenamenti/{id}/modifica: la pagina elenco viene smontata e, al
 * ritorno, lo stato riparte dai valori di default (la settimana
 * corrente). Chi stava lavorando su marzo si ritrovava a oggi dopo ogni
 * singola apertura, e doveva reimpostare le date ogni volta.
 *
 * IL COMPORTAMENTO VOLUTO
 * I filtri sopravvivono agli spostamenti DENTRO la sezione Allenamenti
 * (elenco -> seduta -> elenco) e vengono azzerati appena si esce dalla
 * sezione. Tornare agli Allenamenti dal menu, dopo essere passati da
 * un'altra pagina, deve ripartire pulito.
 *
 * PERCHE' sessionStorage E NON LA QUERY STRING
 * La query string sarebbe piu' elegante e condivisibile, ma il ritorno
 * dalla seduta avviene con router.push("/allenamenti") da piu' punti
 * (pulsante "Torna agli allenamenti", dopo il salvataggio, dopo
 * l'eliminazione): tutti perderebbero i parametri, e andrebbero
 * modificati uno per uno restando poi da mantenere allineati. Il
 * sessionStorage e' invece indipendente da come si torna indietro,
 * incluso il tasto Indietro del browser.
 *
 * PERCHE' sessionStorage E NON localStorage
 * I filtri sono un contesto di lavoro momentaneo, non una preferenza:
 * devono sparire alla chiusura della scheda, non riproporsi la
 * settimana dopo.
 *
 * La pulizia all'uscita dalla sezione e' in AppShell, l'unico componente
 * client montato su ogni pagina della dashboard e quindi l'unico che
 * vede tutte le navigazioni.
 */

export type FiltriAllenamenti = {
  vista: string;
  dataDa: string;
  dataA: string;
};

const CHIAVE = "allenamenti:filtri";

/** Prefisso delle rotte considerate "dentro la sezione Allenamenti". */
const SEZIONE = "/allenamenti";

/*
 * Attenzione al confronto: startsWith("/allenamenti") da solo
 * considererebbe dentro la sezione anche un'ipotetica rotta
 * "/allenamenti-archivio", che sezione non e'. Si accetta quindi la
 * rotta esatta oppure un percorso che prosegue con "/".
 */
export function appartieneAllaSezione(pathname: string | null): boolean {
  if (!pathname) return false;

  return pathname === SEZIONE || pathname.startsWith(`${SEZIONE}/`);
}

/*
 * Ogni accesso e' protetto da try/catch: in navigazione privata, con i
 * cookie di terze parti bloccati o dentro certe webview, il solo fatto
 * di LEGGERE sessionStorage puo' lanciare. Un filtro non ripristinato e'
 * un fastidio; una pagina che non si apre e' un guasto.
 */
export function salvaFiltriAllenamenti(filtri: FiltriAllenamenti): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(CHIAVE, JSON.stringify(filtri));
  } catch {
    // Memoria non disponibile: si prosegue senza ripristino.
  }
}

export function leggiFiltriAllenamenti(): FiltriAllenamenti | null {
  if (typeof window === "undefined") return null;

  try {
    const grezzo = window.sessionStorage.getItem(CHIAVE);

    if (!grezzo) return null;

    const valore = JSON.parse(grezzo) as Partial<FiltriAllenamenti> | null;

    /*
     * Si validano i campi invece di fidarsi del JSON: la chiave puo'
     * contenere il formato di una versione precedente dell'app, rimasto
     * nella scheda ancora aperta dopo un deploy. Un dato di forma
     * sbagliata deve essere ignorato, non applicato a meta'.
     */
    if (
      !valore ||
      typeof valore.vista !== "string" ||
      typeof valore.dataDa !== "string" ||
      typeof valore.dataA !== "string"
    ) {
      return null;
    }

    return {
      vista: valore.vista,
      dataDa: valore.dataDa,
      dataA: valore.dataA,
    };
  } catch {
    return null;
  }
}

export function pulisciFiltriAllenamenti(): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(CHIAVE);
  } catch {
    // Niente da fare: la chiave scade comunque con la scheda.
  }
}
