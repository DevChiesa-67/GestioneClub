"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, X, Upload } from "lucide-react";

export type SquadraPartita = {
  id: string;
  nome: string;
  abbreviazione: string | null;
  logo_path: string | null;
  logo_url: string | null;
  colore_1: string | null;
  colore_2: string | null;
};

type TipoPartita = "amichevole" | "campionato" | "barrage";

type Props = {
  squadre: SquadraPartita[];
  coloreClub: string;
};

const tipiPartita = [
  { value: "amichevole", label: "Amichevole" },
  { value: "campionato", label: "Campionato" },
  { value: "barrage", label: "Barrage" },
] as const;

function SquadraDropdown({
  label,
  value,
  squadre,
  coloreClub,
  onChange,
}: {
  label: string;
  value: string;
  squadre: SquadraPartita[];
  coloreClub: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = squadre.find((squadra) => squadra.id === value);

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium text-zinc-300">
        {label}
      </label>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 rounded-xl border bg-zinc-900 px-3 py-2 text-left text-sm text-white"
        style={{
          borderColor: value ? `${coloreClub}80` : `${coloreClub}35`,
        }}
      >
        <div
          className="h-9 w-9 shrink-0 rounded-full border bg-zinc-950 bg-contain bg-center bg-no-repeat"
          style={{
            borderColor: `${coloreClub}50`,
            backgroundImage: selected?.logo_url
              ? `url(${selected.logo_url})`
              : undefined,
          }}
        />

        <div className="min-w-0">
          <p className="truncate font-semibold">
            {selected?.nome || "Seleziona squadra"}
          </p>

          {selected?.abbreviazione && (
            <p className="text-xs text-zinc-500">{selected.abbreviazione}</p>
          )}
        </div>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border bg-zinc-950 p-2 shadow-2xl"
          style={{ borderColor: `${coloreClub}55` }}
        >
          {squadre.map((squadra) => (
            <button
              key={squadra.id}
              type="button"
              onClick={() => {
                onChange(squadra.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-zinc-900"
            >
              <div
                className="h-10 w-10 shrink-0 rounded-full border bg-zinc-950 bg-contain bg-center bg-no-repeat"
                style={{
                  borderColor:
                    value === squadra.id ? coloreClub : `${coloreClub}35`,
                  backgroundImage: squadra.logo_url
                    ? `url(${squadra.logo_url})`
                    : undefined,
                }}
              />

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {squadra.nome}
                </p>

                {squadra.abbreviazione && (
                  <p className="text-xs text-zinc-500">
                    {squadra.abbreviazione}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CreaPartitaPopup({ squadre, coloreClub }: Props) {
  const router = useRouter();
  const clubColor = coloreClub;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [successoSquadra, setSuccessoSquadra] = useState<string | null>(null);

  const [squadraCasaId, setSquadraCasaId] = useState("");
  const [squadraFuoriId, setSquadraFuoriId] = useState("");

  const [dataPartita, setDataPartita] = useState("");
  const [oraPartita, setOraPartita] = useState("");
  const [luogo, setLuogo] = useState("");
  const [tipoPartita, setTipoPartita] =
    useState<TipoPartita>("campionato");

  const [showNuovaSquadra, setShowNuovaSquadra] = useState(false);
  const [logoSquadra, setLogoSquadra] = useState<File | null>(null);
  const [previewLogoSquadra, setPreviewLogoSquadra] =
    useState<string | null>(null);

  const [nomeSquadra, setNomeSquadra] = useState("");
  const [abbreviazioneSquadra, setAbbreviazioneSquadra] = useState("");
  const [colore1Squadra, setColore1Squadra] = useState(clubColor);
  const [colore2Squadra, setColore2Squadra] = useState("#ffffff");

  const mapsUrl = useMemo(() => {
    if (!luogo.trim()) {
      return "https://www.google.com/maps?q=Italia&output=embed";
    }

    return `https://www.google.com/maps?q=${encodeURIComponent(
      luogo
    )}&output=embed`;
  }, [luogo]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewLogoSquadra) {
      URL.revokeObjectURL(previewLogoSquadra);
    }

    setLogoSquadra(file);
    setPreviewLogoSquadra(URL.createObjectURL(file));
  }

  function resetNuovaSquadra() {
    if (previewLogoSquadra) {
      URL.revokeObjectURL(previewLogoSquadra);
    }

    setNomeSquadra("");
    setAbbreviazioneSquadra("");
    setColore1Squadra(clubColor);
    setColore2Squadra("#ffffff");
    setLogoSquadra(null);
    setPreviewLogoSquadra(null);
    setShowNuovaSquadra(false);
  }

  function resetForm() {
    setSquadraCasaId("");
    setSquadraFuoriId("");
    setDataPartita("");
    setOraPartita("");
    setLuogo("");
    setTipoPartita("campionato");
    setErrore(null);
    setSuccessoSquadra(null);
    resetNuovaSquadra();
  }

  function apriNuovaSquadra() {
    setErrore(null);
    setSuccessoSquadra(null);
    setColore1Squadra(clubColor);
    setShowNuovaSquadra(true);
  }

  async function creaSquadra() {
    if (!nomeSquadra.trim()) {
      setErrore("Inserisci il nome della squadra.");
      return;
    }

    setLoading(true);
    setErrore(null);
    setSuccessoSquadra(null);

    try {
      const formData = new FormData();
      formData.append("nome", nomeSquadra.trim());
      formData.append("abbreviazione", abbreviazioneSquadra.trim());
      formData.append("colore_1", colore1Squadra || clubColor);
      formData.append("colore_2", colore2Squadra || "#ffffff");

      if (logoSquadra) {
        formData.append("logo", logoSquadra);
      }

      const res = await fetch("/api/squadre-partite/crea", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.error || "Errore durante la creazione squadra."
        );
      }

      resetNuovaSquadra();
      setSuccessoSquadra("Squadra aggiunta");
      router.refresh();

      setTimeout(() => {
        setSuccessoSquadra(null);
      }, 3000);
    } catch (err) {
      setErrore(
        err instanceof Error
          ? err.message
          : "Errore durante la creazione squadra."
      );
    } finally {
      setLoading(false);
    }
  }

  async function creaPartita(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!squadraCasaId || !squadraFuoriId) {
      setErrore("Seleziona entrambe le squadre.");
      return;
    }

    if (squadraCasaId === squadraFuoriId) {
      setErrore("Le due squadre devono essere diverse.");
      return;
    }

    setLoading(true);
    setErrore(null);

    try {
      const res = await fetch("/api/partite/crea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          squadra_casa_id: squadraCasaId,
          squadra_fuori_id: squadraFuoriId,
          data_partita: dataPartita,
          ora_partita: oraPartita,
          luogo,
          tipo_partita: tipoPartita,
        }),
      });

      const text = await res.text();

let json: { error?: string } | null = null;

try {
  json = text ? JSON.parse(text) : null;
} catch {
  throw new Error(
    `La API non ha restituito JSON. Status: ${res.status}. Risposta: ${text.slice(
      0,
      200
    )}`
  );
}

if (!res.ok) {
  throw new Error(json?.error || "Errore durante la creazione partita.");
}

      if (!res.ok) {
        throw new Error(
          json?.error || "Errore durante la creazione partita."
        );
      }

      resetForm();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setErrore(
        err instanceof Error
          ? err.message
          : "Errore durante la creazione della partita."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] hover:opacity-90"
        style={{
          background: `linear-gradient(135deg, ${clubColor}, ${clubColor}cc)`,
          boxShadow: `0 0 24px ${clubColor}55`,
        }}
      >
        <Plus className="h-4 w-4" />
        Crea Partita
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div
            className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border bg-zinc-950 p-6 shadow-2xl"
            style={{
              borderColor: `${clubColor}80`,
              boxShadow: `0 0 60px ${clubColor}25`,
            }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div
                  className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.25em]"
                  style={{
                    borderColor: `${clubColor}60`,
                    backgroundColor: `${clubColor}18`,
                    color: clubColor,
                  }}
                >
                  Match Center
                </div>

                <h2 className="text-2xl font-black text-white">
                  Crea nuova partita
                </h2>

                <p className="text-sm text-zinc-400">
                  Inserisci squadre, data, ora e luogo della partita.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setOpen(false);
                }}
                className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={creaPartita} className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <SquadraDropdown
                  label="Squadra 1"
                  value={squadraCasaId}
                  squadre={squadre}
                  coloreClub={clubColor}
                  onChange={setSquadraCasaId}
                />

                <SquadraDropdown
                  label="Squadra 2"
                  value={squadraFuoriId}
                  squadre={squadre}
                  coloreClub={clubColor}
                  onChange={setSquadraFuoriId}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={apriNuovaSquadra}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] hover:opacity-90"
                  style={{
                    backgroundColor: clubColor,
                    boxShadow: `0 0 16px ${clubColor}55`,
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Aggiungi squadra
                </button>
              </div>

              {successoSquadra && (
                <div
                  className="rounded-xl border px-4 py-3 text-sm font-semibold"
                  style={{
                    borderColor: `${clubColor}50`,
                    backgroundColor: `${clubColor}15`,
                    color: clubColor,
                  }}
                >
                  {successoSquadra}
                </div>
              )}

              {showNuovaSquadra && (
                <div
                  className="rounded-2xl border bg-zinc-900/70 p-4"
                  style={{ borderColor: `${clubColor}55` }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-white">
                      Aggiungi nuova squadra
                    </h3>

                    <button
                      type="button"
                      onClick={resetNuovaSquadra}
                      className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[120px_1fr_140px_90px_90px_auto] md:items-end">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">
                        Logo
                      </label>

                      <label
                        className="flex h-10 cursor-pointer items-center justify-center rounded-xl border bg-zinc-950 text-xs text-zinc-400 transition"
                        style={{ borderColor: `${clubColor}45` }}
                      >
                        {previewLogoSquadra ? (
                          <Image
                            src={previewLogoSquadra}
                            alt="Preview logo"
                            width={90}
                            height={32}
                            className="h-8 max-w-[90px] object-contain"
                            unoptimized
                          />
                        ) : (
                          <span className="flex items-center gap-1">
                            <Upload className="h-3.5 w-3.5" />
                            Upload
                          </span>
                        )}

                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <input
                      value={nomeSquadra}
                      onChange={(e) => setNomeSquadra(e.target.value)}
                      placeholder="Nome squadra"
                      className="rounded-xl border bg-zinc-950 px-3 py-2 text-sm text-white outline-none"
                      style={{ borderColor: `${clubColor}45` }}
                    />

                    <input
                      value={abbreviazioneSquadra}
                      onChange={(e) =>
                        setAbbreviazioneSquadra(e.target.value)
                      }
                      placeholder="Abbreviazione"
                      className="rounded-xl border bg-zinc-950 px-3 py-2 text-sm text-white outline-none"
                      style={{ borderColor: `${clubColor}45` }}
                    />

                    <input
                      type="color"
                      value={colore1Squadra}
                      onChange={(e) => setColore1Squadra(e.target.value)}
                      className="h-10 w-full cursor-pointer rounded-xl border bg-zinc-950"
                      style={{ borderColor: `${clubColor}55` }}
                    />

                    <input
                      type="color"
                      value={colore2Squadra}
                      onChange={(e) => setColore2Squadra(e.target.value)}
                      className="h-10 w-full cursor-pointer rounded-xl border bg-zinc-950"
                      style={{ borderColor: `${clubColor}55` }}
                    />

                    <button
                      type="button"
                      onClick={creaSquadra}
                      disabled={loading}
                      className="h-10 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      style={{
                        backgroundColor: clubColor,
                        boxShadow: `0 0 16px ${clubColor}40`,
                      }}
                    >
                      {loading ? "Salvo..." : "Salva"}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <div>
    <label className="mb-1 block text-sm font-medium text-zinc-300">
      Data partita
    </label>

    <input
      type="date"
      value={dataPartita}
      onChange={(e) => setDataPartita(e.target.value)}
      required
      className="w-full rounded-xl border bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition"
      style={{
        borderColor: `${clubColor}45`,
      }}
    />
  </div>

  <div>
    <label className="mb-1 block text-sm font-medium text-zinc-300">
      Ora partita
    </label>

    <input
      type="time"
      value={oraPartita}
      onChange={(e) => setOraPartita(e.target.value)}
      required
      className="w-full rounded-xl border bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition"
      style={{
        borderColor: `${clubColor}45`,
      }}
    />
  </div>
</div>

              <input
                value={luogo}
                onChange={(e) => setLuogo(e.target.value)}
                placeholder="Campo / indirizzo"
                className="rounded-xl border bg-zinc-900 px-3 py-2 text-sm text-white outline-none"
                style={{ borderColor: `${clubColor}45` }}
              />

              <div className="flex flex-wrap gap-3">
                {tipiPartita.map((tipo) => {
                  const active = tipoPartita === tipo.value;

                  return (
                    <button
                      key={tipo.value}
                      type="button"
                      onClick={() => setTipoPartita(tipo.value)}
                      className="rounded-xl border px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
                      style={{
                        borderColor: active ? clubColor : `${clubColor}35`,
                        backgroundColor: active
                          ? clubColor
                          : `${clubColor}12`,
                        boxShadow: active
                          ? `0 0 18px ${clubColor}40`
                          : "none",
                      }}
                    >
                      {tipo.label}
                    </button>
                  );
                })}
              </div>

              <iframe
                title="Mappa partita"
                src={mapsUrl}
                className="h-64 w-full rounded-2xl border"
                style={{ borderColor: `${clubColor}45` }}
                loading="lazy"
              />

              {errore && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {errore}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setOpen(false);
                  }}
                  className="rounded-xl border px-4 py-2 text-sm font-medium text-zinc-300 transition hover:text-white"
                  style={{ borderColor: `${clubColor}45` }}
                >
                  Annulla
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02] hover:opacity-90 disabled:opacity-60"
                  style={{
                    background: `linear-gradient(135deg, ${clubColor}, ${clubColor}cc)`,
                    boxShadow: `0 0 20px ${clubColor}45`,
                  }}
                >
                  {loading ? "Creazione..." : "Crea Partita"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}