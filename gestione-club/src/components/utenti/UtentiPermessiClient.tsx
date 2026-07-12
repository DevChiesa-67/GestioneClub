"use client";

import { useMemo, useState, useTransition } from "react";
import {
  creaAccountUtente,
  creaTipoProfilo,
  eliminaTipoProfilo,
  salvaPermessiPagineTipoProfilo,
} from "@/app/(dashboard)/utenti-permessi/actions";
import { AppCard } from "@/components/ui/AppCard";
import { useToast } from "@/components/ui/Toast";
import {
  Loader2,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

type Utente = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  tipo_profilo: string;
  club_id: string[] | string;
};

type PermessoPagina = {
  id: string;
  club_id: string;
  tipo_profilo: string;
  pagina_key: string;
  can_view: boolean;
};

type PaginaPermesso = {
  key: string;
  label: string;
};

type TipoProfilo = {
  id: string;
  codice: string;
  nome: string;
  descrizione: string | null;
  protetto: boolean;
  attivo: boolean;
};

type Props = {
  clubId: string;
  currentUserId: string;
  currentTipoProfilo: string;
  utenti: Utente[];
  permessiPagine: PermessoPagina[];
  pagine: PaginaPermesso[];
  tipiProfilo: TipoProfilo[];
};

function normalizzaCodiceTipoProfilo(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function UtentiPermessiClient({
  clubId,
  currentTipoProfilo,
  utenti = [],
  permessiPagine = [],
  pagine = [],
  tipiProfilo = [],
}: Props) {
  const { showToast } = useToast();

  const [localPermessiPagine, setLocalPermessiPagine] =
    useState<PermessoPagina[]>(permessiPagine);

  const [localTipiProfilo, setLocalTipiProfilo] =
    useState<TipoProfilo[]>(tipiProfilo);

  const [dirtyPagineTipi, setDirtyPagineTipi] =
    useState<Set<string>>(new Set());

  const [savingPagineTipo, setSavingPagineTipo] =
    useState<string | null>(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [openTipiProfilo, setOpenTipiProfilo] =
    useState(false);

  const [editingTipoProfilo, setEditingTipoProfilo] =
    useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");

  const tipoProfiloPredefinito =
    tipiProfilo.find(
      (tipo) => tipo.codice.toLowerCase() === "giocatore"
    )?.codice ??
    tipiProfilo[0]?.codice ??
    "";

  const [tipoProfilo, setTipoProfilo] = useState(
    tipoProfiloPredefinito
  );

  const [nomeNuovoTipo, setNomeNuovoTipo] = useState("");
  const [codiceNuovoTipo, setCodiceNuovoTipo] =
    useState("");
  const [descrizioneNuovoTipo, setDescrizioneNuovoTipo] =
    useState("");

  const [savingNuovoTipo, setSavingNuovoTipo] =
    useState(false);

  const [deletingTipoId, setDeletingTipoId] = useState<
    string | null
  >(null);

  const isAdmin =
    currentTipoProfilo?.toLowerCase() === "admin";

  const tipiProfiloAttivi = useMemo(() => {
    return localTipiProfilo
      .filter((tipo) => tipo.attivo)
      .sort((a, b) =>
        a.nome.localeCompare(b.nome, "it", {
          sensitivity: "base",
        })
      );
  }, [localTipiProfilo]);

  /*
   * Genera una scheda anche per i tipi profilo
   * che non hanno ancora utenti associati.
   */
  const tipiConUtenti = useMemo(() => {
    const risultato: Record<string, Utente[]> = {};

    for (const tipo of tipiProfiloAttivi) {
      risultato[tipo.codice] = [];
    }

    for (const utente of utenti) {
      const codice =
        utente.tipo_profilo?.trim() || "senza_profilo";

      if (!risultato[codice]) {
        risultato[codice] = [];
      }

      risultato[codice].push(utente);
    }

    return risultato;
  }, [tipiProfiloAttivi, utenti]);

  function getNomeTipoProfilo(codice: string) {
    return (
      localTipiProfilo.find(
        (tipo) => tipo.codice === codice
      )?.nome ?? codice
    );
  }

  function getPermessoPagina(
    codiceTipoProfilo: string,
    paginaKey: string
  ): PermessoPagina | null {
    return (
      localPermessiPagine.find(
        (permesso) =>
          permesso.tipo_profilo === codiceTipoProfilo &&
          permesso.pagina_key === paginaKey
      ) ?? null
    );
  }

  function togglePaginaLocale(
    codiceTipoProfilo: string,
    paginaKey: string,
    valore: boolean
  ) {
    if (!isAdmin) return;

    if (codiceTipoProfilo.toLowerCase() === "admin") {
      return;
    }

    setLocalPermessiPagine((prev) => {
      const esistente = prev.find(
        (permesso) =>
          permesso.tipo_profilo === codiceTipoProfilo &&
          permesso.pagina_key === paginaKey
      );

      if (esistente) {
        return prev.map((permesso) =>
          permesso.tipo_profilo === codiceTipoProfilo &&
          permesso.pagina_key === paginaKey
            ? {
                ...permesso,
                can_view: valore,
              }
            : permesso
        );
      }

      return [
        ...prev,
        {
          id: `temp-${codiceTipoProfilo}-${paginaKey}`,
          club_id: clubId,
          tipo_profilo: codiceTipoProfilo,
          pagina_key: paginaKey,
          can_view: valore,
        },
      ];
    });

    setDirtyPagineTipi((prev) => {
      const next = new Set(prev);
      next.add(codiceTipoProfilo);
      return next;
    });
  }

  async function salvaPagineTipo(
    codiceTipoProfilo: string
  ) {
    if (!isAdmin) return;

    if (codiceTipoProfilo.toLowerCase() === "admin") {
      return;
    }

    if (!dirtyPagineTipi.has(codiceTipoProfilo)) {
      return;
    }

    setSavingPagineTipo(codiceTipoProfilo);

    try {
      const payload = pagine.map((pagina) => {
        const permesso = getPermessoPagina(
          codiceTipoProfilo,
          pagina.key
        );

        return {
          pagina_key: pagina.key,
          can_view: permesso?.can_view ?? false,
        };
      });

      const data = await salvaPermessiPagineTipoProfilo({
        tipoProfilo: codiceTipoProfilo,
        pagine: payload,
      });

      const pagineSalvate = Array.isArray(data)
        ? (data as PermessoPagina[])
        : [];

      setLocalPermessiPagine((prev) => [
        ...prev.filter(
          (permesso) =>
            permesso.tipo_profilo !== codiceTipoProfilo
        ),
        ...pagineSalvate,
      ]);

      setDirtyPagineTipi((prev) => {
        const next = new Set(prev);
        next.delete(codiceTipoProfilo);
        return next;
      });
    } catch (error) {
      console.error(
        "Errore salvataggio pagine visibili:",
        error
      );

      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Errore durante il salvataggio delle pagine visibili.",
      });
    } finally {
      setSavingPagineTipo(null);
    }
  }

  function creaProfiloAutorizzato() {
    const nomeNormalizzato = nome.trim();
    const cognomeNormalizzato = cognome.trim();
    const emailNormalizzata = email
      .trim()
      .toLowerCase();

    if (
      !nomeNormalizzato ||
      !cognomeNormalizzato ||
      !emailNormalizzata ||
      !tipoProfilo
    ) {
      showToast({
        type: "error",
        message: "Compila tutti i campi obbligatori.",
      });
      return;
    }

    const emailValida = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailValida.test(emailNormalizzata)) {
      showToast({
        type: "error",
        message: "Inserisci un indirizzo email valido.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const risultato = await creaAccountUtente({
          nome: nomeNormalizzato,
          cognome: cognomeNormalizzato,
          email: emailNormalizzata,
          tipo_profilo: tipoProfilo,
        });

        if (risultato && risultato.success === false) {
          throw new Error(
            risultato.message ||
              "Non è stato possibile creare il profilo."
          );
        }

        showToast({
          type: "success",
          message:
            risultato?.message ?? "Profilo autorizzato correttamente.",
        });

        setOpenCreate(false);
        setNome("");
        setCognome("");
        setEmail("");
        setTipoProfilo(tipoProfiloPredefinito);

        // Piccolo ritardo per lasciare visibile il popup di conferma
        // prima del ricaricamento della pagina.
        setTimeout(() => window.location.reload(), 1200);
      } catch (error) {
        console.error(
          "Errore creazione profilo autorizzato:",
          error
        );

        showToast({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Errore durante la creazione del profilo.",
        });
      }
    });
  }

  function cambiaNomeNuovoTipo(value: string) {
    const vecchioCodiceAutomatico =
      normalizzaCodiceTipoProfilo(nomeNuovoTipo);

    setNomeNuovoTipo(value);

    if (
      !codiceNuovoTipo ||
      codiceNuovoTipo === vecchioCodiceAutomatico
    ) {
      setCodiceNuovoTipo(
        normalizzaCodiceTipoProfilo(value)
      );
    }
  }

  async function handleCreaTipoProfilo() {
    const nomeNormalizzato = nomeNuovoTipo
      .trim()
      .replace(/\s+/g, " ");

    const codiceNormalizzato =
      normalizzaCodiceTipoProfilo(
        codiceNuovoTipo || nomeNuovoTipo
      );

    const descrizioneNormalizzata =
      descrizioneNuovoTipo.trim();

    if (!nomeNormalizzato) {
      showToast({
        type: "error",
        message: "Inserisci il nome del tipo profilo.",
      });
      return;
    }

    if (!codiceNormalizzato) {
      showToast({ type: "error", message: "Inserisci un codice valido." });
      return;
    }

    setSavingNuovoTipo(true);

    try {
      const risultato = await creaTipoProfilo({
        nome: nomeNormalizzato,
        codice: codiceNormalizzato,
        descrizione: descrizioneNormalizzata,
      });

      if (!risultato.success || !risultato.data) {
        throw new Error(
          risultato.message ||
            "Non è stato possibile creare il tipo profilo."
        );
      }

      const nuovoTipo = risultato.data as TipoProfilo;

      setLocalTipiProfilo((prev) => {
        const senzaDuplicati = prev.filter(
          (tipo) => tipo.id !== nuovoTipo.id
        );

        return [...senzaDuplicati, nuovoTipo];
      });

      setTipoProfilo(nuovoTipo.codice);

      setNomeNuovoTipo("");
      setCodiceNuovoTipo("");
      setDescrizioneNuovoTipo("");

      showToast({
        type: "success",
        message: risultato.message,
      });
    } catch (error) {
      console.error(
        "Errore creazione tipo profilo:",
        error
      );

      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Errore durante la creazione del tipo profilo.",
      });
    } finally {
      setSavingNuovoTipo(false);
    }
  }

  async function handleEliminaTipoProfilo(
    tipo: TipoProfilo
  ) {
    if (tipo.protetto || tipo.codice === "admin") {
      showToast({
        type: "error",
        message: "Questo tipo profilo è protetto e non può essere eliminato.",
      });
      return;
    }

    const utentiAssociati = utenti.filter(
      (utente) =>
        utente.tipo_profilo === tipo.codice
    ).length;

    if (utentiAssociati > 0) {
      showToast({
        type: "error",
        message:
          `Non puoi eliminare “${tipo.nome}”: ` +
          `${utentiAssociati} ${
            utentiAssociati === 1
              ? "utente è associato"
              : "utenti sono associati"
          } a questo tipo profilo.`,
      });

      return;
    }

    const confermato = window.confirm(
      `Vuoi eliminare il tipo profilo “${tipo.nome}”?\n\n` +
        "Verranno eliminati anche i relativi permessi."
    );

    if (!confermato) return;

    setDeletingTipoId(tipo.id);

    try {
      const risultato = await eliminaTipoProfilo(
        tipo.id
      );

      if (!risultato.success) {
        throw new Error(
          risultato.message ||
            "Non è stato possibile eliminare il tipo profilo."
        );
      }

      setLocalTipiProfilo((prev) =>
        prev.filter(
          (elemento) => elemento.id !== tipo.id
        )
      );

      setLocalPermessiPagine((prev) =>
        prev.filter(
          (permesso) =>
            permesso.tipo_profilo !== tipo.codice
        )
      );

      setDirtyPagineTipi((prev) => {
        const next = new Set(prev);
        next.delete(tipo.codice);
        return next;
      });

      if (editingTipoProfilo === tipo.codice) {
        setEditingTipoProfilo(null);
      }

      if (tipoProfilo === tipo.codice) {
        const nuovoDefault =
          localTipiProfilo.find(
            (elemento) =>
              elemento.id !== tipo.id &&
              elemento.codice === "giocatore"
          )?.codice ??
          localTipiProfilo.find(
            (elemento) =>
              elemento.id !== tipo.id &&
              elemento.attivo
          )?.codice ??
          "";

        setTipoProfilo(nuovoDefault);
      }

      showToast({
        type: "success",
        message: risultato.message,
      });
    } catch (error) {
      console.error(
        "Errore eliminazione tipo profilo:",
        error
      );

      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Errore durante l’eliminazione del tipo profilo.",
      });
    } finally {
      setDeletingTipoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-3">
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setOpenTipiProfilo(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              <Settings2 className="h-4 w-4" />
              Gestisci tipi profilo
            </button>

            <button
              type="button"
              onClick={() => setOpenCreate(true)}
              disabled={tipiProfiloAttivi.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Aggiungi utente
            </button>
          </>
        )}
      </div>

      {!isAdmin && (
        <AppCard>
          <p className="text-sm text-amber-400">
            Solo un amministratore può modificare i
            permessi.
          </p>
        </AppCard>
      )}

      {Object.entries(tipiConUtenti).map(
        ([codiceTipoProfilo, listaUtenti]) => {
          const tipoIsAdmin =
            codiceTipoProfilo.toLowerCase() === "admin";

          const isEditing =
            editingTipoProfilo === codiceTipoProfilo ||
            tipoIsAdmin;

          const hasPagineChanges =
            dirtyPagineTipi.has(codiceTipoProfilo);

          const nomeTipo =
            getNomeTipoProfilo(codiceTipoProfilo);

          return (
            <AppCard key={codiceTipoProfilo}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">
                      {nomeTipo}
                    </h2>

                    <span className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                      {codiceTipoProfilo}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-zinc-400">
                    {listaUtenti.length}{" "}
                    {listaUtenti.length === 1
                      ? "utente associato"
                      : "utenti associati"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {tipoIsAdmin && (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                      Accesso completo
                    </span>
                  )}

                  {isAdmin && !tipoIsAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingTipoProfilo(
                          editingTipoProfilo ===
                            codiceTipoProfilo
                            ? null
                            : codiceTipoProfilo
                        )
                      }
                      className="rounded-lg border border-zinc-800 p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
                      title="Modifica permessi"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {listaUtenti.length > 0 ? (
                <div className="mb-6 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {listaUtenti.map((utente) => (
                    <div
                      key={utente.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
                    >
                      <p className="text-sm font-medium text-white">
                        {[
                          utente.nome,
                          utente.cognome,
                        ]
                          .filter(Boolean)
                          .join(" ") ||
                          "Utente senza nome"}
                      </p>

                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {utente.email ||
                          "Email non disponibile"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-6 rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-center text-sm text-zinc-500">
                  Nessun utente associato a questo tipo
                  profilo.
                </div>
              )}

              {isEditing && (
                <>
                  <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-white">
                        Pagine visibili
                      </h3>

                      <p className="text-xs text-zinc-500">
                        Scegli quali pagine del gestionale può
                        visualizzare questo gruppo.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {pagine.map((pagina) => {
                        const permessoPagina =
                          getPermessoPagina(
                            codiceTipoProfilo,
                            pagina.key
                          );

                        const checked = tipoIsAdmin
                          ? true
                          : Boolean(
                              permessoPagina?.can_view
                            );

                        const disabled =
                          !isAdmin ||
                          tipoIsAdmin ||
                          savingPagineTipo ===
                            codiceTipoProfilo;

                        return (
                          <label
                            key={pagina.key}
                            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-sm"
                          >
                            <span className="font-medium text-zinc-200">
                              {pagina.label}
                            </span>

                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={(event) =>
                                togglePaginaLocale(
                                  codiceTipoProfilo,
                                  pagina.key,
                                  event.target.checked
                                )
                              }
                              className="h-4 w-4 accent-white disabled:opacity-40"
                            />
                          </label>
                        );
                      })}
                    </div>

                    {!tipoIsAdmin && (
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            salvaPagineTipo(
                              codiceTipoProfilo
                            )
                          }
                          disabled={
                            !hasPagineChanges ||
                            savingPagineTipo ===
                              codiceTipoProfilo
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {savingPagineTipo ===
                            codiceTipoProfilo && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}

                          {savingPagineTipo ===
                          codiceTipoProfilo
                            ? "Salvataggio..."
                            : "Salva pagine visibili"}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </AppCard>
          );
        }
      )}

      {openTipiProfilo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Gestisci tipi profilo
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Crea nuovi gruppi oppure elimina quelli
                  non utilizzati.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpenTipiProfilo(false)
                }
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-white" />

                <h3 className="font-medium text-white">
                  Nuovo tipo profilo
                </h3>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      Nome
                    </label>

                    <input
                      value={nomeNuovoTipo}
                      onChange={(event) =>
                        cambiaNomeNuovoTipo(
                          event.target.value
                        )
                      }
                      placeholder="Es. Fisioterapista"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/40"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-zinc-400">
                      Codice
                    </label>

                    <input
                      value={codiceNuovoTipo}
                      onChange={(event) =>
                        setCodiceNuovoTipo(
                          normalizzaCodiceTipoProfilo(
                            event.target.value
                          )
                        )
                      }
                      placeholder="fisioterapista"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Descrizione
                  </label>

                  <textarea
                    value={descrizioneNuovoTipo}
                    onChange={(event) =>
                      setDescrizioneNuovoTipo(
                        event.target.value
                      )
                    }
                    rows={3}
                    placeholder="Descrizione facoltativa del gruppo..."
                    className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/40"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCreaTipoProfilo}
                    disabled={
                      savingNuovoTipo ||
                      !nomeNuovoTipo.trim() ||
                      !codiceNuovoTipo.trim()
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingNuovoTipo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}

                    {savingNuovoTipo
                      ? "Creazione..."
                      : "Crea tipo profilo"}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold text-white">
                Tipi profilo disponibili
              </h3>

              <div className="space-y-2">
                {tipiProfiloAttivi.map((tipo) => {
                  const numeroUtenti = utenti.filter(
                    (utente) =>
                      utente.tipo_profilo ===
                      tipo.codice
                  ).length;

                  const eliminazioneDisabilitata =
                    tipo.protetto ||
                    tipo.codice === "admin" ||
                    numeroUtenti > 0 ||
                    deletingTipoId === tipo.id;

                  return (
                    <div
                      key={tipo.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-white">
                            {tipo.nome}
                          </p>

                          <span className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                            {tipo.codice}
                          </span>

                          {tipo.protetto && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                              <ShieldCheck className="h-3 w-3" />
                              Protetto
                            </span>
                          )}
                        </div>

                        {tipo.descrizione && (
                          <p className="mt-1 text-xs text-zinc-500">
                            {tipo.descrizione}
                          </p>
                        )}

                        <p className="mt-1 text-xs text-zinc-500">
                          {numeroUtenti}{" "}
                          {numeroUtenti === 1
                            ? "utente associato"
                            : "utenti associati"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleEliminaTipoProfilo(tipo)
                        }
                        disabled={
                          eliminazioneDisabilitata
                        }
                        title={
                          tipo.protetto
                            ? "Tipo profilo protetto"
                            : numeroUtenti > 0
                              ? "Rimuovi prima gli utenti associati"
                              : "Elimina tipo profilo"
                        }
                        className="shrink-0 rounded-lg border border-red-500/30 p-2 text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-700"
                      >
                        {deletingTipoId === tipo.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  );
                })}

                {tipiProfiloAttivi.length === 0 && (
                  <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
                    Nessun tipo profilo configurato.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  setOpenTipiProfilo(false)
                }
                className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {openCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Aggiungi utente autorizzato
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Verrà creato un profilo autorizzato.
                  L’utente dovrà poi registrarsi e scegliere
                  la propria password.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpenCreate(false)}
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Nome
                  </label>

                  <input
                    value={nome}
                    onChange={(event) =>
                      setNome(event.target.value)
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/40"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400">
                    Cognome
                  </label>

                  <input
                    value={cognome}
                    onChange={(event) =>
                      setCognome(event.target.value)
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/40"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/40"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400">
                  Tipo profilo
                </label>

                <select
                  value={tipoProfilo}
                  onChange={(event) =>
                    setTipoProfilo(event.target.value)
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-white/40"
                >
                  {tipiProfiloAttivi.map((tipo) => (
                    <option
                      key={tipo.id}
                      value={tipo.codice}
                    >
                      {tipo.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpenCreate(false)}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900"
              >
                Annulla
              </button>

              <button
                type="button"
                onClick={creaProfiloAutorizzato}
                disabled={
                  isPending ||
                  !nome.trim() ||
                  !cognome.trim() ||
                  !email.trim() ||
                  !tipoProfilo
                }
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {isPending
                  ? "Creazione..."
                  : "Aggiungi utente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}