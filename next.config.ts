import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Engine prediksi & secret hanya berjalan di server (route handlers).
  // Tidak ada konfigurasi build khusus yang dibutuhkan untuk Vercel.
};

export default nextConfig;
