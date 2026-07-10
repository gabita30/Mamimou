import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Ces exports remplacent ceux de next/navigation et next/link dans toute l'app.
// Ils ajoutent/retirent automatiquement le préfixe de langue (/fr, /en)
// sans que tu aies à t'en soucier dans chaque composant.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
