import createNextIntlPlugin from "next-intl/plugin";

// Le plugin relie next-intl à Next.js et pointe vers le fichier
// qui charge les messages côté serveur (i18n/request.ts)
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withNextIntl(nextConfig);
