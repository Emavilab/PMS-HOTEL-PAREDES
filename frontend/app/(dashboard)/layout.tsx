"use client"

import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Calendar,
  Users,
  BedDouble,
  ClipboardCheck,
  DollarSign,
  Receipt,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  Building2,
  ShoppingCart,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "gerente", "recepcionista"] },
  { href: "/recepcion", label: "Recepción", icon: ClipboardCheck, roles: ["admin", "gerente", "recepcionista"] },
  { href: "/verificar-salida", label: "Verificar Salida", icon: LogOut, roles: ["admin", "gerente", "recepcionista"] },
  { href: "/reservas", label: "Reservas", icon: Calendar, roles: ["admin", "gerente", "recepcionista"] },
  { href: "/huespedes", label: "Huéspedes", icon: Users, roles: ["admin", "gerente", "recepcionista"] },
  { href: "/habitaciones", label: "Habitaciones", icon: BedDouble, roles: ["admin", "gerente", "recepcionista"] },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart, roles: ["admin", "gerente", "recepcionista"] },
  { href: "/housekeeping", label: "Housekeeping", icon: Building2, roles: ["admin", "gerente", "recepcionista", "limpieza"] },
  { href: "/facturacion", label: "Facturación", icon: Receipt, roles: ["admin", "gerente", "recepcionista"] },
  { href: "/caja", label: "Caja", icon: DollarSign, roles: ["admin", "gerente"] },
  { href: "/reportes", label: "Reportes", icon: BarChart3, roles: ["admin", "gerente"] },
  { href: "/usuarios", label: "Usuarios", icon: Users, roles: ["admin"] },
  { href: "/auditoria", label: "Auditoría", icon: Shield, roles: ["admin", "gerente"] },
  { href: "/configuracion", label: "Configuración", icon: Settings, roles: ["admin"] },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login")
    }
  }, [loading, isAuthenticated, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Cargando...</div>
      </div>
    )
  }

  if (!user) return null

  const filteredItems = navItems.filter((item) => item.roles.includes(user.rol as any))

  function handleLogout() {
    logout()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <span className="font-semibold text-lg">Hotel Paredes</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium">{user.nombre_completo}</p>
              <p className="text-gray-500 capitalize">{user.rol}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b flex items-center px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-4">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString("es-HN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
