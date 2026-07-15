"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, X, type LucideIcon } from "lucide-react";

type ToastType = "success" | "error" | "info";

type ToastInput = {
  type?: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
  onClick?: () => void;
  /*
   * Colore accento (es. colore_flag del club) da usare al posto del
   * colore semantico predefinito: pensato per notifiche "di
   * gestionale" come le comunicazioni, per restare coerenti con il
   * tema del club invece di un generico blu/grigio.
   */
  accentColor?: string;
  /*
   * Icona custom al posto di quella predefinita per il "type": usata
   * ad es. per le comunicazioni, per indicare a colpo d'occhio se sono
   * dirette a tutti, a un gruppo o a te specificamente.
   */
  icon?: LucideIcon;
};

type ToastItem = ToastInput & {
  id: number;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

/*
 * Stile allineato al resto del gestionale (card/dropdown scure con
 * bordo bianco trasparente, es. Topbar): il tipo di toast cambia solo
 * il colore dell'icona/barra laterale, non più tutto lo sfondo.
 */
const CARD_STYLE = "border-white/10 bg-[#171717] text-zinc-200";

const ICON_STYLES: Record<ToastType, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  info: "text-zinc-400",
};

const ACCENT_BAR_COLOR: Record<ToastType, string> = {
  success: "#34d399",
  error: "#f87171",
  info: "#71717a",
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = nextId++;
      const type = toast.type ?? "info";
      const durationMs =
        toast.durationMs ?? (type === "error" ? 8000 : 5000);

      setToasts((prev) => [...prev, { ...toast, id, type }]);

      if (durationMs > 0) {
        setTimeout(() => dismissToast(id), durationMs);
      }
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-4 z-[2147483647] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
            {toasts.map((toast) => {
              const Icon = toast.icon ?? ICONS[toast.type];
              const accent = toast.accentColor || ACCENT_BAR_COLOR[toast.type];

              return (
                <div
                  key={toast.id}
                  onClick={() => {
                    if (toast.onClick) {
                      toast.onClick();
                      dismissToast(toast.id);
                    }
                  }}
                  role={toast.onClick ? "button" : undefined}
                  style={{ borderLeft: `3px solid ${accent}` }}
                  className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border py-3.5 pl-3.5 pr-4 shadow-2xl backdrop-blur-xl ${CARD_STYLE} ${
                    toast.onClick ? "cursor-pointer hover:bg-white/[0.03]" : ""
                  }`}
                >
                  <Icon
                    size={20}
                    className={`mt-0.5 shrink-0 ${
                      toast.accentColor ? "" : ICON_STYLES[toast.type]
                    }`}
                    style={toast.accentColor ? { color: accent } : undefined}
                  />

                  <div className="min-w-0 flex-1">
                    {toast.title && (
                      <p className="text-sm font-bold text-white">
                        {toast.title}
                      </p>
                    )}

                    <p className="whitespace-pre-line text-sm leading-6 text-zinc-400">
                      {toast.message}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      dismissToast(toast.id);
                    }}
                    className="shrink-0 rounded-lg p-1 text-zinc-500 transition hover:bg-white/10 hover:text-white"
                    aria-label="Chiudi notifica"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast deve essere usato dentro <ToastProvider>.");
  }

  return context;
}
