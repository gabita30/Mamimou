"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleChange(nextLocale: string) {
    startTransition(() => {
      // usePathname() renvoie le chemin SANS le préfixe de langue,
      // router.replace ajoute automatiquement le bon préfixe.
      // La page courante (ex: /profil) est donc conservée lors du switch.
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 14, opacity: 0.8 }}>{t("label")}</span>
      <select
        value={locale}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          background: "transparent",
          color: "white",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: 6,
          padding: "4px 8px",
        }}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc} style={{ color: "black" }}>
            {t(loc)}
          </option>
        ))}
      </select>
    </label>
  );
}
