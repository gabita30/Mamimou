import type { ReactNode } from 'react'
import MainLayout from '../MainLayout'

// Ce layout s'applique automatiquement à toutes les routes du groupe (app) :
// feed/, messages/, profile/ — sans avoir à importer MainLayout dans chaque page.
// Next.js ignore le nom du dossier "(app)" dans l'URL (parenthèses = route group).
export default function AppLayout({ children }: { children: ReactNode }) {
  return <MainLayout>{children}</MainLayout>
}
