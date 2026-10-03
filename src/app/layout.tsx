import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

// Fontes da identidade visual (IDENTIDADE_VISUAL.md §6), servidas pelo next/font.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz"], display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Health Enterprise", template: "%s · Health Enterprise" },
  description: "A saúde da sua empresa de maneira visual e sob controle.",
  applicationName: "Health Enterprise",
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#163028",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
