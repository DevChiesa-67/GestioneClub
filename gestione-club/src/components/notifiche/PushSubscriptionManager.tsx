"use client";

import { useEffect } from "react";

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
 */
export function PushSubscriptionManager() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
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

        if (permission !== "granted" || cancelled) return;

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!publicKey) {
          console.error("VAPID public key mancante.");
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

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
      } catch (error) {
        console.error("Errore configurazione notifiche push:", error);
      }
    }

    void setup();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
