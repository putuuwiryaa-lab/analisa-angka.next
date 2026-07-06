import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Engine prediksi & secret hanya berjalan di server (route handlers).
  // Animasi transisi antar halaman via View Transitions API (lihat globals.css).
  experimental: {
    viewTransition: true,
  },
  async redirects() {
    return [
      { source: "/kode-login", destination: "/", permanent: false },
      { source: "/login", destination: "/", permanent: false },
      { source: "/auth", destination: "/", permanent: false },
      { source: "/account", destination: "/", permanent: false },
      { source: "/akun", destination: "/", permanent: false },
      { source: "/trial", destination: "/", permanent: false },
      { source: "/logout", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
