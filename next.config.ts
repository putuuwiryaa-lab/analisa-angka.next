import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Engine prediksi & secret hanya berjalan di server (route handlers).
  // Animasi transisi antar halaman via View Transitions API (lihat globals.css).
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
