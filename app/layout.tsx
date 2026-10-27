import type { Metadata } from "next";
import "./globals.css";
import "./site.css";

export const metadata: Metadata = {
  title: "ASTORIJA | Skaistumkopšanas salons Rīgā",
  description: "Skaistumkopšanas salons ASTORIJA, Auru iela 9b, Rīga. Tiešsaistes pieraksts un kontakti.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lv">
      <body className="antialiased">{children}</body>
    </html>
  );
}
