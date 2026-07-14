import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "../globals.css";
import ServiceWorkerRegister from "../ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Cosmos — Rencontres, amitié et amour",
  description:
    "Cosmos est un espace de rencontre bienveillant pour l'amitié, l'intimité et l'amour, sans racisme ni violence. Réservé aux 18 ans et plus.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0D1B4B",
};

// Pré-génère les pages pour chaque langue au build (fr et en)
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Si quelqu'un force une locale non supportée dans l'URL (ex: /de/...),
  // on renvoie une 404 plutôt que de planter.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Nécessaire pour que les Server Components rendus statiquement
  // connaissent la locale courante.
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          backgroundColor: "#0D1B4B",
          color: "white",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        {/* Fournit les traductions à tous les Client Components de l'arbre */}
        <NextIntlClientProvider>
          <ServiceWorkerRegister />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
