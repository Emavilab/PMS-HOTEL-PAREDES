"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  LogIn,
  LogOut,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { getHotelDateKey } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorToast } from "@/components/ui/error-toast"
import { useAuth } from "@/hooks/useAuth"

type OperacionDia = {
  id: string
  huesped: string
  codigo_confirmacion: string
  fecha_entrada: string
  fecha_salida: string
  habitacion: string | null
  estado: string
  total?: number
}

type Kpi = {
  periodo: string
  revpar: number
  adr: number
  ocupacion_pct: number
  ingresos_totales: number
}

const chartWidth = 640
const chartHeight = 180

function localDate(): string {
  return getHotelDateKey()
}

function formatCompactDate(value: string) {
  if (!value) return ""
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-HN", { day: "2-digit", month: "short" })
}

function formatShortNumber(value: number) {
  return new Intl.NumberFormat("es-HN", { maximumFractionDigits: 0 }).format(value)
}

function ChartLine({ data, color, valueKey }: { data: Kpi[]; color: string; valueKey: "ingresos_totales" | "ocupacion_pct" }) {
  if (data.length === 0) {
    return <div className="flex h-[180px] items-center justify-center text-sm text-gray-400">Sin datos para el período</div>
  }

  const values = data.map((item) => Number(item[valueKey] || 0))
  const max = Math.max(...values, 1)
  const points = data.map((item, index) => {
    const x = data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth
    const y = chartHeight - (Number(item[valueKey] || 0) / max) * (chartHeight - 20) - 10
    return `${x},${y}`
  }).join(" ")
  const areaPoints = `0,${chartHeight} ${points} ${chartWidth},${chartHeight}`

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-[180px] w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label="Tendencia del período">
        <defs>
          <linearGradient id={`fill-${valueKey}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => {
          const y = (line / 3) * chartHeight
          return <line key={line} x1="0" x2={chartWidth} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="4 5" />
        })}
        <polygon points={areaPoints} fill={`url(#fill-${valueKey})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((item, index) => {
          const [x, y] = points.split(" ")[index].split(",")
          return <circle key={`${item.periodo}-${index}`} cx={x} cy={y} r="3.5" fill="white" stroke={color} strokeWidth="2" />
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{formatCompactDate(data[0].periodo)}</span>
        <span>{formatCompactDate(data[data.length - 1].periodo)}</span>
      </div>
    </div>
  )
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const permisos = Array.isArray(user?.permisos) ? user.permisos : []
  const recepcionCompleta =
    permisos.includes("recepcion") ||
    ["ver", "crear", "editar", "eliminar"].every((accion) => permisos.includes(`recepcion:${accion}`))
  const tienePermisoVer = (modulo: string) => {
    if (user?.rol === "admin" || permisos.length === 0) return true
    if (recepcionCompleta && ["reportes", "habitaciones", "ventas", "facturacion"].includes(modulo)) return true
    return permisos.includes(modulo) || permisos.includes(`${modulo}:ver`)
  }
  const [arrivals, setArrivals] = useState<OperacionDia[]>([])
  const [departures, setDepartures] = useState<OperacionDia[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [housekeeping, setHousekeeping] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const today = localDate()

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError("")
    const from = new Date()
    from.setDate(from.getDate() - 29)
    const startDate = getHotelDateKey(from)

    const results = await Promise.allSettled([
      tienePermisoVer("reportes") ? api.reportes.llegadas() : Promise.resolve([]),
      tienePermisoVer("reportes") ? api.reportes.salidas() : Promise.resolve([]),
      tienePermisoVer("habitaciones") ? api.habitaciones.listar() : Promise.resolve([]),
      tienePermisoVer("reportes") ? api.reportes.ejecutivo(startDate, today, "diario") : Promise.resolve({ kpis: [] }),
      tienePermisoVer("reportes") ? api.reportes.ingresosDetallado(startDate, today) : Promise.resolve({ por_canal: [] }),
      tienePermisoVer("reportes") ? api.reportes.housekeeping(today) : Promise.resolve(null),
    ])

    const [arrivalsResult, departuresResult, roomsResult, executiveResult, detailResult, housekeepingResult] = results
    if (arrivalsResult.status === "fulfilled") setArrivals(arrivalsResult.value)
    if (departuresResult.status === "fulfilled") setDepartures(departuresResult.value)
    if (roomsResult.status === "fulfilled") setRooms(roomsResult.value)
    if (executiveResult.status === "fulfilled") setKpis(executiveResult.value.kpis || [])
    if (detailResult.status === "fulfilled") setChannels(detailResult.value.por_canal || [])
    if (housekeepingResult.status === "fulfilled") setHousekeeping(housekeepingResult.value)

    const criticalFailure = [arrivalsResult, departuresResult, roomsResult].find((result) => result.status === "rejected")
    if (criticalFailure?.status === "rejected") setError(criticalFailure.reason?.message || "No se pudo cargar el dashboard")
    setLoading(false)
  }, [today, user])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  const summary = useMemo(() => {
    const latest = kpis[kpis.length - 1]
    return {
      ingresos: kpis.reduce((total, item) => total + Number(item.ingresos_totales || 0), 0),
      ocupacion: latest?.ocupacion_pct || 0,
      adr: latest?.adr || 0,
      revpar: latest?.revpar || 0,
    }
  }, [kpis])

  const roomStats = useMemo(() => {
    const total = rooms.length
    const count = (predicate: (room: any) => boolean) => rooms.filter(predicate).length
    return {
      total,
      ocupadas: count((room) => room.estado_operativo === "OCUPADA"),
      disponibles: count((room) => room.estado_operativo === "DISPONIBLE" && room.estado_limpieza === "LIMPIA"),
      limpieza: count((room) => room.estado_limpieza === "SUCIA" || room.estado_limpieza === "EN_PROGRESO"),
      bloqueadas: count((room) => !["DISPONIBLE", "OCUPADA"].includes(room.estado_operativo)),
    }
  }, [rooms])

  const topChannels = useMemo(() => [...channels].sort((a, b) => Number(b.ingresos || 0) - Number(a.ingresos || 0)).slice(0, 5), [channels])
  const maxChannelRevenue = Math.max(...topChannels.map((channel) => Number(channel.ingresos || 0)), 1)
  const todayArrivals = arrivals.filter((item) => item.fecha_entrada === today)
  const todayDepartures = departures.filter((item) => item.fecha_salida === today)
  const firstName = user?.nombre_completo?.split(" ")[0] || "equipo"
  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString("es-HN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  const metricCards = [
    { label: "Ingresos del período", value: formatCurrency(summary.ingresos), helper: "Últimos 30 días", icon: CircleDollarSign, tone: "text-emerald-700 bg-emerald-50", accent: "border-emerald-100" },
    { label: "Ocupación actual", value: `${summary.ocupacion.toFixed(1)}%`, helper: "Habitaciones vendidas", icon: TrendingUp, tone: "text-blue-700 bg-blue-50", accent: "border-blue-100" },
    { label: "ADR", value: formatCurrency(summary.adr), helper: "Tarifa diaria promedio", icon: BedDouble, tone: "text-violet-700 bg-violet-50", accent: "border-violet-100" },
    { label: "RevPAR", value: formatCurrency(summary.revpar), helper: "Ingreso por habitación", icon: Sparkles, tone: "text-amber-700 bg-amber-50", accent: "border-amber-100" },
  ]

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 px-6 py-7 text-white shadow-lg sm:px-8">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-200"><Sparkles className="h-4 w-4" /> Centro de mando</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Buenos días, {firstName}</h1>
            <p className="mt-2 text-sm capitalize text-blue-100">{dateLabel} · Resumen operativo del Hotel Paredes</p>
          </div>
          <button onClick={loadDashboard} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/20 lg:self-auto">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar datos
          </button>
        </div>
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
      </section>

      <ErrorToast message={error} onClose={() => setError("")} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon
          return (
            <Card key={metric.label} className={`border ${metric.accent} shadow-sm`}>
              <CardContent className="flex items-start justify-between p-5">
                <div><p className="text-sm font-medium text-gray-500">{metric.label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{loading ? "—" : metric.value}</p><p className="mt-1 text-xs text-gray-400">{metric.helper}</p></div>
                <div className={`rounded-xl p-3 ${metric.tone}`}><Icon className="h-5 w-5" /></div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between border-b pb-4">
            <div><CardTitle className="text-base">Rendimiento del hotel</CardTitle><p className="mt-1 text-xs text-gray-500">Tendencia de ingresos en los últimos 30 días</p></div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Ingresos</div>
          </CardHeader>
          <CardContent className="pt-5"><ChartLine data={kpis} color="#10b981" valueKey="ingresos_totales" /></CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader className="border-b pb-4"><CardTitle className="text-base">Ocupación diaria</CardTitle><p className="mt-1 text-xs text-gray-500">Porcentaje de habitaciones vendidas</p></CardHeader>
          <CardContent className="pt-5"><ChartLine data={kpis} color="#3b82f6" valueKey="ocupacion_pct" /></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b pb-4"><CardTitle className="text-base">Estado de habitaciones</CardTitle><p className="mt-1 text-xs text-gray-500">{roomStats.total} habitaciones en inventario</p></CardHeader>
          <CardContent className="space-y-5 pt-5">
            {[
              { label: "Ocupadas", value: roomStats.ocupadas, color: "bg-blue-600", text: "text-blue-700" },
              { label: "Disponibles y limpias", value: roomStats.disponibles, color: "bg-emerald-500", text: "text-emerald-700" },
              { label: "En limpieza", value: roomStats.limpieza, color: "bg-amber-500", text: "text-amber-700" },
              { label: "Bloqueadas", value: roomStats.bloqueadas, color: "bg-gray-400", text: "text-gray-600" },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-sm"><span className="text-gray-600">{item.label}</span><span className={`font-semibold ${item.text}`}>{item.value} <span className="font-normal text-gray-400">({roomStats.total ? Math.round(item.value / roomStats.total * 100) : 0}%)</span></span></div>
                <ProgressBar value={roomStats.total ? item.value / roomStats.total * 100 : 0} color={item.color} />
              </div>
            ))}
            <Link href="/habitaciones" className="flex items-center justify-end gap-1 pt-1 text-sm font-medium text-blue-600 hover:text-blue-800">Ver inventario <ArrowRight className="h-4 w-4" /></Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-4"><CardTitle className="text-base">Ingresos por canal</CardTitle><p className="mt-1 text-xs text-gray-500">Distribución de reservas del período</p></CardHeader>
          <CardContent className="space-y-4 pt-5">
            {topChannels.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">Sin ingresos registrados en el período</p> : topChannels.map((channel) => (
              <div key={channel.canal}>
                <div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-gray-700">{channel.canal}</span><span className="font-semibold text-gray-900">{formatCurrency(Number(channel.ingresos || 0))}</span></div>
                <div className="flex items-center gap-3"><ProgressBar value={Number(channel.ingresos || 0) / maxChannelRevenue * 100} color="bg-violet-500" /><span className="w-10 text-right text-xs text-gray-400">{channel.porcentaje || 0}%</span></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="border-b pb-4"><div className="flex items-center justify-between"><div><CardTitle className="text-base">Agenda de hoy</CardTitle><p className="mt-1 text-xs text-gray-500">Operaciones que requieren atención</p></div><CalendarCheck className="h-5 w-5 text-blue-500" /></div></CardHeader>
          <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
            <div><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><LogIn className="h-4 w-4" /></span> Llegadas <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{todayArrivals.length}</span></div>{todayArrivals.length === 0 ? <p className="py-4 text-sm text-gray-400">No hay llegadas para hoy</p> : todayArrivals.slice(0, 4).map((item) => <Link key={item.id} href="/recepcion" className="mb-2 flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm hover:bg-blue-50"><span className="truncate font-medium text-gray-700">{item.huesped}</span><span className="ml-2 text-xs text-gray-400">Hab. {item.habitacion || "—"}</span></Link>)}</div>
            <div><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800"><span className="rounded-lg bg-orange-50 p-2 text-orange-600"><LogOut className="h-4 w-4" /></span> Salidas <span className="ml-auto rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">{todayDepartures.length}</span></div>{todayDepartures.length === 0 ? <p className="py-4 text-sm text-gray-400">No hay salidas para hoy</p> : todayDepartures.slice(0, 4).map((item) => <Link key={item.id} href="/recepcion" className="mb-2 flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm hover:bg-orange-50"><span className="truncate font-medium text-gray-700">{item.huesped}</span><span className="ml-2 text-xs text-gray-400">{formatCurrency(item.total || 0)}</span></Link>)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-4"><CardTitle className="text-base">Housekeeping</CardTitle><p className="mt-1 text-xs text-gray-500">Estado de las tareas de hoy</p></CardHeader>
          <CardContent className="pt-5">{housekeeping ? <><div className="mb-5 flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-lg font-bold text-emerald-700">{housekeeping.total_tareas ? Math.round(housekeeping.completadas / housekeeping.total_tareas * 100) : 0}%</div><div><p className="font-semibold text-gray-800">Tareas completadas</p><p className="text-sm text-gray-500">{housekeeping.completadas} de {housekeeping.total_tareas}</p></div></div><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-gray-500">Pendientes</span><span className="font-medium text-amber-600">{housekeeping.pendientes}</span></div><div className="flex justify-between"><span className="text-gray-500">En progreso</span><span className="font-medium text-blue-600">{housekeeping.en_progreso}</span></div><div className="flex justify-between"><span className="text-gray-500">Inspecciones fallidas</span><span className="font-medium text-red-600">{housekeeping.inspecciones_fallidas}</span></div></div></> : <div className="flex items-center gap-3 py-8 text-sm text-gray-400"><Clock3 className="h-5 w-5" /> Sin tareas registradas</div>}<Link href="/housekeeping" className="mt-5 flex items-center justify-end gap-1 text-sm font-medium text-blue-600 hover:text-blue-800">Ver housekeeping <ArrowRight className="h-4 w-4" /></Link></CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/recepcion" className="flex items-center justify-between rounded-xl border bg-white p-4 text-sm font-medium shadow-sm transition hover:border-blue-300 hover:bg-blue-50"><span className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-600" /> Ir a recepción</span><ArrowRight className="h-4 w-4" /></Link>
        <Link href="/reservas/nueva" className="flex items-center justify-between rounded-xl border bg-white p-4 text-sm font-medium shadow-sm transition hover:border-blue-300 hover:bg-blue-50"><span className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-blue-600" /> Nueva reserva</span><ArrowRight className="h-4 w-4" /></Link>
        {(user?.rol === "admin" || user?.rol === "gerente") && <Link href="/reportes" className="flex items-center justify-between rounded-xl border bg-white p-4 text-sm font-medium shadow-sm transition hover:border-blue-300 hover:bg-blue-50"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-600" /> Ver reportes</span><ArrowRight className="h-4 w-4" /></Link>}
      </div>
    </div>
  )
}
