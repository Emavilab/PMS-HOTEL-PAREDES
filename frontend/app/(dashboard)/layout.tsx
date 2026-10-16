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
  Bell,
  AlertTriangle,
  CalendarClock,
  Check,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { Notificacion } from "@/types"

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

function moduloDesdeRuta(pathname: string) {
  if (pathname === "/") return "dashboard"
  return pathname.slice(1).split("/")[0].replaceAll("-", "_")
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notificacion[]>([])
  const [readNotifications, setReadNotifications] = useState<string[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return

    const tiempoMaximoInactividad = 1 * 60 * 1000
    let temporizador: number
    let cerrado = false

    const cerrarPorInactividad = () => {
      if (cerrado) return
      cerrado = true
      logout()
      router.replace("/login?motivo=inactividad")
    }

    const reiniciarTemporizador = () => {
      window.clearTimeout(temporizador)
      temporizador = window.setTimeout(cerrarPorInactividad, tiempoMaximoInactividad)
    }

    const eventosActividad: (keyof WindowEventMap)[] = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "click"]
    eventosActividad.forEach((evento) => window.addEventListener(evento, reiniciarTemporizador, { passive: true }))
    reiniciarTemporizador()

    return () => {
      window.clearTimeout(temporizador)
      eventosActividad.forEach((evento) => window.removeEventListener(evento, reiniciarTemporizador))
    }
  }, [isAuthenticated, logout, router])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login")
    }
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated) return
    const saved = localStorage.getItem("hotel-paredes-notificaciones-leidas")
    if (saved) setReadNotifications(JSON.parse(saved))
    api.reportes.notificaciones().then(setNotifications).catch(() => setNotifications([]))
    const interval = window.setInterval(() => {
      api.reportes.notificaciones().then(setNotifications).catch(() => undefined)
    }, 120000)
    return () => window.clearInterval(interval)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || !user) return
    let ultimoEnvio = 0
    let ultimoMovimiento = 0
    const registrar = () => {
      const ahora = Date.now()
      if (document.visibilityState !== "visible" || ahora - ultimoMovimiento < 25000 || ahora - ultimoEnvio < 20000) return
      ultimoMovimiento = ahora
      ultimoEnvio = ahora
      api.usuarios.registrarActividad().catch(() => undefined)
    }
    registrar()
    window.addEventListener("focus", registrar)
    window.addEventListener("pointerdown", registrar, { passive: true })
    window.addEventListener("keydown", registrar)
    window.addEventListener("scroll", registrar, { passive: true })
    window.addEventListener("touchstart", registrar, { passive: true })
    return () => {
      window.removeEventListener("focus", registrar)
      window.removeEventListener("pointerdown", registrar)
      window.removeEventListener("keydown", registrar)
      window.removeEventListener("scroll", registrar)
      window.removeEventListener("touchstart", registrar)
    }
  }, [isAuthenticated, user?.id])

  function marcarLeida(id: string) {
    const next = Array.from(new Set([...readNotifications, id]))
    setReadNotifications(next)
    localStorage.setItem("hotel-paredes-notificaciones-leidas", JSON.stringify(next))
  }

  function marcarTodasLeidas() {
    const next = notifications.map((notification) => notification.id)
    setReadNotifications(next)
    localStorage.setItem("hotel-paredes-notificaciones-leidas", JSON.stringify(next))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Cargando...</div>
      </div>
    )
  }

  if (!user) return null

  const permisos = Array.isArray(user.permisos) ? user.permisos : []
  const filteredItems = navItems.filter((item) => {
    if (!item.roles.includes(user.rol as any)) return false
    if (user.rol === "admin") return true
    const modulo = moduloDesdeRuta(item.href)
    return permisos.length === 0 || permisos.includes(modulo)
  })

  const itemRuta = navItems.find((item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
  const tieneRolRuta = !itemRuta || itemRuta.roles.includes(user.rol as any)
  const tienePermisoRuta = user.rol === "admin" || permisos.length === 0 || permisos.includes(moduloDesdeRuta(pathname))
  const tieneAccesoRuta = tieneRolRuta && tienePermisoRuta

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-100 flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex h-screen w-64 flex-col overflow-y-auto bg-white border-r transform transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:shrink-0 lg:translate-x-0",
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
        <nav className="flex-1 p-4 space-y-1">
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
        <div className="sticky bottom-0 mt-auto shrink-0 border-t bg-white p-4">
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-10 flex h-16 shrink-0 items-center border-b bg-white px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-4">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="relative mr-4">
            <button type="button" onClick={() => setNotificationsOpen((open) => !open)} className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Notificaciones">
              <Bell className="h-5 w-5" />
              {notifications.filter((notification) => !readNotifications.includes(notification.id)).length > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{Math.min(99, notifications.filter((notification) => !readNotifications.includes(notification.id)).length)}</span>}
            </button>
            {notificationsOpen && <div className="absolute right-0 top-12 z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-white shadow-xl"><div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="font-semibold">Notificaciones</h2><p className="text-xs text-gray-500">Eventos para gestionar</p></div><button type="button" onClick={marcarTodasLeidas} className="text-xs text-blue-600 hover:underline">Marcar todas</button></div><div className="max-h-[min(480px,70vh)] overflow-y-auto">{notifications.length === 0 ? <p className="p-5 text-sm text-gray-500">No hay alertas pendientes</p> : notifications.map((notification) => { const leida = readNotifications.includes(notification.id); return <Link key={notification.id} href={notification.href} onClick={() => { marcarLeida(notification.id); setNotificationsOpen(false) }} className={cn("flex gap-3 border-b px-4 py-3 hover:bg-gray-50", leida && "opacity-50")}><div className={cn("mt-0.5 rounded-full p-1.5", notification.prioridad === "alta" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600")}>{notification.prioridad === "alta" ? <AlertTriangle className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{notification.titulo}</p><p className="text-xs text-gray-600">{notification.mensaje}</p><p className="mt-1 text-[11px] text-gray-400">{notification.fecha}</p></div>{leida && <Check className="mt-1 h-4 w-4 text-green-600" />}</Link> })}</div></div>}
          </div>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString("es-HN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
          {tieneAccesoRuta ? children : (
            <p className="text-gray-500">No tienes permisos para ver esta página.</p>
          )}
        </main>
      </div>
    </div>
  )
}
