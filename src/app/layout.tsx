import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Asistente de Soporte al Cliente',
  description:
    'Chat de soporte inteligente basado en RAG: responde únicamente desde los documentos PDF que cargues, con streaming en tiempo real.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
