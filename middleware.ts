import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Applique le middleware à toutes les routes SAUF :
  // - les fichiers API (/api)
  // - les assets internes Next.js (/_next)
  // - les fichiers statiques (ceux qui contiennent un "." comme .png, .ico, etc.)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
