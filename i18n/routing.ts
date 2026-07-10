import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Liste des langues supportées par l'application.
  // Pour ajouter une langue plus tard : il suffit d'ajouter son code ici
  // et de créer le fichier messages/xx.json correspondant.
  locales: ["fr", "en"],

  // Langue utilisée par défaut si aucune préférence n'est détectée
  defaultLocale: "fr",

  // "always" => l'URL contient toujours le préfixe de langue (/fr/..., /en/...)
  // C'est le choix retenu pour le SEO et le partage de liens fiable.
  localePrefix: "always",
});

// Types réutilisables ailleurs dans l'app (ex: LanguageSwitcher, navigation typée)
export type Locale = (typeof routing.locales)[number];
