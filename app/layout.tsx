import type { ReactNode } from "react";

// Ce layout racine est volontairement minimal.
// Next.js exige un app/layout.tsx à la racine, mais tout le contenu réel
// (html, head, fonts, ServiceWorker) vit maintenant dans app/[locale]/layout.tsx
// car il dépend de la langue active.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
