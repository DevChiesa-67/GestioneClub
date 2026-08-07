"use client";

import { Download, X } from "lucide-react";

type Props = {
  blobUrl: string;
  nomeFile: string;
  themeColor: string;
  onDownload: () => void;
  onClose: () => void;
};

export default function PdfPreviewModal({
  blobUrl,
  nomeFile,
  themeColor,
  onDownload,
  onClose,
}: Props) {
  return (
    <div className="flex h-full max-h-[90vh] flex-col space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-black text-white sm:text-2xl">
            Anteprima PDF
          </h2>
          <p className="mt-1 truncate text-sm text-zinc-400">{nomeFile}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-xl border border-white/10 p-2.5 text-zinc-400 transition hover:bg-white/5 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        <iframe
          src={blobUrl}
          title={nomeFile}
          className="h-full min-h-[60vh] w-full"
        />
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5"
        >
          Chiudi
        </button>

        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:brightness-110"
          style={{
            backgroundColor: themeColor,
            boxShadow: `0 16px 36px ${themeColor}38`,
          }}
        >
          <Download className="h-4 w-4" />
          Scarica PDF
        </button>
      </div>
    </div>
  );
}
