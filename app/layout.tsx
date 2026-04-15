import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ClarityCase',
  description: 'Plain-English guidance for CIFAS and fraud marker decisions',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-bg text-foreground min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
