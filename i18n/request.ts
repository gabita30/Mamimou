import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // La locale demandée arrive depuis le middleware / segment [locale]
  const requested = await requestLocale;

  // Sécurité : si la locale n'est pas dans notre liste supportée,
  // on retombe sur la langue par défaut plutôt que de planter.
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // Chargement dynamique du fichier JSON correspondant.
    // C'est ici que la "clé -> texte" est résolue.
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
