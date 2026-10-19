import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { SCRIPT_DO_MENU } from "@/lib/estrutura/menu-lateral";
import "./globals.css";

// Fonte da identidade v2 (SPEC-016, 5.1): Manrope para tudo, servida pelo next/font.
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Health Enterprise", template: "%s · Health Enterprise" },
  description: "A saúde da sua empresa de maneira visual e sob controle.",
  applicationName: "Health Enterprise",
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#12342c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Tema e menu lateral escolhidos antes da primeira pintura (SPEC-016, OPEN-004 e N8): sem piscar. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('he-tema')==='escuro')document.documentElement.classList.add('dark')}catch(e){}" + SCRIPT_DO_MENU,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
