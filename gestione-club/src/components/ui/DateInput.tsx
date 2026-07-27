"use client";

// src/components/ui/DateInput.tsx
//
// Campo data riutilizzabile: mostra e accetta sempre il formato
// italiano GG/MM/AAAA (indipendentemente dalla lingua del browser)
// e include un'icona calendario per aprire il selettore data nativo.
// Il valore esposto a onChange resta in formato ISO (YYYY-MM-DD),
// così da restare compatibile con Supabase/Postgres.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDataIT, parseDataIT } from "@/lib/date";

type DateInputProps = {
  label?: string;
  /** Modalità controllata: valore ISO gestito dal genitore. */
  value?: string | null;
  onChange?: (isoValue: string) => void;
  /**
   * Modalità non controllata (form basati su FormData/action): il
   * campo nativo nascosto riceve questo `name`, così da comparire
   * automaticamente nel FormData del form che lo contiene.
   */
  name?: string;
  defaultValue?: string | null;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
  inputClassName?: string;
  iconClassName?: string;
  labelClassName?: string;
};

export function DateInput({
  label,
  value,
  onChange,
  name,
  defaultValue,
  min,
  max,
  placeholder = "GG/MM/AAAA",
  disabled = false,
  required = false,
  wrapperClassName,
  wrapperStyle,
  inputClassName,
  iconClassName,
  labelClassName,
}: DateInputProps) {
  const isControlled = value !== undefined;
  const nativeRef = useRef<HTMLInputElement>(null);

  const [isoInterno, setIsoInterno] = useState(defaultValue ?? "");
  const isoValue = isControlled ? value ?? "" : isoInterno;

  const [testo, setTesto] = useState(() => isoToTesto(isoValue));

  useEffect(() => {
    setTesto(isoToTesto(isoValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isoValue]);

  function isoToTesto(iso: string) {
    const formattata = formatDataIT(iso);
    return formattata === "-" ? "" : formattata;
  }

  function commitIso(iso: string) {
    if (!isControlled) {
      setIsoInterno(iso);
    }

    onChange?.(iso);
  }

  function handleTextChange(raw: string) {
    const cifre = raw.replace(/\D/g, "").slice(0, 8);
    let formattato = cifre;

    if (cifre.length > 4) {
      formattato = `${cifre.slice(0, 2)}/${cifre.slice(2, 4)}/${cifre.slice(4)}`;
    } else if (cifre.length > 2) {
      formattato = `${cifre.slice(0, 2)}/${cifre.slice(2)}`;
    }

    setTesto(formattato);

    if (formattato === "") {
      commitIso("");
      return;
    }

    const iso = parseDataIT(formattato);

    if (iso) {
      commitIso(iso);
    }
  }

  function openPicker() {
    if (disabled) return;

    const input = nativeRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // Alcuni browser rifiutano showPicker in certi contesti:
        // si ricade sul comportamento nativo di focus/click.
      }
    }

    input.focus();
    input.click();
  }

  return (
    <label className="block">
      {label && (
        <span
          className={cn(
            "mb-2 block text-sm font-medium text-zinc-400",
            labelClassName,
          )}
        >
          {label}
          {required && " *"}
        </span>
      )}

      <div
        className={cn(
          "relative flex items-center rounded-xl border border-white/10 bg-black/30 transition focus-within:border-[#d71920] focus-within:ring-4 focus-within:ring-[#d71920]/10",
          disabled && "cursor-not-allowed opacity-40",
          wrapperClassName,
        )}
        style={wrapperStyle}
      >
        <input
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          maxLength={10}
          value={testo}
          disabled={disabled}
          onChange={(e) => handleTextChange(e.target.value)}
          className={cn(
            "w-full bg-transparent px-4 py-3 text-white outline-none placeholder:text-zinc-600",
            inputClassName,
          )}
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={openPicker}
          aria-label="Apri calendario"
          className={cn(
            "flex items-center px-3 text-zinc-400 transition hover:text-white disabled:cursor-not-allowed",
            iconClassName,
          )}
        >
          <Calendar size={18} />
        </button>

        {/*
         * Input nativo invisibile: fornisce il vero selettore data del
         * browser (aperto via showPicker) senza dover reimplementare
         * un calendario custom.
         */}
        <input
          ref={nativeRef}
          name={name}
          type="date"
          tabIndex={-1}
          required={required}
          min={min}
          max={max}
          disabled={disabled}
          value={isoValue}
          onChange={(e) => commitIso(e.target.value)}
          className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
          aria-hidden="true"
        />
      </div>
    </label>
  );
}
