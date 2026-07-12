"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, MessageCircle, Plus, Send, X } from "lucide-react";

type Conversazione = {
  id: string;
  titolo: string;
  created_at: string;
  updated_at: string;
};

type Messaggio = {
  id?: string;
  ruolo: "user" | "assistant";
  contenuto: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  created_at?: string;
};

type Props = {
  coloreFlag?: string | null;
};

export default function ClaudeChatbot({ coloreFlag }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [conversazioni, setConversazioni] = useState<Conversazione[]>([]);
  const [conversazioneId, setConversazioneId] = useState<string | null>(null);
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const brandColor = useMemo(() => coloreFlag || "#ffffff", [coloreFlag]);

  useEffect(() => {
    if (open) {
      loadConversazioni();
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi, loading]);

  async function loadConversazioni() {
    const res = await fetch("/api/ai/conversazioni");
    if (!res.ok) return;

    const data = (await res.json()) as Conversazione[];
    setConversazioni(data);
  }

  async function loadMessaggi(id: string) {
    setConversazioneId(id);

    const res = await fetch(`/api/ai/conversazioni/${id}/messaggi`);
    if (!res.ok) return;

    const data = (await res.json()) as Messaggio[];
    setMessaggi(data);
  }

  function nuovaChat() {
    setConversazioneId(null);
    setMessaggi([]);
    setMessage("");
  }

  async function sendMessage() {
    const cleanMessage = message.trim();

    if (!cleanMessage || loading) return;

    setLoading(true);
    setMessage("");

    setMessaggi((prev) => [
      ...prev,
      {
        ruolo: "user",
        contenuto: cleanMessage,
      },
    ]);

    try {
      const res = await fetch("/api/ai/claude", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: cleanMessage,
          conversazione_id: conversazioneId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessaggi((prev) => [
          ...prev,
          {
            ruolo: "assistant",
            contenuto: data?.error ?? "Errore durante la richiesta.",
          },
        ]);
        return;
      }

      setConversazioneId(data.conversazione_id);

      setMessaggi((prev) => [
        ...prev,
        {
          ruolo: "assistant",
          contenuto: data.text,
          input_tokens: data.usage?.input_tokens,
          output_tokens: data.usage?.output_tokens,
        },
      ]);

      await loadConversazioni();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-15 w-15 items-center justify-center rounded-2xl border border-white/10 bg-zinc-950 text-white shadow-2xl shadow-black/50 transition hover:scale-105"
          style={{
            boxShadow: `0 0 28px ${brandColor}55`,
            borderColor: `${brandColor}55`,
          }}
          aria-label="Apri assistente AI"
        >
          <div
            className="absolute inset-0 rounded-2xl opacity-20"
            style={{ backgroundColor: brandColor }}
          />
          <MessageCircle className="relative h-6 w-6" />
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex h-[680px] w-[440px] overflow-hidden rounded-3xl border bg-[#0b0b0d]/95 text-white shadow-2xl backdrop-blur-xl"
          style={{
            borderColor: `${brandColor}44`,
            boxShadow: `0 0 40px ${brandColor}22`,
          }}
        >
          

          <section className="flex min-w-0 flex-1 flex-col">
            <header className="border-b border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl text-black"
                    style={{ backgroundColor: brandColor }}
                  >
                    <Bot className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      Assistente AI
                    </p>
                    <p className="text-xs text-zinc-400">
                      Claude per Fabio - Gestione Club
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  aria-label="Chiudi assistente AI"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <main className="flex-1 space-y-3 overflow-y-auto bg-[#090909] p-4">
              {messaggi.length === 0 && (
                <div
                  className="rounded-3xl border bg-white/[0.04] p-4 text-sm leading-relaxed text-zinc-300"
                  style={{ borderColor: `${brandColor}33` }}
                >
                  Ciao, sono l'assistente AI del gestionale. Posso aiutarti con
                  giocatori, squadre, allenamenti, infortuni, report e codice.
                </div>
              )}

              {messaggi.map((m, index) => (
                <div
                  key={`${m.ruolo}-${index}`}
                  className={`flex ${
                    m.ruolo === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[84%] rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                      m.ruolo === "user"
                        ? "text-black"
                        : "border border-white/10 bg-white/[0.05] text-zinc-100"
                    }`}
                    style={
                      m.ruolo === "user"
                        ? { backgroundColor: brandColor }
                        : undefined
                    }
                  >
                    <p className="whitespace-pre-wrap">{m.contenuto}</p>

                    {m.ruolo === "assistant" &&
                      (m.input_tokens || m.output_tokens) && (
                        <p className="mt-2 text-[10px] text-zinc-500">
                          Input: {m.input_tokens ?? 0} · Output:{" "}
                          {m.output_tokens ?? 0} token
                        </p>
                      )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-zinc-400">
                    Claude sta scrivendo...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </main>

            <footer className="border-t border-white/10 bg-[#0b0b0d] p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Scrivi un messaggio..."
                  className="max-h-28 min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/30"
                />

                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={loading || !message.trim()}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: brandColor }}
                  aria-label="Invia messaggio"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}