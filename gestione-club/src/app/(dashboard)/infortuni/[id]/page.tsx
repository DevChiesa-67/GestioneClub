import Link from "next/link";

import { createClient } from "@/lib/supabase-server";
import { puoGestireInfortuni } from "@/lib/permessi/infortuni";
import { AppCard } from "@/components/ui/AppCard";
import InfortunioDetailClient from "@/components/infortuni/InfortunioDetailClient";
import {
  assicuraBucketDocumentiMedici,
  BUCKET_DOCUMENTI_MEDICI,
} from "@/lib/supabase-storage-admin";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function InfortunioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Utente non autenticato.");
  }

  const { data: profilo } = await supabase
    .from("profili")
    .select("tipo_profilo,last_club_id")
    .eq("auth_user_id", user.id)
    .single();

  if (!profilo?.last_club_id) {
    throw new Error("Club attivo non trovato.");
  }

  /*
   * Come nella lista: la prop resta isAdmin, ma include anche medico e
   * fisioterapista.
   */
  const puoGestire = puoGestireInfortuni(profilo.tipo_profilo);

  const [
    { data: infortunio, error: infortunioError },
    { data: medico, error: medicoError },
    { data: fisioterapista, error: fisioterapistaError },
    { data: preparatore, error: preparatoreError },
  ] = await Promise.all([
    supabase
      .from("infortuni")
      .select(`
        id,
        data_infortunio,
        tipo_infortunio,
        data_rientro,
        stato,
        giocatori:giocatore_id (
          id,
          nome,
          cognome
        ),
        squadre:squadra_id (
          id,
          nome
        )
      `)
      .eq("id", id)
      .eq("club_id", profilo.last_club_id)
      .maybeSingle(),

    supabase
      .from("infortuni_medico_valutazioni")
      .select("*")
      .eq("infortunio_id", id)
      .eq("club_id", profilo.last_club_id)
      .order("medico_data_valutazione", { ascending: false }),

    supabase
      .from("infortuni_fisioterapista_valutazioni")
      .select("*")
      .eq("infortunio_id", id)
      .eq("club_id", profilo.last_club_id)
      .order("fisioterapista_data_visita", { ascending: false }),

    supabase
      .from("infortuni_preparatore_valutazioni")
      .select("*")
      .eq("infortunio_id", id)
      .eq("club_id", profilo.last_club_id)
      .order("preparatore_data_valutazione", { ascending: false }),
  ]);

  /*
   * Le tre schede di valutazione sono facoltative: se la loro tabella non
   * esiste ancora, o RLS le nasconde, la pagina deve comunque aprirsi.
   * Logghiamo pero' l'errore, perche' prima veniva scartato in silenzio e
   * rendeva impossibile capire cosa non andasse.
   */
  for (const [nome, errore] of [
    ["valutazioni medico", medicoError],
    ["valutazioni fisioterapista", fisioterapistaError],
    ["valutazioni preparatore", preparatoreError],
  ] as const) {
    if (errore) {
      console.error(`Errore caricamento ${nome} (infortunio ${id}):`, {
        code: errore.code,
        message: errore.message,
        details: errore.details,
        hint: errore.hint,
      });
    }
  }

  if (infortunioError) {
    console.error("Errore caricamento infortunio:", {
      id,
      clubId: profilo.last_club_id,
      code: infortunioError.code,
      message: infortunioError.message,
      details: infortunioError.details,
      hint: infortunioError.hint,
    });
  }

  if (!infortunio) {
    /*
     * Niente eccezione: un id inesistente, un infortunio di un altro club
     * o una policy RLS che lo nasconde sono situazioni normali, non un
     * crash dell'applicazione. Mostriamo cosa e' successo e come uscirne.
     */
    const motivo = infortunioError
      ? `Il database ha risposto: ${infortunioError.message}` +
        (infortunioError.code ? ` (codice ${infortunioError.code})` : "")
      : "L'infortunio non esiste, appartiene a un altro club, oppure non sei autorizzato a vederlo.";

    return (
      <AppCard>
        <h1 className="text-xl font-bold text-white">Infortunio non trovato</h1>

        <p className="mt-3 text-sm text-zinc-400">{motivo}</p>

        <p className="mt-2 text-xs text-zinc-600">
          Identificativo cercato: <span className="font-mono">{id}</span> nel
          club attivo.
        </p>

        <Link
          href="/infortuni"
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
        >
          Torna agli infortuni
        </Link>
      </AppCard>
    );
  }

  /*
   * Le relazioni FK singole (giocatore_id, squadra_id) vengono
   * restituite da Supabase come oggetto singolo, ma senza i tipi
   * generati dal Database lo string-based select le tipizza come
   * array: normalizziamo qui prendendo il primo elemento.
   */
  const infortunioNormalizzato = {
    ...infortunio,
    giocatori: Array.isArray(infortunio.giocatori)
      ? (infortunio.giocatori[0] ?? null)
      : infortunio.giocatori,
    squadre: Array.isArray(infortunio.squadre)
      ? (infortunio.squadre[0] ?? null)
      : infortunio.squadre,
  };

  const medicoConAllegati = await Promise.all(
    (medico ?? []).map(async (valutazione) => {
      const links = await Promise.all(
        (valutazione.medico_link_documentazione ?? []).map(async (link: string) => {
          if (!link.startsWith("storage://")) {
            return { url: link, nome: link };
          }

          const riferimento = link.slice("storage://".length);
          const separatore = riferimento.lastIndexOf("::");
          const percorso = separatore >= 0 ? riferimento.slice(0, separatore) : riferimento;
          const nome = separatore >= 0 ? riferimento.slice(separatore + 2) : "Allegato medico";
          const storageAdmin = await assicuraBucketDocumentiMedici();
          const { data } = await storageAdmin.storage
            .from(BUCKET_DOCUMENTI_MEDICI)
            .createSignedUrl(percorso, 60 * 60);

          return data?.signedUrl ? { url: data.signedUrl, nome } : null;
        })
      );

      return {
        ...valutazione,
        medico_link_documentazione: links.filter(
          (link): link is { url: string; nome: string } => Boolean(link)
        ),
      };
    })
  );

  return (
    <InfortunioDetailClient
      infortunio={infortunioNormalizzato}
      medico={medicoConAllegati}
      fisioterapista={fisioterapista ?? []}
      preparatore={preparatore ?? []}
      isAdmin={puoGestire}
    />
  );
}
