"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { AppCard } from "@/components/ui/AppCard";
import Link from "next/link";
import { comunicazioneVisibilePerProfilo } from "@/lib/comunicazioni/destinatari";

type Profilo = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  tipo_profilo: string | null;
};

type Giocatore = {
  id: string;
  nome: string;
  cognome: string;
  squadra_id: string | null;
  squadre:
    | {
        nome: string | null;
      }[]
    | null;
};

type Comunicazione = {
  id: string;
  titolo: string;
  descrizione: string;
  destinatari_tipo: string[];
  destinatari_profili: string[] | null;
  destinatari_giocatori: string[] | null;
  created_at: string;
  created_by: string | null;
};

type Lettura = {
  comunicazione_id: string;
};

const categorie = ["Tutti", "Allenatori", "Preparatori", "Giocatori"];

function normalize(value: string | null | undefined) {
  return String(value ?? "").toLowerCase();
}

export default function ComunicazioniClient() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profiloId, setProfiloId] = useState<string | null>(null);
  const [tipoProfilo, setTipoProfilo] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Comunicazione | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [destinatariTipo, setDestinatariTipo] = useState<string[]>([]);
  const [destinatariProfili, setDestinatariProfili] = useState<string[]>([]);
  const [destinatariGiocatori, setDestinatariGiocatori] = useState<string[]>([]);

  const [profili, setProfili] = useState<Profilo[]>([]);
  const [giocatori, setGiocatori] = useState<Giocatore[]>([]);
  const [comunicazioni, setComunicazioni] = useState<Comunicazione[]>([]);
  const [letture, setLetture] = useState<Lettura[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profilo, error: profiloError } = await supabase
      .from("profili")
      .select("id, club_id, last_club_id, tipo_profilo")
      .eq("auth_user_id", user.id)
      .single();

    if (profiloError || !profilo) {
      console.error("Errore profilo:", profiloError);
      setLoading(false);
      return;
    }

    const activeClubId = profilo.last_club_id ?? profilo.club_id?.[0];

    if (!activeClubId) {
      setLoading(false);
      return;
    }

    const admin = normalize(profilo.tipo_profilo) === "admin";

    setProfiloId(profilo.id);
    setTipoProfilo(profilo.tipo_profilo);
    setClubId(activeClubId);
    setIsAdmin(admin);

    const [profiliRes, giocatoriRes, comunicazioniRes, lettureRes] =
      await Promise.all([
        supabase
          .from("profili")
          .select("id, nome, cognome, email, tipo_profilo")
          .contains("club_id", [activeClubId])
          .order("cognome", { ascending: true }),

        supabase
          .from("giocatori")
          .select("id, nome, cognome, squadra_id, squadre(nome)")
          .eq("club_id", activeClubId)
          .eq("attivo", true)
          .order("cognome", { ascending: true }),

        supabase
          .from("comunicazioni")
          .select("*")
          .eq("club_id", activeClubId)
          .order("created_at", { ascending: false }),

        supabase
          .from("comunicazioni_letture")
          .select("comunicazione_id")
          .eq("user_id", user.id),
      ]);

    if (profiliRes.error) {
      console.error("Errore profili:", profiliRes.error);
    }

    if (giocatoriRes.error) {
      console.error("Errore giocatori:", giocatoriRes.error);
    }

    if (comunicazioniRes.error) {
      console.error("Errore comunicazioni:", comunicazioniRes.error);
    }

    if (lettureRes.error) {
      console.error("Errore letture:", lettureRes.error);
    }

    setProfili((profiliRes.data ?? []) as Profilo[]);
    setGiocatori((giocatoriRes.data ?? []) as Giocatore[]);
    setComunicazioni((comunicazioniRes.data ?? []) as Comunicazione[]);
    setLetture((lettureRes.data ?? []) as Lettura[]);

    setLoading(false);
  }

  const lettureIds = useMemo(
    () => new Set(letture.map((l) => l.comunicazione_id)),
    [letture]
  );

  /*
   * Una comunicazione è visibile solo se destinata a "Tutti", alla
   * categoria del proprio tipo_profilo, o specificamente al proprio
   * profilo. L'admin vede sempre tutto per poter gestire l'elenco.
   */
  const comunicazioniVisibili = useMemo(() => {
    if (!profiloId) return [];

    return comunicazioni.filter((comunicazione) =>
      comunicazioneVisibilePerProfilo(comunicazione, {
        id: profiloId,
        tipoProfilo,
      })
    );
  }, [comunicazioni, profiloId, tipoProfilo]);

  const categoriaSingola =
    destinatariTipo.length === 1 && destinatariTipo[0] !== "Tutti";

  const personeDisponibili = useMemo(() => {
    if (!categoriaSingola) return [];

    const categoria = destinatariTipo[0];

    if (categoria === "Giocatori") {
      return giocatori.map((g) => ({
        id: g.id,
        label: `${g.cognome} ${g.nome}${
          g.squadre?.[0]?.nome ? ` - ${g.squadre[0].nome}` : ""
        }`,
        type: "giocatore" as const,
      }));
    }

    return profili
      .filter((p) => {
        const tipo = normalize(p.tipo_profilo);

        if (categoria === "Allenatori") return tipo === "allenatore";
        if (categoria === "Preparatori") return tipo === "preparatore";

        return false;
      })
      .map((p) => ({
        id: p.id,
        label:
          `${p.cognome ?? ""} ${p.nome ?? ""}`.trim() ||
          p.email ||
          "Senza nome",
        type: "profilo" as const,
      }));
  }, [categoriaSingola, destinatariTipo, profili, giocatori]);

  function toggleCategoria(categoria: string) {
    setDestinatariTipo((prev) => {
      if (categoria === "Tutti") {
        return prev.includes("Tutti") ? [] : ["Tutti"];
      }

      const withoutTutti = prev.filter((c) => c !== "Tutti");

      if (withoutTutti.includes(categoria)) {
        return withoutTutti.filter((c) => c !== categoria);
      }

      return [...withoutTutti, categoria];
    });

    setDestinatariProfili([]);
    setDestinatariGiocatori([]);
  }

  function togglePersona(id: string, type: "profilo" | "giocatore") {
    if (type === "profilo") {
      setDestinatariProfili((prev) =>
        prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id]
      );
    } else {
      setDestinatariGiocatori((prev) =>
        prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id]
      );
    }
  }

  function resetForm() {
    setEditing(null);
    setTitolo("");
    setDescrizione("");
    setDestinatariTipo([]);
    setDestinatariProfili([]);
    setDestinatariGiocatori([]);
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(comunicazione: Comunicazione) {
    setEditing(comunicazione);
    setTitolo(comunicazione.titolo);
    setDescrizione(comunicazione.descrizione);
    setDestinatariTipo(comunicazione.destinatari_tipo ?? []);
    setDestinatariProfili(comunicazione.destinatari_profili ?? []);
    setDestinatariGiocatori(comunicazione.destinatari_giocatori ?? []);
    setOpen(true);
  }

  async function salvaComunicazione() {
    if (!clubId || !userId || !profiloId || !titolo.trim() || !descrizione.trim()) {
      return;
    }

    if (!isAdmin) {
      console.error("Solo l'amministratore può creare o modificare comunicazioni.");
      return;
    }

    const payload = {
      club_id: clubId,
      titolo: titolo.trim(),
      descrizione: descrizione.trim(),
      destinatari_tipo: destinatariTipo,
      destinatari_profili: destinatariProfili,
      destinatari_giocatori: destinatariGiocatori,
      created_by: profiloId,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      const { error } = await supabase
        .from("comunicazioni")
        .update(payload)
        .eq("id", editing.id);

      if (error) {
        console.error("Errore modifica comunicazione:", error);
        return;
      }
    } else {
      const { data: creata, error } = await supabase
        .from("comunicazioni")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        console.error("Errore creazione comunicazione:", error);
        return;
      }

      // Invia notifiche in-app + push ai destinatari, senza bloccare la UI.
      if (creata?.id) {
        fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comunicazione_id: creata.id }),
        }).catch((err) => {
          console.error("Errore invio notifiche comunicazione:", err);
        });
      }
    }

    setOpen(false);
    resetForm();
    await loadInitialData();
  }

  async function eliminaComunicazione(comunicazioneId: string) {
    if (!isAdmin) {
      console.error("Solo l'amministratore può eliminare le comunicazioni.");
      return;
    }

    const conferma = window.confirm(
      "Sei sicuro di voler eliminare questa comunicazione? L'azione non può essere annullata."
    );

    if (!conferma) return;

    setDeletingId(comunicazioneId);

    // Rimuove prima le letture collegate, così l'eliminazione della
    // comunicazione non fallisce per eventuali vincoli di chiave esterna.
    const { error: lettureError } = await supabase
      .from("comunicazioni_letture")
      .delete()
      .eq("comunicazione_id", comunicazioneId);

    if (lettureError) {
      console.error("Errore eliminazione letture comunicazione:", lettureError);
      setDeletingId(null);
      return;
    }

    const { error } = await supabase
      .from("comunicazioni")
      .delete()
      .eq("id", comunicazioneId);

    if (error) {
      console.error("Errore eliminazione comunicazione:", error);
      setDeletingId(null);
      return;
    }

    setComunicazioni((prev) =>
      prev.filter((comunicazione) => comunicazione.id !== comunicazioneId)
    );
    setDeletingId(null);
  }

  async function segnaComeLetta(comunicazioneId: string) {
  if (!userId) {
    console.error("Lettura impossibile: userId mancante");
    return;
  }

  const { data, error } = await supabase
    .from("comunicazioni_letture")
    .upsert(
      {
        comunicazione_id: comunicazioneId,
        user_id: userId,
      },
      {
        onConflict: "comunicazione_id,user_id",
        ignoreDuplicates: true,
      }
    )
    .select("comunicazione_id");

  if (error) {
    console.error("ERRORE SUPABASE LETTURA");
    console.error("message:", error.message);
    console.error("code:", error.code);
    console.error("details:", error.details);
    console.error("hint:", error.hint);
    console.error("data:", data);
    return;
  }

  setLetture((prev) => {
    const giaPresente = prev.some(
      (lettura) => lettura.comunicazione_id === comunicazioneId
    );

    if (giaPresente) {
      return prev;
    }

    return [
      ...prev,
      {
        comunicazione_id: comunicazioneId,
      },
    ];
  });
}

  if (loading) {
    return (
      <AppCard>
        <p className="text-sm text-zinc-400 sm:text-base">
          Caricamento comunicazioni...
        </p>
      </AppCard>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* AZIONE PRINCIPALE */}
      {isAdmin && (
        <div className="flex w-full justify-stretch sm:justify-end">
          <button
            type="button"
            onClick={openCreate}
            className="
              inline-flex min-h-11 w-full items-center justify-center
              gap-2 rounded-xl bg-red-700 px-4 py-2.5
              text-sm font-medium text-white
              transition-colors hover:bg-red-800
              sm:w-auto sm:py-2
            "
          >
            <Plus size={18} className="shrink-0" />
            <span>Crea Comunicazione</span>
          </button>
        </div>
      )}

      {/* ELENCO COMUNICAZIONI */}
      <div className="space-y-2.5 sm:space-y-3">
        {comunicazioniVisibili.length === 0 ? (
          <AppCard>
            <p className="text-sm text-zinc-400 sm:text-base">
              Nessuna comunicazione presente.
            </p>
          </AppCard>
        ) : (
          comunicazioniVisibili.map((comunicazione) => {
            const letta = lettureIds.has(comunicazione.id);

            return (
              <Link
                key={comunicazione.id}
                href={`/comunicazioni/${comunicazione.id}`}
                className="block min-w-0"
              >
                <AppCard>
                  <div className="min-w-0">
                    {/* HEADER CARD MOBILE */}
                    <div className="flex min-w-0 items-start gap-2 sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div
                          className="
                            flex min-w-0 flex-col items-start gap-2
                            sm:flex-row sm:flex-wrap sm:items-center
                          "
                        >
                          <h3
                            className="
                              w-full min-w-0 break-words
                              text-base font-semibold leading-snug text-white
                              sm:w-auto sm:text-lg
                            "
                          >
                            {comunicazione.titolo}
                          </h3>

                          <span
                            className={`
                              inline-flex shrink-0 rounded-full
                              px-2.5 py-1 text-[11px] font-medium
                              sm:px-3 sm:text-xs
                              ${
                                letta
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-yellow-500/15 text-yellow-300"
                              }
                            `}
                          >
                            {letta ? "Letta" : "Non letta"}
                          </span>
                        </div>
                      </div>

                      {/* MODIFICA + ELIMINA */}
                      {isAdmin && (
                        <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-1 sm:mr-0 sm:mt-0">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openEdit(comunicazione);
                            }}
                            className="
                              inline-flex h-10 w-10
                              shrink-0 items-center justify-center
                              rounded-lg text-zinc-400
                              transition-colors
                              hover:bg-zinc-800 hover:text-white
                              sm:h-auto sm:w-auto sm:p-2
                            "
                            title="Modifica comunicazione"
                            aria-label="Modifica comunicazione"
                          >
                            <Pencil size={18} />
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              eliminaComunicazione(comunicazione.id);
                            }}
                            disabled={deletingId === comunicazione.id}
                            className="
                              inline-flex h-10 w-10
                              shrink-0 items-center justify-center
                              rounded-lg text-zinc-400
                              transition-colors
                              hover:bg-red-500/10 hover:text-red-400
                              disabled:cursor-not-allowed disabled:opacity-50
                              sm:h-auto sm:w-auto sm:p-2
                            "
                            title="Elimina comunicazione"
                            aria-label="Elimina comunicazione"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* DESCRIZIONE */}
                    <p
                      className="
                        mt-3 whitespace-pre-line break-words
                        text-sm leading-6 text-zinc-300
                        [display:-webkit-box]
                        [-webkit-box-orient:vertical]
                        [-webkit-line-clamp:4]
                        overflow-hidden
                        sm:[display:block]
                        sm:overflow-visible
                      "
                    >
                      {comunicazione.descrizione}
                    </p>

                    {/* DESTINATARI */}
                    {comunicazione.destinatari_tipo?.length > 0 && (
                      <div
                        className="
                          mt-3 flex max-w-full gap-2
                          overflow-x-auto pb-1
                          [scrollbar-width:none]
                          [&::-webkit-scrollbar]:hidden
                          sm:flex-wrap sm:overflow-visible sm:pb-0
                        "
                      >
                        {comunicazione.destinatari_tipo.map((tipo) => (
                          <span
                            key={tipo}
                            className="
                              inline-flex shrink-0 rounded-full
                              bg-zinc-800 px-2.5 py-1
                              text-[11px] text-zinc-300
                              sm:px-3 sm:text-xs
                            "
                          >
                            {tipo}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* AZIONE LETTURA */}
                    {!letta && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          segnaComeLetta(comunicazione.id);
                        }}
                        className="
                          mt-4 inline-flex min-h-10 w-full
                          items-center justify-center
                          rounded-lg border border-zinc-700
                          px-3 py-2 text-xs font-medium text-zinc-300
                          transition-colors hover:bg-zinc-800
                          sm:min-h-0 sm:w-auto sm:py-1.5
                        "
                      >
                        Segna come letta
                      </button>
                    )}
                  </div>
                </AppCard>
              </Link>
            );
          })
        )}
      </div>

      {/* MODALE CREA / MODIFICA */}
      {open && (
        <div
          className="
            fixed inset-0 z-50
            flex items-end justify-center
            bg-black/70
            sm:items-center sm:p-4
          "
        >
          <div
            className="
              flex max-h-[100dvh] w-full flex-col
              rounded-t-2xl border border-zinc-800
              bg-zinc-950 shadow-xl
              sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl
            "
          >
            {/* HEADER MODALE */}
            <div
              className="
                flex shrink-0 items-center justify-between
                border-b border-zinc-800
                px-4 py-3.5
                sm:border-b-0 sm:px-5 sm:pb-0 sm:pt-5
              "
            >
              <h2
                className="
                  min-w-0 pr-3
                  text-lg font-semibold text-white
                  sm:text-xl
                "
              >
                {editing
                  ? "Modifica comunicazione"
                  : "Crea comunicazione"}
              </h2>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="
                  inline-flex h-10 w-10 shrink-0
                  items-center justify-center
                  rounded-lg text-zinc-400
                  hover:bg-zinc-800 hover:text-white
                "
                aria-label="Chiudi"
              >
                <X size={20} />
              </button>
            </div>

            {/* CONTENUTO SCROLLABILE */}
            <div
              className="
                min-h-0 flex-1 overflow-y-auto
                overscroll-contain px-4 py-4
                sm:px-5 sm:py-5
              "
            >
              <div className="space-y-4 sm:space-y-5">
                {/* TITOLO */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Titolo
                  </label>

                  <input
                    value={titolo}
                    onChange={(e) => setTitolo(e.target.value)}
                    className="
                      min-h-11 w-full rounded-xl
                      border border-zinc-800 bg-zinc-900
                      px-3.5 py-2.5 text-base text-white
                      outline-none focus:border-red-700
                      sm:px-4 sm:py-2 sm:text-sm
                    "
                    placeholder="Es. Convocazione partita domenica"
                  />
                </div>

                {/* DESTINATARI */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Destinatari
                  </label>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
                    {categorie.map((categoria) => (
                      <button
                        key={categoria}
                        type="button"
                        onClick={() => toggleCategoria(categoria)}
                        className={`
                          min-h-11 rounded-xl border
                          px-2 py-2.5
                          text-xs font-medium
                          transition-colors
                          sm:px-3 sm:py-3 sm:text-sm
                          ${
                            destinatariTipo.includes(categoria)
                              ? "border-red-700 bg-red-700/20 text-red-300"
                              : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                          }
                        `}
                      >
                        {categoria}
                      </button>
                    ))}
                  </div>
                </div>

                {/* PERSONE */}
                {categoriaSingola && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Seleziona persone
                    </label>

                    <div
                      className="
                        max-h-48 overflow-y-auto
                        rounded-xl border border-zinc-800
                        bg-zinc-900 p-1.5
                        sm:max-h-52 sm:p-2
                      "
                    >
                      {personeDisponibili.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-zinc-500">
                          Nessuna persona trovata per questa categoria.
                        </p>
                      ) : (
                        personeDisponibili.map((persona) => {
                          const selected =
                            persona.type === "profilo"
                              ? destinatariProfili.includes(persona.id)
                              : destinatariGiocatori.includes(persona.id);

                          return (
                            <label
                              key={`${persona.type}-${persona.id}`}
                              className="
                                flex min-h-11 cursor-pointer
                                items-center gap-3 rounded-lg
                                px-2.5 py-2
                                text-sm text-zinc-300
                                hover:bg-zinc-800
                                sm:px-3
                              "
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() =>
                                  togglePersona(
                                    persona.id,
                                    persona.type
                                  )
                                }
                                className="h-4 w-4 shrink-0"
                              />

                              <span className="min-w-0 break-words">
                                {persona.label}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* DESCRIZIONE */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-300">
                    Descrizione
                  </label>

                  <textarea
                    value={descrizione}
                    onChange={(e) => setDescrizione(e.target.value)}
                    rows={6}
                    className="
                      w-full resize-none rounded-xl
                      border border-zinc-800 bg-zinc-900
                      px-3.5 py-3
                      text-base leading-6 text-white
                      outline-none focus:border-red-700
                      sm:px-4 sm:py-2 sm:text-sm
                    "
                    placeholder="Scrivi il testo della comunicazione..."
                  />
                </div>
              </div>
            </div>

            {/* FOOTER FISSO MOBILE */}
            <div
              className="
                shrink-0 border-t border-zinc-800
                bg-zinc-950
                px-4 pb-[max(1rem,env(safe-area-inset-bottom))]
                pt-3
                sm:px-5 sm:pb-5
              "
            >
              <div
                className="
                  grid grid-cols-2 gap-2
                  sm:flex sm:justify-end sm:gap-3
                "
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  className="
                    min-h-11 rounded-xl
                    border border-zinc-700
                    px-3 py-2.5
                    text-sm text-zinc-300
                    hover:bg-zinc-800
                    sm:px-4 sm:py-2
                  "
                >
                  Annulla
                </button>

                <button
                  type="button"
                  onClick={salvaComunicazione}
                  disabled={
                    !titolo.trim() ||
                    !descrizione.trim() ||
                    destinatariTipo.length === 0
                  }
                  className="
                    min-h-11 rounded-xl
                    bg-red-700 px-3 py-2.5
                    text-sm font-medium text-white
                    hover:bg-red-800
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                    sm:px-4 sm:py-2
                  "
                >
                  {editing ? "Salva modifiche" : "Crea comunicazione"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}