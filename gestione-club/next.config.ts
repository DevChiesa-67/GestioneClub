import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Gli allegati medici arrivano tramite Server Actions. Il limite include
    // anche l'overhead multipart, quindi resta leggermente sopra i 10 MB
    // consentiti e validati dall'action.
    serverActions: {
      bodySizeLimit: "55mb",
    },
    proxyClientMaxBodySize: "55mb",
  },
  images: {
    /*
     * Ottimizzazione immagini DISATTIVATA.
     *
     * In produzione le immagini remote rispondevano 402 su /_next/image:
     * e' la quota di Image Optimization di Vercel esaurita. Non era un
     * problema di permessi ne' di file mancanti.
     *
     * La quota si consumava a una velocita' anomala perche' quasi tutte
     * le immagini remote dell'app (loghi squadra, allegati, foto) sono
     * signed URL generati con createSignedUrl: contengono un token che
     * cambia a ogni render, quindi Vercel li conta come immagini SORGENTE
     * sempre nuove. Una manciata di loghi diventava cosi' centinaia di
     * "immagini diverse" al mese, e nessuna cache poteva intervenire
     * perche' due URL non erano mai uguali.
     *
     * Con unoptimized: true il componente <Image> serve direttamente
     * l'URL originale, senza passare da /_next/image: nessuna quota da
     * consumare e nessun 402. Per questa applicazione la perdita e'
     * minima: si tratta di loghi e foto profilo di pochi KB, gia'
     * richiesti alle dimensioni in cui vengono mostrati.
     *
     * Per riattivare l'ottimizzazione in futuro non basta rimuovere
     * questa riga: prima vanno resi STABILI gli URL delle immagini (per
     * esempio bucket pubblico + getPublicUrl al posto degli signed URL),
     * altrimenti la quota si esaurisce di nuovo allo stesso modo.
     */
    unoptimized: true,

    // Mantenuto: torna necessario se un giorno si riattiva
    // l'ottimizzazione. Con unoptimized: true non viene applicato.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gszaqrospzlnqkiabhbr.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
