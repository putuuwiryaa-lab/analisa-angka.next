import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import { AuthGate } from "@/components/auth/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Analisa Angka",
  description: "Aplikasi analisa angka berbasis evaluasi statistik.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Analisa Angka",
  },
  openGraph: {
    type: "website",
    siteName: "Analisa Angka",
    title: "Analisa Angka",
    description: "Aplikasi analisa angka berbasis evaluasi statistik.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0a1a",
  width: "device-width",
  initialScale: 1,
};

function ThemeInitScript() {
  const script = `
try {
  const stored = localStorage.getItem("aa_theme");
  const theme = stored === "light" || stored === "dark" ? stored : "dark";
  document.documentElement.dataset.theme = theme;
} catch (_) {
  document.documentElement.dataset.theme = "dark";
}
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`} data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeInitScript />
        <Providers>
          <AuthGate>
            <AppShell>{children}</AppShell>
          </AuthGate>
        </Providers>
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  );
}
