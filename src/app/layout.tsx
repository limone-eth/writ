import type { Metadata, Viewport } from "next";
import { Lato } from "next/font/google";
import { PrefsProvider, PREFS_BOOTSTRAP } from "@/components/prefs";
import "./globals.css";

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-lato",
});

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "writ";
const tagline = process.env.NEXT_PUBLIC_SITE_TAGLINE || "writing, in the open";

export const metadata: Metadata = {
  title: { default: siteName, template: `%s — ${siteName}` },
  description: tagline,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#100f0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lato.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOTSTRAP }} />
      </head>
      <body>
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
