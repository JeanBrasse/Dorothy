import type { Metadata, Viewport } from "next";
import { Roboto_Condensed, Roboto_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Self-hosted at build time: no render-blocking request to Google at runtime,
// and the type system still works offline.
const sans = Roboto_Condensed({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans-loaded", display: "swap" });
const mono = Roboto_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-loaded", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif-loaded", display: "swap" });
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Tars | Agent Control Center",
  description: "Manage and monitor your Claude Code agents, projects, and tasks in real-time",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tars",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#121212",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable} ${serif.variable}`} style={{ colorScheme: 'dark' }}>
      <head>
        {/* Applies the stored theme before the first paint: without this the
            light palette renders for one frame on every cold load (white flash). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var dark=localStorage.getItem('tars-theme')!=='light';var e=document.documentElement;e.classList.toggle('dark',dark);e.style.colorScheme=dark?'dark':'light';}catch(_){}})();`,
          }}
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
