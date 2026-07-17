"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Camera, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { aggiornaGiocatoreAction } from "../actions";
import { useToast } from "@/components/ui/Toast";

type Squadra = {
  id: string;
  nome: string;
  categoria: string | null;
};

const tabs = ["Anagrafica", "Sportivi", "Contatti", "Documenti", "Note"];

const ruoliCampo = [
  "Pilone sx",
  "Tallonatore",
  "Pilone dx",
  "Seconda Linea",
  "Flanker Blind side",
  "Flanker Open side",
  "N° 8",
  "Mediano Mischia",
  "Mediano Apertura",
  "Primo centro",
  "Secondo centro",
  "Ala",
  "Estremo",
];

export default function ModificaGiocatorePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const giocatoreId = params.id;
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("Anagrafica");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [erroreAccesso, setErroreAccesso] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [squadre, setSquadre] = useState<Squadra[]>([]);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoUrlEsistente, setFotoUrlEsistente] = useState<string | null>(
    null,
  );

  const [form, setForm] = useState({
    id_atleta: "",
    nome: "",
    cognome: "",
    data_nascita: "",
    categoria: "",
    email: "",
    telefono: "",
    squadra_id: "",
    ruolo_1: "",
    ruolo_2: "",
    reparto: "",
    mano_piede_dominante: "",
    genitore: "",
    telefono_genitore: "",
    numero_tessera: "",
    tipo_documento: "",
    numero_documento: "",
    influenza_squadra: "",
    importanza_giocatore: "",
    note: "",
  });

  const iniziali = useMemo(() => {
    return `${form.nome?.[0] ?? ""}${form.cognome?.[0] ?? ""}`.toUpperCase();
  }, [form.nome, form.cognome]);

  useEffect(() => {
    async function loadData() {
      setInitializing(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErroreAccesso("Utente non autenticato.");
        setInitializing(false);
        return;
      }

      const { data: profilo, error: profiloError } = await supabase
        .from("profili")
        .select("last_club_id,tipo_profilo")
        .eq("auth_user_id", user.id)
        .single();

      if (profiloError || !profilo?.last_club_id) {
        setErroreAccesso("Club attivo non trovato.");
        setInitializing(false);
        return;
      }

      const isAdmin =
        String(profilo.tipo_profilo || "").toLowerCase() === "admin";

      if (!isAdmin) {
        setErroreAccesso(
          "Solo un amministratore può modificare un giocatore.",
        );
        setInitializing(false);
        return;
      }

      setClubId(profilo.last_club_id);

      const [{ data: squadreData }, { data: giocatore, error: giocatoreError }] =
        await Promise.all([
          supabase
            .from("squadre")
            .select("id,nome,categoria")
            .eq("club_id", profilo.last_club_id)
            .order("nome"),

          supabase
            .from("giocatori")
            .select(`
              id,
              id_atleta,
              nome,
              cognome,
              data_nascita,
              categoria,
              email,
              telefono,
              squadra_id,
              ruolo_1,
              ruolo_2,
              reparto,
              mano_piede_dominante,
              genitore,
              telefono_genitore,
              numero_tessera,
              tipo_documento,
              numero_documento,
              influenza_squadra,
              importanza_giocatore,
              note,
              foto_url
            `)
            .eq("id", giocatoreId)
            .eq("club_id", profilo.last_club_id)
            .single(),
        ]);

      setSquadre(squadreData ?? []);

      if (giocatoreError || !giocatore) {
        setErroreAccesso("Giocatore non trovato.");
        setInitializing(false);
        return;
      }

      setForm({
        id_atleta: giocatore.id_atleta ?? "",
        nome: giocatore.nome ?? "",
        cognome: giocatore.cognome ?? "",
        data_nascita: giocatore.data_nascita ?? "",
        categoria: giocatore.categoria ?? "",
        email: giocatore.email ?? "",
        telefono: giocatore.telefono ?? "",
        squadra_id: giocatore.squadra_id ?? "",
        ruolo_1: giocatore.ruolo_1 ?? "",
        ruolo_2: giocatore.ruolo_2 ?? "",
        reparto: giocatore.reparto ?? "",
        mano_piede_dominante: giocatore.mano_piede_dominante ?? "",
        genitore: giocatore.genitore ?? "",
        telefono_genitore: giocatore.telefono_genitore ?? "",
        numero_tessera: giocatore.numero_tessera ?? "",
        tipo_documento: giocatore.tipo_documento ?? "",
        numero_documento: giocatore.numero_documento ?? "",
        influenza_squadra: giocatore.influenza_squadra?.toString() ?? "",
        importanza_giocatore:
          giocatore.importanza_giocatore?.toString() ?? "",
        note: giocatore.note ?? "",
      });

      setFotoUrlEsistente(giocatore.foto_url ?? null);
      setInitializing(false);
    }

    loadData();
  }, [giocatoreId]);

  function updateField(name: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleFotoChange(file: File | null) {
    setFotoFile(file);

    if (!file) {
      setFotoPreview(null);
      return;
    }

    setFotoPreview(URL.createObjectURL(file));
  }

  async function uploadNuovaFoto() {
    if (!fotoFile || !clubId) return null;

    const ext =
      fotoFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `${clubId}/${giocatoreId}/profilo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("giocatori")
      .upload(filePath, fotoFile, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("giocatori")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.cognome.trim()) {
      showToast({ type: "error", message: "Nome e cognome sono obbligatori." });
      return;
    }

    if (form.email.trim()) {
      const emailValida = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim(),
      );

      if (!emailValida) {
        showToast({
          type: "error",
          message: "Inserisci un indirizzo email valido.",
        });
        return;
      }
    }

    for (const [campo, etichetta] of [
      ["influenza_squadra", "Influenza sulla squadra"],
      ["importanza_giocatore", "Importanza giocatore"],
    ] as const) {
      const valore = form[campo];

      if (!valore) continue;

      const numero = Number(valore);

      if (!Number.isInteger(numero) || numero < 1 || numero > 10) {
        showToast({
          type: "error",
          message: `${etichetta} deve essere un numero da 1 a 10.`,
        });
        return;
      }
    }

    setLoading(true);

    try {
      const nuovaFotoUrl = await uploadNuovaFoto();
      const fotoUrl = nuovaFotoUrl ?? fotoUrlEsistente;

      const result = await aggiornaGiocatoreAction({
        giocatoreId,
        id_atleta: form.id_atleta || null,
        nome: form.nome,
        cognome: form.cognome,
        data_nascita: form.data_nascita || null,
        categoria: form.categoria || null,
        email: form.email || null,
        telefono: form.telefono || null,
        squadra_id: form.squadra_id || null,
        ruolo_1: form.ruolo_1 || null,
        ruolo_2: form.ruolo_2 || null,
        reparto: form.reparto || null,
        mano_piede_dominante: form.mano_piede_dominante || null,
        genitore: form.genitore || null,
        telefono_genitore: form.telefono_genitore || null,
        numero_tessera: form.numero_tessera || null,
        tipo_documento: form.tipo_documento || null,
        numero_documento: form.numero_documento || null,
        influenza_squadra: form.influenza_squadra
          ? Number(form.influenza_squadra)
          : null,
        importanza_giocatore: form.importanza_giocatore
          ? Number(form.importanza_giocatore)
          : null,
        note: form.note || null,
        foto_url: fotoUrl,
      });

      if (!result.success) {
        showToast({ type: "error", message: result.error });
        return;
      }

      if (result.profiloCreato) {
        showToast({
          type: "success",
          title: "Giocatore aggiornato correttamente",
          message: [
            `Autorizzato ad accedere con l'email ${form.email.trim().toLowerCase()}.`,
            "Può completare la registrazione dalla pagina di registrazione, scegliendo la propria password.",
          ].join("\n"),
        });
      } else {
        showToast({
          type: "success",
          message: "Giocatore aggiornato correttamente.",
        });
      }

      router.push(`/giocatori/${giocatoreId}`);
      router.refresh();
    } catch (error) {
      console.error(error);

      showToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Errore durante il salvataggio.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (initializing) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#171717] p-6 shadow-2xl shadow-black/20 md:p-8">
        <p className="text-zinc-400">Caricamento...</p>
      </div>
    );
  }

  if (erroreAccesso) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#171717] p-6 shadow-2xl shadow-black/20 md:p-8">
        <h1 className="text-2xl font-black text-white">
          Accesso non disponibile
        </h1>

        <p className="mt-2 text-zinc-400">{erroreAccesso}</p>
      </div>
    );
  }

  const fotoDaMostrare = fotoPreview ?? fotoUrlEsistente;

  return (
    <div className="space-y-6 pb-32 md:space-y-8 md:pb-0">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Giocatori
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Modifica giocatore
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Aggiorna anagrafica, dati sportivi, contatti e documenti.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="hidden rounded-xl bg-[#d71920] px-6 py-3 font-bold text-white shadow-lg shadow-[#d71920]/20 transition hover:bg-[#b9151b] hover:shadow-[#d71920]/30 disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
        >
          {loading ? "Salvataggio..." : "Salva modifiche"}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-white/10 bg-[#171717] p-5 shadow-2xl shadow-black/20">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <div className="flex aspect-[4/5] items-center justify-center">
              {fotoDaMostrare ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fotoDaMostrare}
                  alt="Anteprima foto giocatore"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center text-[#d71920]">
                  {iniziali ? (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#d71920]/15 text-3xl font-black">
                      {iniziali}
                    </div>
                  ) : (
                    <Camera size={72} />
                  )}

                  <p className="mt-4 text-sm font-semibold text-zinc-500">
                    Foto giocatore
                  </p>
                </div>
              )}
            </div>

            {fotoPreview && (
              <button
                type="button"
                onClick={() => handleFotoChange(null)}
                className="absolute right-3 top-3 rounded-full bg-black/70 p-2 text-white backdrop-blur transition hover:bg-black"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10">
            <Upload size={16} />
            Cambia foto
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFotoChange(e.target.files?.[0] ?? null)}
            />
          </label>

          <p className="mt-3 text-xs leading-5 text-zinc-500">
            La foto verrà salvata nel bucket Supabase{" "}
            <span className="font-bold text-zinc-300">giocatori</span>.
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#171717] shadow-2xl shadow-black/20">
          <div className="border-b border-white/10 bg-white/[0.02] p-4 md:p-6">
            <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:gap-3 md:overflow-visible md:pb-0">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab
                      ? "bg-[#d71920] text-white shadow-lg shadow-[#d71920]/20"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 md:p-6">
            {activeTab === "Anagrafica" && (
              <Section title="Dati anagrafici">
                <FormGrid>
                  <Input
                    label="ID atleta"
                    value={form.id_atleta}
                    onChange={(v) => updateField("id_atleta", v)}
                  />

                  <Input
                    label="Nome *"
                    value={form.nome}
                    onChange={(v) => updateField("nome", v)}
                  />

                  <Input
                    label="Cognome *"
                    value={form.cognome}
                    onChange={(v) => updateField("cognome", v)}
                  />

                  <DataNascitaInput
                    label="Data di nascita"
                    value={form.data_nascita}
                    onChange={(v) => updateField("data_nascita", v)}
                  />

                  <Input
                    label="Categoria"
                    value={form.categoria}
                    onChange={(v) => updateField("categoria", v)}
                  />
                </FormGrid>

                {form.email.trim() && (
                  <p className="mt-4 text-xs leading-5 text-zinc-500">
                    Nota: dato che questo giocatore ha un'email associata,
                    il campo "ID atleta" viene usato internamente per
                    collegare il giocatore al suo profilo di accesso e
                    verrà sovrascritto automaticamente al salvataggio.
                  </p>
                )}
              </Section>
            )}

            {activeTab === "Sportivi" && (
              <Section title="Dati sportivi">
                <FormGrid>
                  <Select
                    label="Squadra"
                    value={form.squadra_id}
                    onChange={(v) => updateField("squadra_id", v)}
                    options={squadre.map((s) => ({
                      value: s.id,
                      label: `${s.nome}${s.categoria ? ` - ${s.categoria}` : ""}`,
                    }))}
                  />

                  <Select
                    label="Ruolo 1"
                    value={form.ruolo_1}
                    onChange={(v) => updateField("ruolo_1", v)}
                    options={ruoliCampo.map((ruolo) => ({
                      value: ruolo,
                      label: ruolo,
                    }))}
                  />

                  <Select
                    label="Ruolo 2"
                    value={form.ruolo_2}
                    onChange={(v) => updateField("ruolo_2", v)}
                    options={ruoliCampo.map((ruolo) => ({
                      value: ruolo,
                      label: ruolo,
                    }))}
                  />

                  <Input
                    label="Reparto"
                    value={form.reparto}
                    onChange={(v) => updateField("reparto", v)}
                  />

                  <Select
                    label="Mano/Piede dominante"
                    value={form.mano_piede_dominante}
                    onChange={(v) =>
                      updateField("mano_piede_dominante", v)
                    }
                    options={[
                      { value: "Destro", label: "Destro" },
                      { value: "Sinistro", label: "Sinistro" },
                      { value: "Ambidestro", label: "Ambidestro" },
                    ]}
                  />

                  <Input
                    type="number"
                    min={1}
                    max={10}
                    label="Influenza sulla Squadra (1-10)"
                    value={form.influenza_squadra}
                    onChange={(v) => updateField("influenza_squadra", v)}
                  />

                  <Input
                    type="number"
                    min={1}
                    max={10}
                    label="Importanza Giocatore (1-10)"
                    value={form.importanza_giocatore}
                    onChange={(v) => updateField("importanza_giocatore", v)}
                  />
                </FormGrid>

                <p className="mt-4 text-xs leading-5 text-zinc-500">
                  Questi due parametri sono visibili solo agli
                  amministratori, non ai giocatori.
                </p>
              </Section>
            )}

            {activeTab === "Contatti" && (
              <Section title="Contatti">
                <FormGrid>
                  <Input
                    type="email"
                    label="Email"
                    value={form.email}
                    onChange={(v) => updateField("email", v)}
                  />

                  <Input
                    label="Telefono"
                    value={form.telefono}
                    onChange={(v) => updateField("telefono", v)}
                  />

                  <Input
                    label="Genitore"
                    value={form.genitore}
                    onChange={(v) => updateField("genitore", v)}
                  />

                  <Input
                    label="Telefono genitore"
                    value={form.telefono_genitore}
                    onChange={(v) => updateField("telefono_genitore", v)}
                  />
                </FormGrid>

                <p className="mt-4 text-xs leading-5 text-zinc-500">
                  Se aggiungi o modifichi l'email, al salvataggio il
                  giocatore verrà autorizzato ad accedere al gestionale
                  con quell'indirizzo (o collegato al profilo già
                  esistente con la stessa email).
                </p>
              </Section>
            )}

            {activeTab === "Documenti" && (
              <Section title="Documenti">
                <FormGrid>
                  <div className="md:col-span-2">
                    <Input
                      label="Numero Tessera"
                      value={form.numero_tessera}
                      onChange={(v) => updateField("numero_tessera", v)}
                    />
                  </div>

                  <Select
                    label="Tipo Documento"
                    value={form.tipo_documento}
                    onChange={(v) => updateField("tipo_documento", v)}
                    options={[
                      { value: "Carta d'identità", label: "Carta d'identità" },
                      { value: "Passaporto", label: "Passaporto" },
                      { value: "Patente", label: "Patente" },
                    ]}
                  />

                  <Input
                    label="Numero Documento"
                    value={form.numero_documento}
                    onChange={(v) => updateField("numero_documento", v)}
                  />
                </FormGrid>

                <p className="mt-4 text-xs leading-5 text-zinc-500">
                  Certificato medico e scadenze non sono ancora gestiti da
                  questa sezione.
                </p>
              </Section>
            )}

            {activeTab === "Note" && (
              <Section title="Note interne">
                <label>
                  <span className="mb-2 block text-sm font-medium text-zinc-400">
                    Note
                  </span>

                  <textarea
                    value={form.note}
                    onChange={(e) => updateField("note", e.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#d71920] focus:ring-4 focus:ring-[#d71920]/10"
                  />
                </label>
              </Section>
            )}
          </div>
        </section>

        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-xl bg-[#d71920] px-6 py-3 font-bold text-white shadow-lg shadow-[#d71920]/20 transition hover:bg-[#b9151b] hover:shadow-[#d71920]/30 disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
        >
          {loading ? "Salvataggio..." : "Salva modifiche"}
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#171717]/95 p-4 backdrop-blur md:hidden">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full rounded-xl bg-[#d71920] px-6 py-3 font-bold text-white shadow-lg shadow-[#d71920]/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Salvataggio..." : "Salva modifiche"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-5 text-lg font-black text-white">{title}</h2>
      {children}
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 md:grid-cols-2">{children}</div>;
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-400">
        {label}
      </span>

      <input
        type={type}
        value={value}
        disabled={disabled}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#d71920] focus:ring-4 focus:ring-[#d71920]/10 disabled:cursor-not-allowed disabled:opacity-40"
      />
    </label>
  );
}

function isoToGiornoMeseAnno(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return "";

  const [, anno, mese, giorno] = match;

  return `${giorno}-${mese}-${anno}`;
}

function giornoMeseAnnoToIso(valore: string) {
  const match = valore.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!match) return null;

  const [, giorno, mese, anno] = match;

  return `${anno}-${mese}-${giorno}`;
}

function DataNascitaInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (isoValue: string) => void;
}) {
  const [testo, setTesto] = useState(() => isoToGiornoMeseAnno(value));

  useEffect(() => {
    setTesto(isoToGiornoMeseAnno(value));
  }, [value]);

  function handleChange(raw: string) {
    const cifre = raw.replace(/\D/g, "").slice(0, 8);

    let formattato = cifre;

    if (cifre.length > 4) {
      formattato = `${cifre.slice(0, 2)}-${cifre.slice(2, 4)}-${cifre.slice(4)}`;
    } else if (cifre.length > 2) {
      formattato = `${cifre.slice(0, 2)}-${cifre.slice(2)}`;
    }

    setTesto(formattato);

    if (formattato === "") {
      onChange("");
      return;
    }

    const iso = giornoMeseAnnoToIso(formattato);

    if (iso) {
      onChange(iso);
    }
  }

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-400">
        {label}
      </span>

      <input
        type="text"
        inputMode="numeric"
        placeholder="GG-MM-YYYY"
        maxLength={10}
        value={testo}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#d71920] focus:ring-4 focus:ring-[#d71920]/10"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-400">
        {label}
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-[#d71920] focus:ring-4 focus:ring-[#d71920]/10"
      >
        <option value="">Seleziona</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
