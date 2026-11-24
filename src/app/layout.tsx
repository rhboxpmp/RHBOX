import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RHBOX — Gestão de Servidores",
  description:
    "RHBOX — Gestão de servidores com organização, valorização e transparência.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased min-h-screen bg-[#F4F7FC] text-[#1E293B]">
        {children}
      </body>
    </html>
  );
}
