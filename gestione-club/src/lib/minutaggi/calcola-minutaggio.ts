// Calcolo dei minuti giocati da ciascun giocatore in una partita, a
// partire da:
//  - chi era titolare (in campo dal minuto 0)
//  - gli eventi "entra"/"esce" letti dal file MINUTAGGIO (tabella CAMBI)
//  - la durata della partita (minuti totali)
//
// Un giocatore può avere più "stint" (es. entra, esce, rientra), anche
// se raro nel rugby: la somma dei minuti tiene conto di tutti gli
// intervalli.

export type EventoCambio = {
  giocatoreId: string;
  minuto: number;
  tipo: "entra" | "esce";
};

export type Intervallo = {
  minutoIngresso: number;
  minutoUscita: number;
};

export type MinutaggioGiocatore = {
  giocatoreId: string;
  intervalli: Intervallo[];
  minutoIngresso: number; // primo ingresso
  minutoUscita: number; // ultima uscita (= durata se ha finito la partita)
  minutiGiocati: number; // somma di tutti gli intervalli
  titolare: boolean;
};

export function calcolaMinutaggioPartita(
  titolariIds: string[],
  eventi: EventoCambio[],
  durataMinuti: number
): Map<string, MinutaggioGiocatore> {
  const titolariSet = new Set(titolariIds);
  const inCampoDa = new Map<string, number>();

  for (const id of titolariSet) {
    inCampoDa.set(id, 0);
  }

  const intervalli = new Map<string, Intervallo[]>();

  function aggiungiIntervallo(
    giocatoreId: string,
    minutoIngresso: number,
    minutoUscita: number
  ) {
    const lista = intervalli.get(giocatoreId) ?? [];
    lista.push({ minutoIngresso, minutoUscita: Math.max(minutoUscita, minutoIngresso) });
    intervalli.set(giocatoreId, lista);
  }

  const eventiOrdinati = [...eventi].sort((a, b) => a.minuto - b.minuto);

  for (const evento of eventiOrdinati) {
    if (evento.tipo === "entra") {
      if (!inCampoDa.has(evento.giocatoreId)) {
        inCampoDa.set(evento.giocatoreId, evento.minuto);
      }
      // Se risultava già in campo (dato duplicato/errore), ignoriamo il
      // secondo ingresso invece di sovrascrivere lo stint in corso.
    } else {
      const minutoIngresso = inCampoDa.get(evento.giocatoreId);

      if (minutoIngresso === undefined) {
        // "Esce" senza un ingresso noto: probabile titolare non
        // segnalato come tale, o dato incompleto nel file. Trattiamo
        // comunque l'intervallo come "dal minuto 0", segnalabile in UI.
        aggiungiIntervallo(evento.giocatoreId, 0, evento.minuto);
      } else {
        aggiungiIntervallo(evento.giocatoreId, minutoIngresso, evento.minuto);
      }

      inCampoDa.delete(evento.giocatoreId);
    }
  }

  // Chi è rimasto in campo fino alla fine della partita.
  for (const [giocatoreId, minutoIngresso] of inCampoDa.entries()) {
    aggiungiIntervallo(giocatoreId, minutoIngresso, durataMinuti);
  }

  const risultato = new Map<string, MinutaggioGiocatore>();

  for (const [giocatoreId, lista] of intervalli.entries()) {
    const ordinati = [...lista].sort(
      (a, b) => a.minutoIngresso - b.minutoIngresso
    );

    const minutiGiocati = ordinati.reduce(
      (totale, i) => totale + (i.minutoUscita - i.minutoIngresso),
      0
    );

    risultato.set(giocatoreId, {
      giocatoreId,
      intervalli: ordinati,
      minutoIngresso: ordinati[0].minutoIngresso,
      minutoUscita: ordinati[ordinati.length - 1].minutoUscita,
      minutiGiocati,
      titolare: titolariSet.has(giocatoreId),
    });
  }

  return risultato;
}

// --- Matching nome testo (dal file) -> giocatore anagrafica -----------

export type GiocatoreMatch = {
  id: string;
  nome: string;
  cognome: string;
  foto_url: string | null;
};

function normalizzaNome(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Restituisce l'elenco di giocatori compatibili con il nome scritto nel
// file: 0 risultati -> non trovato, 1 -> match sicuro, >1 -> ambiguo
// (es. due giocatori con lo stesso cognome).
export function trovaGiocatoriCorrispondenti(
  nomeTesto: string,
  giocatori: GiocatoreMatch[]
): GiocatoreMatch[] {
  const norm = normalizzaNome(nomeTesto);
  if (!norm) return [];

  const perCognome = giocatori.filter(
    (g) => normalizzaNome(g.cognome) === norm
  );
  if (perCognome.length > 0) return perCognome;

  const perNome = giocatori.filter((g) => normalizzaNome(g.nome) === norm);
  if (perNome.length > 0) return perNome;

  const perNomeCompleto = giocatori.filter((g) => {
    const completo1 = normalizzaNome(`${g.nome} ${g.cognome}`);
    const completo2 = normalizzaNome(`${g.cognome} ${g.nome}`);
    return (
      completo1 === norm ||
      completo2 === norm ||
      completo1.includes(norm) ||
      completo2.includes(norm)
    );
  });
  if (perNomeCompleto.length > 0) return perNomeCompleto;

  // Ultima spiaggia: tolleranza minima su troncamenti/refusi.
  return giocatori.filter((g) => {
    const cognome = normalizzaNome(g.cognome);
    return cognome.startsWith(norm) || norm.startsWith(cognome);
  });
}
