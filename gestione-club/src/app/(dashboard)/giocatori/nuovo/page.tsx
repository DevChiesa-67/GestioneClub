"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { creaNuovoGiocatoreAction } from "./actions";
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

export default function NuovoGiocatorePage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("Anagrafica");
  const [loading, setLoading] = useState(false);
  const [clubId, setClubId] = useState<string | null>(null);
  const [squadre, setSquadre] = useState<Squadra[]>([]);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

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
    note: "",
  });

  const iniziali = useMemo(() => {
    return `${form.nome?.[0] ?? ""}${form.cognome?.[0] ?? ""}`.toUpperCase();
  }, [form.nome, form.cognome]);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        showToast({ type: "error", message: "Utente non autenticato." });
        return;
      }

      const { data: profilo, error: profiloError } = await supabase
        .from("profili")
        .select("last_club_id,last_squadra_id")
        .eq("auth_user_id", user.id)
        .single();

      if (profiloError || !profilo?.last_club_id) {
        showToast({ type: "error", message: "Club attivo non trovato." });
        return;
      }

      setClubId(profilo.last_club_id);

      const { data: squadreData } = await supabase
        .from("squadre")
        .select("id,nome,categoria")
        .eq("club_id", profilo.last_club_id)
        .order("nome");

      setSquadre(squadreData ?? []);

      if (profilo.last_squadra_id) {
        setForm((prev) => ({
          ...prev,
          squadra_id: profilo.last_squadra_id,
        }));
      }
    }

    loadData();
  }, []);

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

  async function uploadFotoTemporanea() {
  if (!fotoFile || !clubId) return null;

  const ext =
    fotoFile.name.split(".").pop()?.toLowerCase() ||
    "jpg";

  const temporaryId = crypto.randomUUID();

  const filePath =
    `${clubId}/temp/${temporaryId}/profilo.${ext}`;

  const { error: uploadError } =
    await supabase.storage
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
    const emailValida =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
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

  setLoading(true);

  try {
    const fotoUrl = await uploadFotoTemporanea();

    const result =
      await creaNuovoGiocatoreAction({
        id_atleta: form.id_atleta || null,
        nome: form.nome,
        cognome: form.cognome,
        data_nascita:
          form.data_nascita || null,
        categoria: form.categoria || null,
        email: form.email || null,
        telefono: form.telefono || null,
        squadra_id:
          form.squadra_id || null,
        ruolo_1: form.ruolo_1 || null,
        ruolo_2: form.ruolo_2 || null,
        reparto: form.reparto || null,
        mano_piede_dominante:
          form.mano_piede_dominante || null,
        genitore: form.genitore || null,
        telefono_genitore:
          form.telefono_genitore || null,
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
        title: "Giocatore salvato correttamente",
        message: [
          `Autorizzato ad accedere con l'email ${form.email.trim().toLowerCase()}.`,
          "Può completare la registrazione dalla pagina di registrazione, scegliendo la propria password.",
        ].join("\n"),
      });
    } else {
      showToast({
        type: "success",
        message: form.email.trim()
          ? "Giocatore salvato e collegato al profilo di accesso esistente."
          : "Giocatore salvato correttamente.",
      });
    }

    router.push("/giocatori");
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

  return (
<div className="space-y-6 pb-32 md:space-y-8 md:pb-0">      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
            Giocatori
          </div>

          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Nuovo giocatore
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Inserisci anagrafica, dati sportivi, contatti e documenti.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="hidden rounded-xl bg-[#d71920] px-6 py-3 font-bold text-white shadow-lg shadow-[#d71920]/20 transition hover:bg-[#b9151b] hover:shadow-[#d71920]/30 disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
        >
          {loading ? "Salvataggio..." : "Salva giocatore"}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <section className="rounded-2xl border border-white/10 bg-[#171717] p-5 shadow-2xl shadow-black/20">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <div className="flex aspect-[4/5] items-center justify-center">
              {fotoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fotoPreview}
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
            Carica foto
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

                  <Input
                    type="date"
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
                </FormGrid>
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
              </Section>
            )}

            {activeTab === "Documenti" && (
              <Section title="Documenti">
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
                  <p className="font-bold text-white">
                    Documenti non ancora attivi
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Qui potrai aggiungere certificato medico, documento
                    identità e scadenze.
                  </p>
                </div>
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
        </section><button
          onClick={handleSave}
          disabled={loading}
          className=" rounded-xl bg-[#d71920] px-6 py-3 font-bold text-white shadow-lg shadow-[#d71920]/20 transition hover:bg-[#b9151b] hover:shadow-[#d71920]/30 disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
        >
          {loading ? "Salvataggio..." : "Salva giocatore"}
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#171717]/95 p-4 backdrop-blur md:hidden">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full rounded-xl bg-[#d71920] px-6 py-3 font-bold text-white shadow-lg shadow-[#d71920]/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Salvataggio..." : "Salva giocatore"}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
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
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#d71920] focus:ring-4 focus:ring-[#d71920]/10 disabled:cursor-not-allowed disabled:opacity-40"
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