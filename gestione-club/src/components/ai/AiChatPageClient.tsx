"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Clock3,
  LoaderCircle,
  PanelRightOpen,
  X,
} from "lucide-react";

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
};

type Props = {
  coloreFlag?: string | null;
};

export default function AiChatPageClient({ coloreFlag }: Props) {
  const [conversazioni, setConversazioni] = useState<Conversazione[]>([]);
  const [conversazioneId, setConversazioneId] = useState<string | null>(null);
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);

  const brandColor = useMemo(
    () => coloreFlag?.trim() || "#ffffff",
    [coloreFlag]
  );

  useEffect(() => {
    loadConversazioni();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messaggi, loading]);

  async function loadConversazioni() {
    const res = await fetch("/api/ai/conversazioni");
    if (!res.ok) return;

    setConversazioni(await res.json());
  }

  async function loadMessaggi(id: string) {
    setConversazioneId(id);
    setMobileHistoryOpen(false);

    const res = await fetch(`/api/ai/conversazioni/${id}/messaggi`);
    if (!res.ok) return;

    setMessaggi(await res.json());
  }

  function nuovaChat() {
    setConversazioneId(null);
    setMessaggi([]);
    setMessage("");
    setMobileHistoryOpen(false);
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

  const conversationsPanel = (
    <aside
      className="
        flex
        min-h-0
        flex-col
        border-l
        border-white/[0.07]
        bg-[#0A0A0B]/95
        p-4
        backdrop-blur-2xl
      "
    >
      <div
        className="
          relative
          mb-4
          overflow-hidden
          rounded-[22px]
          border
          border-white/[0.08]
          bg-gradient-to-br
          from-white/[0.07]
          to-white/[0.025]
          p-4
        "
      >
        <div
          className="
            pointer-events-none
            absolute
            -right-10
            -top-10
            h-28
            w-28
            rounded-full
            blur-3xl
          "
          style={{ backgroundColor: `${brandColor}20` }}
        />

        <div className="relative flex items-start gap-3">
          <div
            className="
              flex
              h-11
              w-11
              shrink-0
              items-center
              justify-center
              rounded-[14px]
              text-black
            "
            style={{
              background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)`,
              boxShadow: `0 10px 30px ${brandColor}25`,
            }}
          >
            <Bot className="h-5 w-5" />
          </div>

          <div className="min-w-0 pt-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-[-0.01em]">
                AI Chat
              </h2>

              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: brandColor,
                  boxShadow: `0 0 10px ${brandColor}`,
                }}
              />
            </div>

            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Storico conversazioni
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={nuovaChat}
        className="
          group
          relative
          mb-5
          flex
          w-full
          items-center
          justify-center
          gap-2
          overflow-hidden
          rounded-[16px]
          px-4
          py-3
          text-sm
          font-semibold
          text-black
          transition-all
          duration-300
          hover:-translate-y-0.5
          active:translate-y-0
        "
        style={{
          background: `linear-gradient(135deg, ${brandColor}, ${brandColor}D9)`,
          boxShadow: `0 12px 30px ${brandColor}1C`,
        }}
      >
        <span
          className="
            absolute
            inset-y-0
            -left-20
            w-16
            rotate-12
            bg-white/30
            blur-xl
            transition-all
            duration-700
            group-hover:left-[110%]
          "
        />

        <Plus className="relative h-4 w-4" />
        <span className="relative">Nuova chat</span>
      </button>

      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Clock3 className="h-3.5 w-3.5 text-zinc-600" />

          <p
            className="
              text-[10px]
              font-semibold
              uppercase
              tracking-[0.18em]
              text-zinc-600
            "
          >
            Conversazioni
          </p>
        </div>

        <span
          className="
            flex
            min-w-6
            items-center
            justify-center
            rounded-full
            border
            border-white/[0.07]
            bg-white/[0.035]
            px-2
            py-0.5
            text-[10px]
            font-medium
            text-zinc-500
          "
        >
          {conversazioni.length}
        </span>
      </div>

      <div
        className="
          min-h-0
          flex-1
          space-y-1.5
          overflow-y-auto
          pr-1
          [scrollbar-color:rgba(255,255,255,0.12)_transparent]
          [scrollbar-width:thin]
        "
      >
        {conversazioni.map((conv) => {
          const active = conversazioneId === conv.id;

          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => loadMessaggi(conv.id)}
              className={`
                group
                relative
                w-full
                overflow-hidden
                rounded-[15px]
                border
                px-3.5
                py-3
                text-left
                transition-all
                duration-200

                ${
                  active
                    ? "bg-white/[0.07] text-white"
                    : `
                      border-transparent
                      text-zinc-400
                      hover:border-white/[0.06]
                      hover:bg-white/[0.035]
                      hover:text-white
                    `
                }
              `}
              style={
                active
                  ? {
                      borderColor: `${brandColor}42`,
                      boxShadow: `inset 0 0 24px ${brandColor}08`,
                    }
                  : undefined
              }
            >
              {active && (
                <span
                  className="
                    absolute
                    bottom-3
                    right-0
                    top-3
                    w-[2px]
                    rounded-full
                  "
                  style={{
                    backgroundColor: brandColor,
                    boxShadow: `0 0 10px ${brandColor}`,
                  }}
                />
              )}

              <span className="line-clamp-2 text-[13px] font-medium leading-5">
                {conv.titolo}
              </span>

              <span
                className="
                  mt-1.5
                  block
                  text-[10px]
                  text-zinc-600
                  transition-colors
                  group-hover:text-zinc-500
                "
              >
                {new Date(conv.updated_at).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );

  return (
    <div
      className="
        relative
        grid
        h-[calc(100vh-120px)]
        grid-cols-1
        overflow-hidden
        rounded-[28px]
        border
        bg-[#070708]
        text-white
        lg:grid-cols-[minmax(0,1fr)_340px]
      "
      style={{
        borderColor: `${brandColor}2B`,
        boxShadow: `
          0 30px 80px rgba(0,0,0,0.50),
          0 0 0 1px ${brandColor}0A,
          0 0 70px ${brandColor}0D
        `,
      }}
    >
      <div
        className="
          pointer-events-none
          absolute
          -right-24
          -top-32
          h-[420px]
          w-[420px]
          rounded-full
          blur-[110px]
        "
        style={{ backgroundColor: `${brandColor}18` }}
      />

      <div
        className="
          pointer-events-none
          absolute
          -bottom-52
          left-[280px]
          h-[420px]
          w-[420px]
          rounded-full
          blur-[130px]
        "
        style={{ backgroundColor: `${brandColor}0C` }}
      />

<section className="relative z-10 flex min-h-0 min-w-0 flex-col overflow-hidden">        <header
          className="
            flex
            items-center
            justify-between
            border-b
            border-white/[0.07]
            bg-[#0A0A0B]/75
            px-4
            py-4
            backdrop-blur-2xl
            md:px-6
          "
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="relative shrink-0">
              <div
                className="
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-[15px]
                  text-black
                "
                style={{
                  background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)`,
                  boxShadow: `0 10px 30px ${brandColor}22`,
                }}
              >
                <Sparkles className="h-5 w-5" />
              </div>

              <span
                className="
                  absolute
                  -bottom-0.5
                  -right-0.5
                  h-3
                  w-3
                  rounded-full
                  border-[3px]
                  border-[#0A0A0B]
                "
                style={{ backgroundColor: brandColor }}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-semibold tracking-[-0.02em]">
                  Claude AI
                </h1>

                <span
                  className="
                    rounded-full
                    border
                    px-2
                    py-0.5
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-wider
                  "
                  style={{
                    color: brandColor,
                    borderColor: `${brandColor}30`,
                    backgroundColor: `${brandColor}0D`,
                  }}
                >
                  Online
                </span>
              </div>

              <p className="mt-0.5 truncate text-xs text-zinc-500">
                Assistente intelligente per il club attivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="
                hidden
                items-center
                gap-2
                rounded-full
                border
                border-white/[0.07]
                bg-white/[0.03]
                px-3
                py-1.5
                text-[11px]
                text-zinc-500
                md:flex
              "
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: brandColor }}
              />

              {conversazioneId
                ? "Conversazione salvata"
                : "Nuova conversazione"}
            </div>

            <button
              type="button"
              onClick={() => setMobileHistoryOpen(true)}
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-[14px]
                border
                border-white/[0.08]
                bg-white/[0.045]
                text-zinc-300
                lg:hidden
              "
              aria-label="Apri conversazioni"
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main
          className="
            relative
    min-h-0
    flex-1
    space-y-6
    overflow-y-auto
            bg-[#080809]
            px-4
            py-5
            md:px-6
            md:py-7
            [scrollbar-color:rgba(255,255,255,0.12)_transparent]
            [scrollbar-width:thin]
          "
        >
          {messaggi.length === 0 && (
            <div className="grid h-full place-items-center">
              <div
                className="
                  relative
                  max-w-lg
                  overflow-hidden
                  rounded-[28px]
                  border
                  border-white/[0.08]
                  bg-gradient-to-br
                  from-white/[0.06]
                  to-white/[0.02]
                  px-6
                  py-8
                  text-center
                  shadow-2xl
                  backdrop-blur-xl
                  md:px-8
                  md:py-9
                "
              >
                <div
                  className="
                    pointer-events-none
                    absolute
                    left-1/2
                    top-0
                    h-32
                    w-56
                    -translate-x-1/2
                    rounded-full
                    blur-[70px]
                  "
                  style={{ backgroundColor: `${brandColor}18` }}
                />

                <div
                  className="
                    relative
                    mx-auto
                    mb-5
                    flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    rounded-[18px]
                    text-black
                  "
                  style={{
                    background: `linear-gradient(135deg, ${brandColor}, ${brandColor}CC)`,
                    boxShadow: `0 14px 40px ${brandColor}20`,
                  }}
                >
                  <MessageCircle className="h-6 w-6" />
                </div>

                <h2 className="relative text-xl font-semibold tracking-[-0.03em]">
                  Inizia una nuova chat
                </h2>

                <p className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  Puoi chiedere analisi su giocatori, allenamenti,
                  infortuni, report o supporto sul codice del gestionale.
                </p>
              </div>
            </div>
          )}

          {messaggi.map((m, index) => {
            const isUser = m.ruolo === "user";

            return (
              <div
                key={`${m.ruolo}-${index}`}
                className={`
                  flex
                  items-end
                  gap-2.5
                  ${isUser ? "justify-end" : "justify-start"}
                `}
              >
                {!isUser && (
                  <div
                    className="
                      mb-1
                      hidden
                      h-8
                      w-8
                      shrink-0
                      items-center
                      justify-center
                      rounded-[11px]
                      text-black
                      sm:flex
                    "
                    style={{
                      backgroundColor: brandColor,
                      boxShadow: `0 8px 22px ${brandColor}18`,
                    }}
                  >
                    <Bot className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`
                    max-w-[88%]
                    px-4
                    py-3.5
                    text-sm
                    leading-6
                    shadow-lg
                    md:max-w-[78%]
                    md:px-5

                    ${
                      isUser
                        ? `
                          rounded-[20px]
                          rounded-br-[7px]
                          text-black
                        `
                        : `
                          rounded-[20px]
                          rounded-bl-[7px]
                          border
                          border-white/[0.08]
                          bg-white/[0.055]
                          text-zinc-200
                          backdrop-blur-xl
                        `
                    }
                  `}
                  style={
                    isUser
                      ? {
                          background: `linear-gradient(135deg, ${brandColor}, ${brandColor}D9)`,
                          boxShadow: `0 12px 30px ${brandColor}12`,
                        }
                      : undefined
                  }
                >
                  <p className="whitespace-pre-wrap">{m.contenuto}</p>

                  {!isUser && (m.input_tokens || m.output_tokens) && (
                    <div
                      className="
                        mt-3
                        flex
                        items-center
                        gap-2
                        border-t
                        border-white/[0.07]
                        pt-2.5
                        text-[10px]
                        text-zinc-600
                      "
                    >
                      <span>Input {m.input_tokens ?? 0}</span>
                      <span className="text-zinc-700">•</span>
                      <span>Output {m.output_tokens ?? 0}</span>
                      <span>token</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-end gap-2.5">
              <div
                className="
                  mb-1
                  hidden
                  h-8
                  w-8
                  shrink-0
                  items-center
                  justify-center
                  rounded-[11px]
                  text-black
                  sm:flex
                "
                style={{ backgroundColor: brandColor }}
              >
                <Bot className="h-4 w-4" />
              </div>

              <div
                className="
                  flex
                  items-center
                  gap-2.5
                  rounded-[20px]
                  rounded-bl-[7px]
                  border
                  border-white/[0.08]
                  bg-white/[0.055]
                  px-4
                  py-3
                  text-xs
                  text-zinc-500
                  backdrop-blur-xl
                "
              >
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Claude sta scrivendo...
              </div>
            </div>
          )}

          <div ref={endRef} />
        </main>

        <footer
          className="
            border-t
            border-white/[0.07]
            bg-[#0A0A0B]/90
            p-3
            backdrop-blur-2xl
            md:p-4
          "
        >
          <div
            className="
              group
              flex
              items-end
              gap-2
              rounded-[20px]
              border
              border-white/[0.09]
              bg-white/[0.04]
              p-2
              transition-all
              duration-300
              focus-within:bg-white/[0.055]
              md:gap-3
            "
            style={{
              boxShadow: "0 12px 40px rgba(0,0,0,0.20)",
            }}
          >
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
              className="
                max-h-36
                min-h-12
                flex-1
                resize-none
                bg-transparent
                px-3
                py-3
                text-sm
                leading-6
                text-white
                outline-none
                placeholder:text-zinc-600
              "
            />

            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !message.trim()}
              className="
                flex
                h-11
                w-11
                shrink-0
                items-center
                justify-center
                rounded-[14px]
                text-black
                transition-all
                duration-200
                hover:-translate-y-0.5
                hover:scale-[1.03]
                active:translate-y-0
                disabled:cursor-not-allowed
                disabled:opacity-30
                disabled:hover:scale-100
              "
              style={{
                background: `linear-gradient(135deg, ${brandColor}, ${brandColor}D9)`,
                boxShadow: message.trim()
                  ? `0 10px 28px ${brandColor}20`
                  : "none",
              }}
              aria-label="Invia messaggio"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2 hidden text-center text-[10px] text-zinc-700 sm:block">
            Invio con Enter · Nuova riga con Shift + Enter
          </p>
        </footer>
      </section>

<div className="relative z-10 hidden min-h-0 overflow-hidden lg:block">        {conversationsPanel}
      </div>

      {mobileHistoryOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileHistoryOpen(false)}
            aria-label="Chiudi conversazioni"
          />

          <div
            className="
              absolute
              bottom-0
              right-0
              top-0
              flex
              w-[86vw]
              max-w-[360px]
              flex-col
              border-l
              border-white/[0.08]
              bg-[#0A0A0B]
              shadow-2xl
            "
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Conversazioni</p>
                <p className="text-xs text-zinc-500">
                  Storico chat AI
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMobileHistoryOpen(false)}
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-white/[0.08]
                  bg-white/[0.04]
                  text-zinc-300
                "
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1">
              {conversationsPanel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}