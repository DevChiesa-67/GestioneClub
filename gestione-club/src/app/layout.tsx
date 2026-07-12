import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestione Club",
  description: "Gestionale per club sportivi",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Gestione Club",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="it">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}