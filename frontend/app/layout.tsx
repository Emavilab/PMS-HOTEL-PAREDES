import type { Metadata } from "next"
import { AuthProvider } from "@/hooks/useAuth"
import "./globals.css"

export const metadata: Metadata = {
  title: "Hotel Paredes PMS",
  description: "Property Management System",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
