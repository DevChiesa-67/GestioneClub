"use client";

import {
  useCallback,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  Filter,
  FlaskConical,
  GripVertical,
  Hash,
  LineChart,
  MoreHorizontal,
  MousePointer2,
  PieChart,
  RotateCcw,
  Save,
  Search,
  Sigma,
  Table2,
  Type,
  Users,
  X,
} from "lucide-react";
import { salvaReportPersonalizzato } from "./actions";
import { useToast } from "@/components/ui/Toast";
/* =========================================================
   TYPES
========================================================= */

type SezionePerformance = "presenze" | "performance" | "test";

type TipoVisualizzazione =
  | "bar"
  | "line"
  | "pie"
  | "table"
  | "kpi";

type TipoCampo = "text" | "number" | "date";

type Aggregazione =
  | "nessuna"
  | "somma"
  | "media"
  | "min"
  | "max"
  | "conteggio"
  | "conteggio_distinto";

type CampoDisponibile = {
  id: string;
  nome: string;
  label: string;
  tipo: TipoCampo;
  tabella: string;
};

type SorgenteDati = {
  id: string;
  nome: string;
  descrizione: string;
  campi: CampoDisponibile[];
};

type CampoReport = CampoDisponibile & {
  aggregazione: Aggregazione;
};

type FiltroReport = {
  id: string;
  campo: CampoDisponibile;
  operatore: string;
  valore: string;
};

type ReportConfig = {
  titolo: string;
  descrizione: string;
  tipoVisualizzazione: TipoVisualizzazione;
  sezionePerformance: SezionePerformance;
  asseX: CampoReport[];
  valori: CampoReport[];
  legenda: CampoReport[];
  filtri: FiltroReport[];
};

/* =========================================================
   MOCK DATA
   In seguito questi dati arriveranno da Supabase
========================================================= */

const SORGENTI_DATI: SorgenteDati[] = [
  {
    id: "giocatori",
    nome: "Giocatori",
    descrizione: "Anagrafica e informazioni atleti",
    campi: [
      {
        id: "giocatore_id",
        nome: "id",
        label: "ID giocatore",
        tipo: "text",
        tabella: "giocatori",
      },
      {
        id: "giocatore_nome",
        nome: "nome",
        label: "Nome",
        tipo: "text",
        tabella: "giocatori",
      },
      {
        id: "giocatore_cognome",
        nome: "cognome",
        label: "Cognome",
        tipo: "text",
        tabella: "giocatori",
      },
      {
        id: "giocatore_categoria",
        nome: "categoria",
        label: "Categoria",
        tipo: "text",
        tabella: "giocatori",
      },
      {
        id: "giocatore_ruolo",
        nome: "ruolo_1",
        label: "Ruolo",
        tipo: "text",
        tabella: "giocatori",
      },
      {
        id: "giocatore_reparto",
        nome: "reparto",
        label: "Reparto",
        tipo: "text",
        tabella: "giocatori",
      },
    ],
  },
  {
    id: "allenamenti",
    nome: "Allenamenti",
    descrizione: "Sedute e attività di allenamento",
    campi: [
      {
        id: "allenamento_data",
        nome: "data_allenamento",
        label: "Data allenamento",
        tipo: "date",
        tabella: "allenamenti",
      },
      {
        id: "allenamento_tipo",
        nome: "tipo_allenamento",
        label: "Tipo allenamento",
        tipo: "text",
        tabella: "allenamenti",
      },
      {
        id: "allenamento_luogo",
        nome: "luogo",
        label: "Luogo",
        tipo: "text",
        tabella: "allenamenti",
      },
    ],
  },
  {
    id: "presenze",
    nome: "Presenze",
    descrizione: "Presenze e assenze agli allenamenti",
    campi: [
      {
        id: "presenza_stato",
        nome: "stato",
        label: "Stato presenza",
        tipo: "text",
        tabella: "presenze_allenamenti",
      },
      {
        id: "presenza_totale",
        nome: "id",
        label: "Numero presenze",
        tipo: "number",
        tabella: "presenze_allenamenti",
      },
    ],
  },
  {
    id: "performance",
    nome: "Performance",
    descrizione: "Metriche GPS e Catapult",
    campi: [
      {
        id: "perf_distanza",
        nome: "total_distance",
        label: "Distanza totale",
        tipo: "number",
        tabella: "performance",
      },
      {
        id: "perf_velocita",
        nome: "max_velocity",
        label: "Velocità massima",
        tipo: "number",
        tabella: "performance",
      },
      {
        id: "perf_accelerazioni",
        nome: "accelerations",
        label: "Accelerazioni",
        tipo: "number",
        tabella: "performance",
      },
      {
        id: "perf_decelerazioni",
        nome: "decelerations",
        label: "Decelerazioni",
        tipo: "number",
        tabella: "performance",
      },
      {
        id: "perf_player_load",
        nome: "player_load",
        label: "Player Load",
        tipo: "number",
        tabella: "performance",
      },
    ],
  },
  {
    id: "test",
    nome: "Test",
    descrizione: "Test atletici e di forza",
    campi: [
      {
        id: "test_nome",
        nome: "nome",
        label: "Nome test",
        tipo: "text",
        tabella: "tipi_test",
      },
      {
        id: "test_data",
        nome: "data_test",
        label: "Data test",
        tipo: "date",
        tabella: "misurazioni_test",
      },
      {
        id: "test_valore",
        nome: "valore",
        label: "Valore test",
        tipo: "number",
        tabella: "misurazioni_test",
      },
      {
        id: "test_obiettivo",
        nome: "obiettivo",
        label: "Obiettivo",
        tipo: "number",
        tabella: "misurazioni_test",
      },
    ],
  },
];

/* =========================================================
   HELPERS
========================================================= */

function getFieldIcon(tipo: TipoCampo) {
  if (tipo === "number") {
    return <Hash className="h-3.5 w-3.5 text-sky-400" />;
  }

  if (tipo === "date") {
    return <CalendarDays className="h-3.5 w-3.5 text-amber-400" />;
  }

  return <Type className="h-3.5 w-3.5 text-zinc-500" />;
}

function getDefaultAggregation(
  tipo: TipoCampo,
  area: "asseX" | "valori" | "legenda",
): Aggregazione {
  if (area === "valori") {
    return tipo === "number" ? "somma" : "conteggio";
  }

  return "nessuna";
}

function renderVisualizationIcon(
  tipo: TipoVisualizzazione,
  className = "h-4 w-4",
) {
  switch (tipo) {
    case "bar":
      return <BarChart3 className={className} />;
    case "line":
      return <LineChart className={className} />;
    case "pie":
      return <PieChart className={className} />;
    case "table":
      return <Table2 className={className} />;
    case "kpi":
      return <Sigma className={className} />;
  }
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function NuovoReportPage() {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [sorgentiAperte, setSorgentiAperte] = useState<string[]>([
    "giocatori",
    "performance",
  ]);

  const [config, setConfig] = useState<ReportConfig>({
    titolo: "Nuovo report",
    descrizione: "",
    tipoVisualizzazione: "bar",
    sezionePerformance: "performance",
    asseX: [],
    valori: [],
    legenda: [],
    filtri: [],
  });

  const [campoSelezionato, setCampoSelezionato] =
    useState<CampoReport | null>(null);

  const [previewMode, setPreviewMode] = useState(false);

  /* =========================================================
     SEARCH FIELDS
  ========================================================= */

  const sorgentiFiltrate = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return SORGENTI_DATI;

    return SORGENTI_DATI.map((sorgente) => ({
      ...sorgente,
      campi: sorgente.campi.filter(
        (campo) =>
          campo.label.toLowerCase().includes(q) ||
          campo.nome.toLowerCase().includes(q),
      ),
    })).filter(
      (sorgente) =>
        sorgente.nome.toLowerCase().includes(q) ||
        sorgente.campi.length > 0,
    );
  }, [search]);

  /* =========================================================
     SOURCE ACCORDION
  ========================================================= */

  function toggleSorgente(id: string) {
    setSorgentiAperte((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id],
    );
  }

  /* =========================================================
     DRAG & DROP
  ========================================================= */

  function handleDragStart(
    event: DragEvent<HTMLDivElement>,
    campo: CampoDisponibile,
  ) {
    event.dataTransfer.setData(
      "application/report-field",
      JSON.stringify(campo),
    );

    event.dataTransfer.effectAllowed = "copy";
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
    area: "asseX" | "valori" | "legenda",
  ) {
    event.preventDefault();

    const raw = event.dataTransfer.getData(
      "application/report-field",
    );

    if (!raw) return;

    try {
      const campo = JSON.parse(raw) as CampoDisponibile;

      aggiungiCampo(area, campo);
    } catch {
      console.error("Campo trascinato non valido.");
    }
  }

  function aggiungiCampo(
    area: "asseX" | "valori" | "legenda",
    campo: CampoDisponibile,
  ) {
    setConfig((prev) => {
      const esiste = prev[area].some(
        (item) => item.id === campo.id,
      );

      if (esiste) return prev;

      const nuovoCampo: CampoReport = {
        ...campo,
        aggregazione: getDefaultAggregation(campo.tipo, area),
      };

      return {
        ...prev,
        [area]: [...prev[area], nuovoCampo],
      };
    });
  }

  function rimuoviCampo(
    area: "asseX" | "valori" | "legenda",
    campoId: string,
  ) {
    setConfig((prev) => ({
      ...prev,
      [area]: prev[area].filter(
        (campo) => campo.id !== campoId,
      ),
    }));

    if (campoSelezionato?.id === campoId) {
      setCampoSelezionato(null);
    }
  }

  function aggiornaAggregazione(
    area: "asseX" | "valori" | "legenda",
    campoId: string,
    aggregazione: Aggregazione,
  ) {
    setConfig((prev) => ({
      ...prev,
      [area]: prev[area].map((campo) =>
        campo.id === campoId
          ? {
              ...campo,
              aggregazione,
            }
          : campo,
      ),
    }));
  }

  /* =========================================================
     FILTERS
  ========================================================= */

  function aggiungiFiltro(campo: CampoDisponibile) {
    const nuovoFiltro: FiltroReport = {
      id: crypto.randomUUID(),
      campo,
      operatore:
        campo.tipo === "text"
          ? "uguale"
          : campo.tipo === "date"
            ? "tra"
            : "maggiore_di",
      valore: "",
    };

    setConfig((prev) => ({
      ...prev,
      filtri: [...prev.filtri, nuovoFiltro],
    }));
  }

  function rimuoviFiltro(id: string) {
    setConfig((prev) => ({
      ...prev,
      filtri: prev.filtri.filter(
        (filtro) => filtro.id !== id,
      ),
    }));
  }

  /* =========================================================
     RESET
  ========================================================= */

  const resetReport = useCallback(() => {
    setConfig({
      titolo: "Nuovo report",
      descrizione: "",
      tipoVisualizzazione: "bar",
      sezionePerformance: "performance",
      asseX: [],
      valori: [],
      legenda: [],
      filtri: [],
    });

    setCampoSelezionato(null);
  }, []);

  /* =========================================================
     SAVE
     Qui collegheremo la Server Action Supabase
  ========================================================= */

  async function salvaReport() {
  const result = await salvaReportPersonalizzato({
    nome: config.titolo,
    descrizione: config.descrizione,
    sezione_performance: config.sezionePerformance,
    tipo_visualizzazione: config.tipoVisualizzazione,
    configurazione: {
      titolo: config.titolo,
      descrizione: config.descrizione,
      tipoVisualizzazione: config.tipoVisualizzazione,
      sezionePerformance: config.sezionePerformance,
      asseX: config.asseX,
      valori: config.valori,
      legenda: config.legenda,
      filtri: config.filtri,
    },
  });

  showToast({
    type: result.success ? "success" : "error",
    message: result.message,
  });
}

  return (
    <div className="flex h-[calc(100vh-80px)] min-h-[720px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-white">
      {/* =====================================================
          LEFT PANEL - DATA
      ====================================================== */}

      <aside className="flex w-[290px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Dati
              </h2>

              <p className="mt-0.5 text-[11px] text-zinc-500">
                Campi disponibili
              </p>
            </div>

            <Database className="h-4 w-4 text-zinc-500" />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Cerca campo..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sorgentiFiltrate.map((sorgente) => {
            const aperta = sorgentiAperte.includes(
              sorgente.id,
            );

            return (
              <div
                key={sorgente.id}
                className="mb-1 overflow-hidden rounded-lg"
              >
                <button
                  type="button"
                  onClick={() =>
                    toggleSorgente(sorgente.id)
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-zinc-900"
                >
                  {aperta ? (
                    <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
                  )}

                  <Database className="h-3.5 w-3.5 text-violet-400" />

                  <span className="flex-1 text-xs font-medium text-zinc-200">
                    {sorgente.nome}
                  </span>

                  <span className="text-[10px] text-zinc-600">
                    {sorgente.campi.length}
                  </span>
                </button>

                {aperta && (
                  <div className="ml-4 border-l border-zinc-800 pl-2">
                    {sorgente.campi.map((campo) => (
                      <div
                        key={campo.id}
                        draggable
                        onDragStart={(event) =>
                          handleDragStart(event, campo)
                        }
                        className="group flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-zinc-900 active:cursor-grabbing"
                      >
                        <GripVertical className="h-3 w-3 text-transparent transition group-hover:text-zinc-600" />

                        {getFieldIcon(campo.tipo)}

                        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400 group-hover:text-zinc-200">
                          {campo.label}
                        </span>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            aggiungiFiltro(campo);
                          }}
                          title="Aggiungi filtro"
                          className="opacity-0 transition group-hover:opacity-100"
                        >
                          <Filter className="h-3 w-3 text-zinc-500 hover:text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* =====================================================
          CENTER
      ====================================================== */}

      <main className="flex min-w-0 flex-1 flex-col bg-zinc-900/40">
        {/* TOP TOOLBAR */}

        <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-5">
          <div className="min-w-0">
            <input
              value={config.titolo}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  titolo: event.target.value,
                }))
              }
              className="w-full max-w-[420px] bg-transparent text-sm font-semibold text-white outline-none"
            />

            <p className="mt-0.5 text-[10px] text-zinc-500">
              Report Builder
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetReport}
              className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>

            <button
              type="button"
              onClick={() =>
                setPreviewMode((prev) => !prev)
              }
              className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              <Eye className="h-3.5 w-3.5" />
              {previewMode ? "Modifica" : "Anteprima"}
            </button>

            <button
              type="button"
              onClick={salvaReport}
              className="flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black transition hover:bg-zinc-200"
            >
              <Save className="h-3.5 w-3.5" />
              Salva report
            </button>
          </div>
        </div>

        {/* REPORT CANVAS */}

        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto min-h-[600px] max-w-[1200px] rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {config.titolo || "Nuovo report"}
                </h3>

                <p className="mt-1 text-[11px] text-zinc-500">
                  Trascina i campi nel pannello di configurazione
                </p>
              </div>

              <button
                type="button"
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              <ReportPreview config={config} />
            </div>
          </div>
        </div>

        {/* BOTTOM FILTER BAR */}

        <div className="shrink-0 border-t border-zinc-800 bg-zinc-950">
          <div className="flex min-h-14 items-center gap-2 overflow-x-auto px-4">
            <div className="flex shrink-0 items-center gap-2 pr-2 text-xs font-medium text-zinc-400">
              <Filter className="h-3.5 w-3.5" />
              Filtri
            </div>

            {config.filtri.length === 0 ? (
              <span className="text-[11px] text-zinc-600">
                Nessun filtro applicato
              </span>
            ) : (
              config.filtri.map((filtro) => (
                <div
                  key={filtro.id}
                  className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5"
                >
                  <span className="text-[10px] text-zinc-300">
                    {filtro.campo.label}
                  </span>

                  <input
                    value={filtro.valore}
                    onChange={(event) => {
                      const valore = event.target.value;

                      setConfig((prev) => ({
                        ...prev,
                        filtri: prev.filtri.map((item) =>
                          item.id === filtro.id
                            ? {
                                ...item,
                                valore,
                              }
                            : item,
                        ),
                      }));
                    }}
                    placeholder="Valore..."
                    className="w-20 bg-transparent text-[10px] text-white outline-none placeholder:text-zinc-600"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      rimuoviFiltro(filtro.id)
                    }
                  >
                    <X className="h-3 w-3 text-zinc-600 hover:text-red-400" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* =====================================================
          RIGHT PANEL
      ====================================================== */}

      <aside className="flex w-[330px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 p-4">
          <h2 className="text-sm font-semibold text-white">
            Visualizzazione
          </h2>

          <p className="mt-0.5 text-[11px] text-zinc-500">
            Configura il grafico
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* CHART TYPES */}

          <section className="border-b border-zinc-800 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Tipo visualizzazione
            </p>

            <div className="grid grid-cols-5 gap-2">
              {(
                [
                  "bar",
                  "line",
                  "pie",
                  "table",
                  "kpi",
                ] as TipoVisualizzazione[]
              ).map((tipo) => {
                {renderVisualizationIcon(tipo, "h-4 w-4")}
                const active =
                  config.tipoVisualizzazione === tipo;

                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        tipoVisualizzazione: tipo,
                      }))
                    }
                    className={[
                      "flex aspect-square items-center justify-center rounded-lg border transition",
                      active
                        ? "border-white bg-white text-black"
                        : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-white",
                    ].join(" ")}
                  >
                    {renderVisualizationIcon(tipo, "h-4 w-4")}
                  </button>
                );
              })}
            </div>
          </section>

          {/* FIELD WELLS */}

          <section className="space-y-4 border-b border-zinc-800 p-4">
            <DropZone
              titolo="Asse X"
              descrizione="Categorie e dimensioni"
              campi={config.asseX}
              area="asseX"
              onDrop={handleDrop}
              onRemove={rimuoviCampo}
              onAggregationChange={aggiornaAggregazione}
              onSelect={setCampoSelezionato}
            />

            <DropZone
              titolo="Valori"
              descrizione="Metriche e misure"
              campi={config.valori}
              area="valori"
              onDrop={handleDrop}
              onRemove={rimuoviCampo}
              onAggregationChange={aggiornaAggregazione}
              onSelect={setCampoSelezionato}
            />

            <DropZone
              titolo="Legenda"
              descrizione="Suddivisione serie"
              campi={config.legenda}
              area="legenda"
              onDrop={handleDrop}
              onRemove={rimuoviCampo}
              onAggregationChange={aggiornaAggregazione}
              onSelect={setCampoSelezionato}
            />
          </section>

          {/* DESTINATION */}

          <section className="border-b border-zinc-800 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Mostra nella sezione
            </p>

            <div className="space-y-2">
              <DestinationButton
                active={
                  config.sezionePerformance === "presenze"
                }
                icon={Users}
                label="Presenze"
                description="Sezione presenze giocatori"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    sezionePerformance: "presenze",
                  }))
                }
              />

              <DestinationButton
                active={
                  config.sezionePerformance === "performance"
                }
                icon={Activity}
                label="Performance"
                description="Sezione performance atletiche"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    sezionePerformance: "performance",
                  }))
                }
              />

              <DestinationButton
                active={
                  config.sezionePerformance === "test"
                }
                icon={FlaskConical}
                label="Test"
                description="Sezione test e misurazioni"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    sezionePerformance: "test",
                  }))
                }
              />
            </div>
          </section>

          {/* SELECTED FIELD */}

          {campoSelezionato && (
            <section className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Proprietà campo
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setCampoSelezionato(null)
                  }
                >
                  <X className="h-3.5 w-3.5 text-zinc-600 hover:text-white" />
                </button>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center gap-2">
                  {getFieldIcon(campoSelezionato.tipo)}

                  <span className="text-xs font-medium text-white">
                    {campoSelezionato.label}
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">
                      Tabella
                    </span>

                    <span className="text-zinc-300">
                      {campoSelezionato.tabella}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-zinc-500">
                      Tipo
                    </span>

                    <span className="text-zinc-300">
                      {campoSelezionato.tipo}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

/* =========================================================
   DROP ZONE
========================================================= */

type DropZoneProps = {
  titolo: string;
  descrizione: string;
  campi: CampoReport[];
  area: "asseX" | "valori" | "legenda";
  onDrop: (
    event: DragEvent<HTMLDivElement>,
    area: "asseX" | "valori" | "legenda",
  ) => void;
  onRemove: (
    area: "asseX" | "valori" | "legenda",
    campoId: string,
  ) => void;
  onAggregationChange: (
    area: "asseX" | "valori" | "legenda",
    campoId: string,
    aggregazione: Aggregazione,
  ) => void;
  onSelect: (campo: CampoReport) => void;
};

function DropZone({
  titolo,
  descrizione,
  campi,
  area,
  onDrop,
  onRemove,
  onAggregationChange,
  onSelect,
}: DropZoneProps) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-[11px] font-medium text-zinc-300">
          {titolo}
        </p>

        <p className="text-[9px] text-zinc-600">
          {descrizione}
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => onDrop(event, area)}
        className={[
          "min-h-12 rounded-lg border border-dashed p-1.5 transition",
          campi.length > 0
            ? "border-zinc-800 bg-zinc-900/50"
            : "border-zinc-800 bg-zinc-900/20",
        ].join(" ")}
      >
        {campi.length === 0 ? (
          <div className="flex h-9 items-center justify-center gap-2 text-[10px] text-zinc-600">
            <MousePointer2 className="h-3 w-3" />
            Trascina qui un campo
          </div>
        ) : (
          <div className="space-y-1">
            {campi.map((campo) => (
              <div
                key={campo.id}
                onClick={() => onSelect(campo)}
                className="group flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5"
              >
                <GripVertical className="h-3 w-3 text-zinc-600" />

                {getFieldIcon(campo.tipo)}

                <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-300">
                  {campo.label}
                </span>

                {area === "valori" && (
                  <select
                    value={campo.aggregazione}
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                    onChange={(event) =>
                      onAggregationChange(
                        area,
                        campo.id,
                        event.target.value as Aggregazione,
                      )
                    }
                    className="max-w-[85px] bg-transparent text-[9px] text-zinc-500 outline-none"
                  >
                    <option value="somma">Somma</option>
                    <option value="media">Media</option>
                    <option value="min">Min</option>
                    <option value="max">Max</option>
                    <option value="conteggio">
                      Conteggio
                    </option>
                    <option value="conteggio_distinto">
                      Distinti
                    </option>
                  </select>
                )}

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(area, campo.id);
                  }}
                  className="opacity-0 transition group-hover:opacity-100"
                >
                  <X className="h-3 w-3 text-zinc-600 hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   DESTINATION BUTTON
========================================================= */

type DestinationButtonProps = {
  active: boolean;
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
};

function DestinationButton({
  active,
  icon: Icon,
  label,
  description,
  onClick,
}: DestinationButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition",
        active
          ? "border-white/30 bg-white/10"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-8 w-8 items-center justify-center rounded-lg",
          active
            ? "bg-white text-black"
            : "bg-zinc-800 text-zinc-400",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={[
            "text-[11px] font-medium",
            active ? "text-white" : "text-zinc-300",
          ].join(" ")}
        >
          {label}
        </p>

        <p className="mt-0.5 truncate text-[9px] text-zinc-600">
          {description}
        </p>
      </div>

      {active && (
        <div className="h-2 w-2 rounded-full bg-white" />
      )}
    </button>
  );
}

/* =========================================================
   REPORT PREVIEW
========================================================= */

function ReportPreview({
  config,
}: {
  config: ReportConfig;
}) {
 

  if (
    config.asseX.length === 0 &&
    config.valori.length === 0
  ) {
    return (
      <div className="flex min-h-[470px] items-center justify-center">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
            <BarChart3 className="h-6 w-6 text-zinc-500" />
          </div>

          <h3 className="mt-4 text-sm font-semibold text-white">
            Costruisci la visualizzazione
          </h3>

          <p className="mt-2 text-xs leading-5 text-zinc-500">
            Trascina una dimensione nell&apos;asse X e una
            metrica nei valori per generare il report.
          </p>
        </div>
      </div>
    );
  }

  if (config.tipoVisualizzazione === "table") {
    return (
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-left">
          <thead className="bg-zinc-900">
            <tr>
              {[...config.asseX, ...config.valori].map(
                (campo) => (
                  <th
                    key={campo.id}
                    className="border-b border-zinc-800 px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500"
                  >
                    {campo.label}
                  </th>
                ),
              )}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: 6 }).map((_, index) => (
              <tr
                key={index}
                className="border-b border-zinc-900"
              >
                {[...config.asseX, ...config.valori].map(
                  (campo) => (
                    <td
                      key={campo.id}
                      className="px-4 py-3 text-xs text-zinc-400"
                    >
                      {campo.tipo === "number"
                        ? `${Math.round(
                            50 + Math.random() * 950,
                          )}`
                        : `Dato ${index + 1}`}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (config.tipoVisualizzazione === "kpi") {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="min-w-[260px] rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <Sigma className="mx-auto h-5 w-5 text-zinc-500" />

          <p className="mt-4 text-xs text-zinc-500">
            {config.valori[0]?.label ??
              "Seleziona una metrica"}
          </p>

          <p className="mt-2 text-4xl font-bold tracking-tight text-white">
            1.284
          </p>

          <p className="mt-2 text-[10px] text-emerald-400">
            +12,4% rispetto al periodo precedente
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[470px]">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900">
          {renderVisualizationIcon(
            config.tipoVisualizzazione,
            "h-4 w-4 text-zinc-400",
            )}
        </div>

        <div>
          <p className="text-xs font-medium text-white">
            {config.valori[0]?.label ??
              "Metrica non selezionata"}
          </p>

          <p className="text-[10px] text-zinc-600">
            per{" "}
            {config.asseX[0]?.label ??
              "dimensione non selezionata"}
          </p>
        </div>
      </div>

      <FakeChart tipo={config.tipoVisualizzazione} />
    </div>
  );
}

/* =========================================================
   FAKE CHART
   Solo anteprima UI.
   Nel prossimo step lo sostituiamo con Recharts.
========================================================= */

function FakeChart({
  tipo,
}: {
  tipo: TipoVisualizzazione;
}) {
  const values = [48, 72, 55, 88, 63, 94, 76];

  if (tipo === "pie") {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div
          className="h-56 w-56 rounded-full"
          style={{
            background:
              "conic-gradient(#fafafa 0 32%, #a1a1aa 32% 58%, #52525b 58% 78%, #27272a 78% 100%)",
          }}
        >
          <div className="m-14 h-28 w-28 rounded-full bg-zinc-950" />
        </div>
      </div>
    );
  }

  if (tipo === "line") {
    return (
      <div className="relative flex h-[360px] items-end">
        <svg
          viewBox="0 0 700 300"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            y1="250"
            x2="700"
            y2="250"
            stroke="#27272a"
          />

          <line
            x1="0"
            y1="180"
            x2="700"
            y2="180"
            stroke="#27272a"
          />

          <line
            x1="0"
            y1="110"
            x2="700"
            y2="110"
            stroke="#27272a"
          />

          <polyline
            fill="none"
            stroke="#fafafa"
            strokeWidth="3"
            points="20,230 125,160 230,195 335,90 440,140 545,55 680,110"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex h-[360px] items-end gap-4 border-b border-zinc-800 px-4">
      {values.map((value, index) => (
        <div
          key={index}
          className="group flex h-full flex-1 items-end"
        >
          <div
            className="w-full rounded-t-md bg-zinc-200 transition hover:bg-white"
            style={{
              height: `${value}%`,
            }}
          />
        </div>
      ))}
    </div>
  );
}