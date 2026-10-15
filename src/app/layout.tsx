import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
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
        {/* Tema escolhido antes da primeira pintura (SPEC-016, OPEN-004): sem piscar claro → escuro. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('he-tema')==='escuro')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
