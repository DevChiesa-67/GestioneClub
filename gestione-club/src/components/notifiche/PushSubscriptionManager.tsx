"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/*
 * Componente invisibile: registra il service worker, chiede il
 * permesso di notifica al browser e registra la subscription push
 * sul server. Va montato una volta sola nel layout autenticato.
 *
 * Ogni punto in cui la registrazione può fallire mostra un toast:
 * prima questi errori finivano solo in console (irraggiungibile su
 * un telefono) e rendevano impossibile capire perché un dispositivo
 * restava senza notifiche push attive.
 */
export function PushSubscriptionManager() {
  const { showToast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!window.isSecureContext) {
      showToast({
        type: "error",
        title: "Notifiche push non disponibili",
        message:
          "Questa pagina non è servita in HTTPS (né è localhost): il browser blocca le notifiche push su connessioni non sicure.",
      });

      return;
    }

    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      showToast({
        type: "error",
        title: "Notifiche push non supportate",
        message:
          "Questo browser/dispositivo non supporta le notifiche push web (su iPhone serve aggiungere il gestionale alla schermata Home e aprirlo da lì).",
      });

      return;
    }

    let cancelled = false;

    async function setup() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        if (cancelled) return;

        let permission = Notification.permission;

        if (permission === "default") {
          permission = await Notification.requestPermission();
        }

        if (cancelled) return;

        if (permission !== "granted") {
          showToast({
            type: "info",
            title: "Notifiche push disattivate",
            message:
              permission === "denied"
                ? "Il permesso 'Notifiche' è bloccato per questo sito. Sbloccalo dalle impostazioni del browser (icona lucchetto/informazioni sito) e ricarica la pagina."
                : "Permesso notifiche non concesso.",
          });

          return;
        }

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!publicKey) {
          showToast({
            type: "error",
            title: "Notifiche push non configurate",
            message:
              "Manca la chiave pubblica VAPID nell'app: chi ha pubblicato/deployato il gestionale deve impostare NEXT_PUBLIC_VAPID_PUBLIC_KEY prima della build (le variabili NEXT_PUBLIC_ vengono incorporate in fase di build, non a runtime).",
          });

          return;
        }

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        if (cancelled || !subscription) return;

        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });

        if (cancelled) return;

        if (!response.ok) {
          const result = await response.json().catch(() => null);

          showToast({
            type: "error",
            title: "Dispositivo non registrato",
            message:
              result?.message ||
              result?.error ||
              `Il server ha rifiutato la registrazione (HTTP ${response.status}).`,
          });

          return;
        }

        if (!sessionStorage.getItem("push_ok_toast_shown")) {
          sessionStorage.setItem("push_ok_toast_shown", "1");

          showToast({
            type: "success",
            title: "Notifiche push attive",
            message: "Questo dispositivo è registrato e riceverà le notifiche push.",
          });
        }
      } catch (error) {
        console.error("Errore configurazione notifiche push:", error);

        if (!cancelled) {
          showToast({
            type: "error",
            title: "Notifiche push non attivate",
            message:
              error instanceof Error
                ? error.message
                : "Errore imprevisto durante l'attivazione delle notifiche push.",
          });
        }
      }
    }

    void setup();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  return null;
}
