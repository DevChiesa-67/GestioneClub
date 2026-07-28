"use client";

/*
 * Anteprima per il campo "Immagine/video lavoro": l'input resta un
 * semplice URL (nessun upload), ma qui viene rilevato il tipo di
 * contenuto e mostrata un'anteprima incorporata, cosi' che chi
 * compila la scheda veda subito cosa verra' mostrato/allegato.
 */

const ESTENSIONI_IMMAGINE = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
const ESTENSIONI_VIDEO = [
  ".mp4",
  ".mov",
  ".webm",
  ".m4v",
  ".avi",
  ".mkv",
  ".ogg",
];

function estraiIdYoutube(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
  );

  return match ? match[1] : null;
}

function estraiIdVimeo(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);

  return match ? match[1] : null;
}

function haEstensione(url: string, estensioni: string[]) {
  const pulito = url.split("?")[0].split("#")[0].toLowerCase();

  return estensioni.some((ext) => pulito.endsWith(ext));
}

export type TipoMediaLavoro =
  | "immagine"
  | "youtube"
  | "vimeo"
  | "video"
  | null;

/**
 * Determina come trattare l'URL inserito. Se non riconosciamo
 * un'estensione nota (capita con URL firmati di storage, senza
 * estensione in fondo) ripieghiamo su "immagine": è il caso più
 * comune per questo campo, e un <img> che fallisce a caricare non
 * rompe comunque nulla (viene semplicemente nascosto).
 */
export function tipoMediaLavoro(url: string): TipoMediaLavoro {
  const pulito = url.trim();

  if (!pulito) return null;

  if (estraiIdYoutube(pulito)) return "youtube";
  if (estraiIdVimeo(pulito)) return "vimeo";
  if (haEstensione(pulito, ESTENSIONI_VIDEO)) return "video";
  if (haEstensione(pulito, ESTENSIONI_IMMAGINE)) return "immagine";

  return "immagine";
}

type Props = {
  url: string;
};

export function AnteprimaMediaLavoro({ url }: Props) {
  const pulito = url.trim();

  if (!pulito) return null;

  const tipo = tipoMediaLavoro(pulito);

  if (tipo === "youtube") {
    const id = estraiIdYoutube(pulito);

    return (
      <div className="mt-2 aspect-video w-full max-w-xs overflow-hidden rounded-xl border border-zinc-700 bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${id}`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (tipo === "vimeo") {
    const id = estraiIdVimeo(pulito);

    return (
      <div className="mt-2 aspect-video w-full max-w-xs overflow-hidden rounded-xl border border-zinc-700 bg-black">
        <iframe
          src={`https://player.vimeo.com/video/${id}`}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (tipo === "video") {
    return (
      <video
        src={pulito}
        controls
        className="mt-2 max-h-40 w-full max-w-xs rounded-xl border border-zinc-700 bg-black"
      />
    );
  }

  return (
    <img
      src={pulito}
      alt="Anteprima immagine lavoro"
      className="mt-2 max-h-40 w-auto max-w-xs rounded-xl border border-zinc-700 object-contain"
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
      onLoad={(event) => {
        event.currentTarget.style.display = "";
      }}
    />
  );
}
