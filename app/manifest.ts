import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Analisa Angka",
    short_name: "AnalisaAngka",
    description: "Sistem prediksi pasaran & analisa angka.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0a1a",
    theme_color: "#0d0a1a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
