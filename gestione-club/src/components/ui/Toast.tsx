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
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

type ToastInput = {
  type?: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
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

const STYLES: Record<ToastType, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  error: "border-red-500/30 bg-red-500/10 text-red-300",
  info: "border-zinc-700 bg-zinc-900 text-zinc-200",
};

const ICON_STYLES: Record<ToastType, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  info: "text-zinc-400",
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
              const Icon = ICONS[toast.type];

              return (
                <div
                  key={toast.id}
                  className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl ${STYLES[toast.type]}`}
                >
                  <Icon
                    size={20}
                    className={`mt-0.5 shrink-0 ${ICON_STYLES[toast.type]}`}
                  />

                  <div className="min-w-0 flex-1">
                    {toast.title && (
                      <p className="text-sm font-bold text-white">
                        {toast.title}
                      </p>
                    )}

                    <p className="whitespace-pre-line text-sm leading-6 text-zinc-200">
                      {toast.message}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="shrink-0 rounded-lg p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
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
