import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cosmos — Rencontres, amitié et amour',
  description:
    "Cosmos est un espace de rencontre bienveillant pour l'amitié, l'intimité et l'amour, sans racisme ni violence. Réservé aux 18 ans et plus.",
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#0D1B4B',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, backgroundColor: '#0D1B4B', color: 'white', fontFamily: "'Jost', sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
