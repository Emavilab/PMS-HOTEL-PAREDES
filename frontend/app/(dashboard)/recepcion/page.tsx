"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, statusBadge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import { SuccessToast } from "@/components/ui/success-toast"
import { ErrorToast } from "@/components/ui/error-toast"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import {
  AlertTriangle,
  Banknote,
  BedDouble,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  DoorOpen,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react"

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDaysToDateString(dateStr: string, days: number): string {
  if (!dateStr) return ""
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return getLocalDateString(dt)
}

function calculateNights(entradaStr: string, salidaStr: string): number {
  if (!entradaStr || !salidaStr) return 0
  const [y1, m1, d1] = entradaStr.split("-").map(Number)
  const [y2, m2, d2] = salidaStr.split("-").map(Number)
  const t1 = new Date(y1, m1 - 1, d1).getTime()
  const t2 = new Date(y2, m2 - 1, d2).getTime()
  const diffDays = Math.round((t2 - t1) / 86400000)
  return Math.max(0, diffDays)
}

function getQuickCashOptions(adelanto: number): number[] {
  if (adelanto <= 0) return []
  const options = new Set<number>()
  const commonDenominations = [50, 100, 200, 500, 1000]
  for (const denom of commonDenominations) {
    if (denom > adelanto && denom <= adelanto + 1000) {
      options.add(denom)
    }
  }
  const next100 = Math.ceil(adelanto / 100) * 100
  if (next100 > adelanto) options.add(next100)
  const next500 = Math.ceil(adelanto / 500) * 500
  if (next500 > adelanto) options.add(next500)

  return Array.from(options).sort((a, b) => a - b).slice(0, 4)
}

interface AccionConfirmar {
  tipo: "checkin" | "checkout"
  reserva: any
}

export default function RecepcionPage() {
  const [arrivals, setArrivals] = useState<any[]>([])
  const [departures, setDepartures] = useState<any[]>([])
  const [salidasTab, setSalidasTab] = useState<"hoy" | "manana" | "proximas">("hoy")
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [accion, setAccion] = useState<AccionConfirmar | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string>("")
  const [confirming, setConfirming] = useState(false)

  const [verificacion, setVerificacion] = useState<any | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [metodosPago, setMetodosPago] = useState<any[]>([])
  const [metodoPago, setMetodoPago] = useState("")
  const [checkoutEfectivoRecibido, setCheckoutEfectivoRecibido] = useState("")
  const [culminando, setCulminando] = useState(false)

  const [showQuickReserva, setShowQuickReserva] = useState(false)
  const [roomToRent, setRoomToRent] = useState<any | null>(null)
  const [occupiedRoom, setOccupiedRoom] = useState<any | null>(null)

  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.reportes.llegadas(),
      api.reportes.salidas(30),
      api.habitaciones.listar(),
      api.metodosPago.listar(),
    ]).then(([arr, dep, r, metodos]) => {
      setArrivals(arr)
      setDepartures(dep)
      setRooms(r)
      const activos = metodos.filter((metodo: any) => metodo.activo)
      setMetodosPago(activos)
      setMetodoPago((actual) => activos.some((metodo: any) => metodo.nombre === actual) ? actual : activos[0]?.nombre || "")
    }).catch((err: any) => {
      setError(err.message)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    function refreshOnFocus() {
      loadData()
    }

    window.addEventListener("focus", refreshOnFocus)
    return () => window.removeEventListener("focus", refreshOnFocus)
  }, [loadData])

  async function handleConfirm() {
    if (!accion) return
    setConfirming(true)
    setError("")
    try {
      if (accion.tipo === "checkin") {
        const roomId = selectedRoomId || accion.reserva.habitacion_id
        if (!roomId) {
          setError("Selecciona una habitación")
          setConfirming(false)
          return
        }
        await api.reservas.checkIn(accion.reserva.id, roomId)
        setSuccess("Check-in registrado correctamente")
      } else {
        if (!verificacion) {
          setError("No hay datos de verificación de salida")
          setConfirming(false)
          return
        }
        const totalAPagar = verificacion.total_a_pagar || 0
        const isEfectivo = metodoPago.toLowerCase().includes("efectivo")
        const numRecibido = parseFloat(checkoutEfectivoRecibido) || 0

        if (isEfectivo && totalAPagar > 0) {
          if (!checkoutEfectivoRecibido.trim() || numRecibido <= 0) {
            setError("Debes ingresar el efectivo recibido del cliente para culminar la salida en efectivo")
            setConfirming(false)
            return
          }
          if (numRecibido < totalAPagar) {
            setError(`El dinero recibido (${formatCurrency(numRecibido)}) no cubre el total a pagar (${formatCurrency(totalAPagar)})`)
            setConfirming(false)
            return
          }
        }

        setCulminando(true)
        await api.ventas.culminarSalida(
          accion.reserva.reserva_id || accion.reserva.id,
          metodoPago,
          isEfectivo && totalAPagar > 0 ? numRecibido : undefined
        )
        setSuccess("Salida culminada correctamente")
      }
      setAccion(null)
      setSelectedRoomId("")
      setVerificacion(null)
      setCheckoutEfectivoRecibido("")
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setConfirming(false)
      setCulminando(false)
    }
  }

  function openCheckIn(reserva: any) {
    setSelectedRoomId(reserva.habitacion_id || "")
    setAccion({ tipo: "checkin", reserva })
  }

  function openCheckOut(reserva: any) {
    setAccion({ tipo: "checkout", reserva })
    setVerificacion(null)
    setCheckoutEfectivoRecibido("")
    setLoadingDetalle(true)
    api.ventas.verificarSalida(reserva.reserva_id || reserva.id)
      .then((data) => {
        setVerificacion(data)
        setMetodoPago((actual) => metodosPago.some((metodo) => metodo.nombre === actual) ? actual : metodosPago[0]?.nombre || "")
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoadingDetalle(false))
  }

  const availableRooms = rooms.filter((r) => r.estado_operativo === "DISPONIBLE")
  const rentableRooms = availableRooms.filter((r) => r.estado_limpieza === "LIMPIA")
  const occupiedRooms = rooms.filter((r) => r.estado_operativo === "OCUPADA")
  const unavailableRooms = rooms.filter((r) => !["DISPONIBLE", "OCUPADA"].includes(r.estado_operativo))
  const dirtyRooms = rooms.filter((r) => r.estado_limpieza === "SUCIA")
  const cleaningRooms = rooms.filter((r) => r.estado_limpieza === "EN_PROGRESO")
  const occupancy = rooms.length ? Math.round((occupiedRooms.length / rooms.length) * 100) : 0
  const matchingRooms = accion?.tipo === "checkin" && accion.reserva.tipo_habitacion_id
    ? rentableRooms.filter((r) => r.tipo_habitacion_id === accion.reserva.tipo_habitacion_id)
    : []
  const roomsByFloor = rooms.reduce<Record<string, any[]>>((acc, room) => {
    const floor = room.piso || "Sin piso"
    if (!acc[floor]) acc[floor] = []
    acc[floor].push(room)
    return acc
  }, {})
  const floors = Object.entries(roomsByFloor).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))

  function handleRoomClick(room: any) {
    if (room.estado_operativo === "DISPONIBLE" && room.estado_limpieza === "LIMPIA") {
      setRoomToRent(room)
    } else if (room.estado_operativo === "DISPONIBLE") {
      setError(`La habitación ${room.numero} no se puede rentar porque está en estado de limpieza: ${statusBadge(room.estado_limpieza).label}`)
    } else if (room.estado_operativo === "OCUPADA") {
      setOccupiedRoom(room)
    }
  }

  function roomCardClass(room: any) {
    if (room.estado_limpieza === "EN_PROGRESO") return "border-blue-200 bg-blue-50 text-blue-900 cursor-not-allowed"
    if (room.estado_operativo === "DISPONIBLE" && room.estado_limpieza === "LIMPIA") return "border-green-200 bg-green-50 text-green-900 cursor-pointer hover:-translate-y-0.5 hover:bg-green-100 hover:shadow-md"
    if (room.estado_operativo === "DISPONIBLE" && room.estado_limpieza === "SUCIA") return "border-gray-300 bg-gray-100 text-gray-700 cursor-not-allowed"
    if (room.estado_operativo === "OCUPADA") return "border-yellow-200 bg-yellow-50 text-yellow-900 cursor-pointer hover:-translate-y-0.5 hover:bg-yellow-100 hover:shadow-md"
    return "border-red-200 bg-red-50 text-red-900 cursor-default"
  }

  function floorStats(floorRooms: any[]) {
    return {
      total: floorRooms.length,
      rentables: floorRooms.filter((room) => room.estado_operativo === "DISPONIBLE" && room.estado_limpieza === "LIMPIA").length,
      ocupadas: floorRooms.filter((room) => room.estado_operativo === "OCUPADA").length,
      bloqueadas: floorRooms.filter((room) => room.estado_limpieza !== "LIMPIA" || !["DISPONIBLE", "OCUPADA"].includes(room.estado_operativo)).length,
    }
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 text-white shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-blue-50 ring-1 ring-white/20">
                <Clock className="h-3.5 w-3.5" /> Panel operativo de hoy
              </div>
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">Recepción</h1>
                <p className="mt-1 max-w-2xl text-sm text-blue-50">
                  Gestiona llegadas, salidas, ocupación y renta directa desde una sola vista.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="border-white/30 bg-white text-blue-700 hover:bg-blue-50" onClick={loadData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
              <div className="flex items-center justify-between text-blue-50">
                <span className="text-xs font-medium uppercase tracking-wide">Llegadas</span>
                <LogIn className="h-4 w-4" />
              </div>
              <p className="mt-2 text-3xl font-bold">{loading ? "-" : arrivals.length}</p>
              <p className="text-xs text-blue-50">Reservas para check-in</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
              <div className="flex items-center justify-between text-blue-50">
                <span className="text-xs font-medium uppercase tracking-wide">Salidas</span>
                <LogOut className="h-4 w-4" />
              </div>
              <p className="mt-2 text-3xl font-bold">{loading ? "-" : departures.filter(d => d.fecha_salida === getLocalDateString()).length}</p>
              <p className="text-xs text-blue-50">Hoy · {loading ? "…" : departures.length} próximas (30d)</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
              <div className="flex items-center justify-between text-blue-50">
                <span className="text-xs font-medium uppercase tracking-wide">Disponibles</span>
                <DoorOpen className="h-4 w-4" />
              </div>
              <p className="mt-2 text-3xl font-bold">{loading ? "-" : rentableRooms.length}</p>
              <p className="text-xs text-blue-50">Limpias y listas para renta</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
              <div className="flex items-center justify-between text-blue-50">
                <span className="text-xs font-medium uppercase tracking-wide">Ocupación</span>
                <ClipboardList className="h-4 w-4" />
              </div>
              <p className="mt-2 text-3xl font-bold">{loading ? "-" : `${occupancy}%`}</p>
              <p className="text-xs text-blue-50">{occupiedRooms.length} de {rooms.length} habitaciones</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <ErrorToast message={error} onClose={() => setError("")} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-green-50/60">
            <CardTitle className="text-lg flex items-center gap-2">
              <LogIn className="h-5 w-5 text-green-600" /> Llegadas del Día
              {!loading && <span className="text-sm font-normal text-gray-500">({arrivals.length})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : arrivals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                No hay llegadas programadas para hoy.
              </div>
            ) : (
              <div className="space-y-2">
                {arrivals.map((arr) => (
                  <div key={arr.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{arr.huesped}</p>
                      <p className="text-xs text-gray-500">{arr.codigo_confirmacion}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateShort(arr.fecha_salida)}</span>
                        {arr.habitacion && <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" />Hab. {arr.habitacion}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 sm:ml-2">
                      <Badge {...statusBadge(arr.estado)} />
                      {arr.estado === "CHECKED_IN" ? (
                        <Badge variant="success" className="text-xs">Ya registrado</Badge>
                      ) : (
                        <Button size="sm" onClick={() => openCheckIn(arr)}>
                          Check-in
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-amber-50/40 pb-0 pt-4 px-4">
            <div className="flex items-center justify-between mb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100">
                  <LogOut className="h-4 w-4 text-orange-600" />
                </div>
                <span>Verificar Salidas</span>
              </CardTitle>
              {!loading && (
                <div className="flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1">
                  <Clock className="h-3.5 w-3.5 text-orange-600" />
                  <span className="text-xs font-semibold text-orange-700">
                    {departures.filter(d => d.fecha_salida === getLocalDateString()).length} hoy
                  </span>
                </div>
              )}
            </div>
            {/* Tabs */}
            {!loading && (() => {
              const hoy = getLocalDateString()
              const manana = addDaysToDateString(hoy, 1)
              const cntHoy = departures.filter(d => d.fecha_salida === hoy).length
              const cntManana = departures.filter(d => d.fecha_salida === manana).length
              const cntProximas = departures.filter(d => d.fecha_salida > manana).length
              return (
                <div className="flex border-b -mx-4 px-4">
                  {([
                    { key: "hoy" as const, label: "Hoy", count: cntHoy, dot: "bg-orange-500" },
                    { key: "manana" as const, label: "Mañana", count: cntManana, dot: "bg-blue-500" },
                    { key: "proximas" as const, label: "Próximas", count: cntProximas, dot: "bg-purple-500" },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setSalidasTab(tab.key)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                        salidasTab === tab.key
                          ? "border-orange-500 text-orange-700"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {tab.label}
                      <span className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold min-w-[18px] h-[18px] px-1 ${
                        salidasTab === tab.key
                          ? "bg-orange-500 text-white"
                          : tab.count > 0 ? "bg-gray-200 text-gray-700" : "bg-gray-100 text-gray-400"
                      }`}>{tab.count}</span>
                    </button>
                  ))}
                </div>
              )
            })()}
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-3">
                {[1,2].map(i => (
                  <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (() => {
              const hoy = getLocalDateString()
              const manana = addDaysToDateString(hoy, 1)
              const salidasHoy = departures.filter(d => d.fecha_salida === hoy)
              const salidasManana = departures.filter(d => d.fecha_salida === manana)
              const salidasProximas = departures.filter(d => d.fecha_salida > manana)

              const depMap: Record<string, any[]> = { hoy: salidasHoy, manana: salidasManana, proximas: salidasProximas }
              const currentDeps = depMap[salidasTab] || []

              const proximasByDate = salidasProximas.reduce<Record<string, any[]>>((acc, d) => {
                if (!acc[d.fecha_salida]) acc[d.fecha_salida] = []
                acc[d.fecha_salida].push(d)
                return acc
              }, {})

              function DepartureMiniCard({ dep, urgente }: { dep: any; urgente: boolean }) {
                const noches = dep.fecha_entrada ? calculateNights(dep.fecha_entrada, dep.fecha_salida) : null
                return (
                  <div className={`relative flex gap-3 rounded-xl border bg-white shadow-sm overflow-hidden transition hover:shadow-md ${
                    urgente ? "border-orange-200" : "border-gray-100"
                  }`}>
                    {/* Left accent bar */}
                    <div className={`w-1 shrink-0 self-stretch rounded-l-xl ${
                      urgente ? "bg-orange-400" : "bg-blue-400"
                    }`} />
                    <div className="flex flex-1 min-w-0 items-center gap-3 py-3 pr-3">
                      {/* Room badge */}
                      {dep.habitacion && (
                        <div className={`flex flex-col items-center justify-center shrink-0 rounded-lg px-2 py-1.5 min-w-[48px] ${
                          urgente ? "bg-orange-50 border border-orange-200" : "bg-blue-50 border border-blue-200"
                        }`}>
                          <BedDouble className={`h-3.5 w-3.5 mb-0.5 ${urgente ? "text-orange-500" : "text-blue-500"}`} />
                          <span className={`text-xs font-bold leading-none ${urgente ? "text-orange-700" : "text-blue-700"}`}>{dep.habitacion}</span>
                          <span className={`text-[9px] font-medium ${urgente ? "text-orange-500" : "text-blue-500"}`}>Hab.</span>
                        </div>
                      )}
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900 truncate">{dep.huesped}</p>
                          {urgente && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                              <Clock className="h-2.5 w-2.5" /> HOY
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">{dep.codigo_confirmacion}</p>
                        {dep.fecha_entrada && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500">
                            <span>{formatDateShort(dep.fecha_entrada)}</span>
                            <span className="text-gray-300">→</span>
                            <span className="font-medium text-gray-700">{formatDateShort(dep.fecha_salida)}</span>
                            {noches !== null && noches > 0 && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                                {noches}n
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Total + Button */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {dep.total != null && (
                          <span className="text-sm font-bold text-gray-800">{formatCurrency(dep.total)}</span>
                        )}
                        <Button
                          size="sm"
                          className={`h-7 px-2.5 text-xs gap-1 ${urgente ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-500 hover:bg-blue-600"} text-white`}
                          onClick={() => openCheckOut(dep)}
                        >
                          <LogOut className="h-3 w-3" />
                          Check-out
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              }

              if (currentDeps.length === 0) {
                return (
                  <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
                    <LogOut className="mx-auto h-8 w-8 text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400 font-medium">
                      {salidasTab === "hoy" && "Sin salidas para hoy"}
                      {salidasTab === "manana" && "Sin salidas para mañana"}
                      {salidasTab === "proximas" && "Sin salidas próximas"}
                    </p>
                    <p className="text-xs text-gray-300 mt-1">
                      {salidasTab === "proximas" ? "No hay huéspedes con checkout en los próximos días." : "No hay huéspedes con checkout programado."}
                    </p>
                  </div>
                )
              }

              if (salidasTab === "proximas") {
                return (
                  <div className="space-y-4">
                    {Object.entries(proximasByDate).sort(([a], [b]) => a.localeCompare(b)).map(([fecha, deps]) => {
                      const diasRestantes = calculateNights(hoy, fecha)
                      return (
                        <div key={fecha}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1.5 rounded-lg bg-purple-50 border border-purple-100 px-2.5 py-1">
                              <Calendar className="h-3.5 w-3.5 text-purple-500" />
                              <span className="text-xs font-bold text-purple-700">{formatDateShort(fecha)}</span>
                            </div>
                            <span className="text-xs text-gray-400">
                              {diasRestantes === 1 ? "en 1 día" : `en ${diasRestantes} días`} · {deps.length} salida{deps.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="space-y-2 pl-1">
                            {deps.map(dep => <DepartureMiniCard key={dep.id} dep={dep} urgente={false} />)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }

              return (
                <div className="space-y-2">
                  {currentDeps.map(dep => (
                    <DepartureMiniCard key={dep.id} dep={dep} urgente={salidasTab === "hoy"} />
                  ))}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      </div>


      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gray-50">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg">Estado de Habitaciones</CardTitle>
              <p className="mt-1 text-sm text-gray-500">Haz clic en una disponible para rentarla o en una ocupada para ver sus detalles.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:items-center">
              <span className="rounded-full bg-green-100 px-2.5 py-1 font-medium text-green-800">{rentableRooms.length} rentables</span>
              <span className="rounded-full bg-yellow-100 px-2.5 py-1 font-medium text-yellow-800">{occupiedRooms.length} ocupadas</span>
              <span className="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-800">{unavailableRooms.length} fuera de servicio</span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">{dirtyRooms.length} sucias</span>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-800">{cleaningRooms.length} en limpieza</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {dirtyRooms.length > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Hay {dirtyRooms.length} habitación{dirtyRooms.length !== 1 ? "es" : ""} marcada{dirtyRooms.length !== 1 ? "s" : ""} como sucia{dirtyRooms.length !== 1 ? "s" : ""}; no se pueden rentar hasta quedar limpias.
            </div>
          )}
          {cleaningRooms.length > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Hay {cleaningRooms.length} habitación{cleaningRooms.length !== 1 ? "es" : ""} en limpieza; estarán bloqueadas para renta hasta finalizar limpieza.
            </div>
          )}
          <div className="space-y-5">
            {floors.map(([floor, floorRooms]) => {
              const stats = floorStats(floorRooms)
              return (
                <section key={floor} className="rounded-2xl border bg-white p-3 shadow-sm sm:p-4">
                  <div className="mb-3 flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Piso {floor}</h3>
                      <p className="text-xs text-gray-500">{stats.total} habitacion{stats.total !== 1 ? "es" : ""} registradas en este piso</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-green-100 px-2.5 py-1 font-medium text-green-800">{stats.rentables} disponibles</span>
                      <span className="rounded-full bg-yellow-100 px-2.5 py-1 font-medium text-yellow-800">{stats.ocupadas} ocupadas</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">{stats.bloqueadas} no rentables</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {floorRooms.map((room) => (
                      <div
                        key={room.id}
                        onClick={() => handleRoomClick(room)}
                        className={`relative rounded-xl border p-3 text-center shadow-sm transition ${roomCardClass(room)}`}
                      >
                        <p className="text-xs font-medium uppercase tracking-wide opacity-70">Hab.</p>
                        <p className="font-bold text-2xl leading-tight">{room.numero}</p>
                        <p className="mt-1 truncate text-xs">{room.tipo_habitacion?.nombre}</p>
                        <p className="mt-2 text-xs font-semibold">{statusBadge(room.estado_operativo).label}</p>
                        <p className="text-[10px] font-medium opacity-75">{statusBadge(room.estado_limpieza).label}</p>
                        <p className="text-[10px] mt-0.5 opacity-60">
                          {room.tipo_habitacion ? formatCurrency(room.tipo_habitacion.precio_base) + "/noche" : ""}
                        </p>
                        <div className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                          room.estado_limpieza === "LIMPIA" ? "bg-green-500" :
                          room.estado_limpieza === "SUCIA" ? "bg-red-500" :
                          room.estado_limpieza === "EN_PROGRESO" ? "bg-blue-500" : "bg-purple-500"
                        }`} title={`Limpieza: ${room.estado_limpieza}`} />
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
            {rooms.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No hay habitaciones registradas.</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={accion?.tipo === "checkin"}
        onClose={() => { setAccion(null); setSelectedRoomId("") }}
        title="Check-in - Seleccionar Habitación"
      >
        {accion?.reserva && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm">
              <p><span className="font-medium">Huésped:</span> {accion.reserva.huesped}</p>
              <p><span className="font-medium">Código:</span> {accion.reserva.codigo_confirmacion}</p>
              <p><span className="font-medium">Salida:</span> {formatDateShort(accion.reserva.fecha_salida)}</p>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Habitación limpia disponible{matchingRooms.length > 0 ? ` (recomendadas: ${matchingRooms.length})` : ` (${rentableRooms.length} totales)`}</label>
              <div className="max-h-48 overflow-auto space-y-2 border rounded-md p-2">
                {(matchingRooms.length > 0 ? matchingRooms : rentableRooms).map((room) => (
                  <div
                    key={room.id}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-sm ${
                      selectedRoomId === room.id
                        ? "bg-blue-100 border border-blue-300"
                        : "bg-gray-50 hover:bg-gray-100 border border-transparent"
                    }`}
                    onClick={() => setSelectedRoomId(room.id)}
                  >
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Hab. {room.numero}</span>
                      <span className="text-gray-500">- {room.tipo_habitacion?.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        room.estado_limpieza === "LIMPIA" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>{room.estado_limpieza}</span>
                      {selectedRoomId === room.id && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                  </div>
                ))}
                {rentableRooms.length === 0 && <p className="text-sm text-gray-500 text-center py-2">No hay habitaciones limpias disponibles</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setAccion(null); setSelectedRoomId("") }}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={!selectedRoomId || confirming}>
                {confirming ? "Procesando..." : "Confirmar Check-in"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={accion?.tipo === "checkout"}
        onClose={() => { setAccion(null); setVerificacion(null) }}
        title="Verificar Salida"
        className="max-w-2xl"
      >
        {accion?.reserva && (
          <div className="space-y-4">
            {loadingDetalle ? (
              <div className="text-center py-6 text-gray-500">Cargando detalle de salida...</div>
            ) : verificacion ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm">
                  <p className="font-semibold">Hab. {verificacion.habitacion_numero} - {verificacion.habitacion_tipo}</p>
                  <p><span className="font-medium">Huésped:</span> {verificacion.huesped_nombre}</p>
                  {verificacion.huesped_documento && <p><span className="font-medium">Doc:</span> {verificacion.huesped_documento}</p>}
                  <p><span className="font-medium">Código:</span> {verificacion.codigo_confirmacion}</p>
                  <p><span className="font-medium">Estadía:</span> {verificacion.fecha_entrada} → {verificacion.fecha_salida} ({verificacion.noches} noche{verificacion.noches !== 1 ? "s" : ""})</p>
                </div>

                <div className="border rounded-md divide-y text-sm">
                  <div className="flex justify-between p-2"><span>Subtotal ({verificacion.noches} noche{verificacion.noches !== 1 ? "s" : ""})</span><span>{formatCurrency(verificacion.subtotal)}</span></div>
                  <div className="flex justify-between p-2"><span>Impuesto (15%)</span><span>{formatCurrency(verificacion.impuesto)}</span></div>
                  {verificacion.descuento > 0 && <div className="flex justify-between p-2 text-red-600"><span>Descuento</span><span>-{formatCurrency(verificacion.descuento)}</span></div>}
                  <div className="flex justify-between p-2 font-medium"><span>Total habitación</span><span>{formatCurrency(verificacion.total_habitacion)}</span></div>
                </div>

                <div className="border rounded-md divide-y text-sm">
                  <p className="p-2 font-medium">Consumos</p>
                  {verificacion.consumos.length === 0 ? (
                    <p className="p-2 text-gray-500">Sin consumos</p>
                  ) : (
                    verificacion.consumos.map((c: any) => (
                      <div key={c.id} className="flex justify-between p-2">
                        <span>{c.producto_nombre} x{c.cantidad}</span>
                        <span className={c.pagado ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(c.total)} {c.pagado ? "(pagado)" : ""}
                        </span>
                      </div>
                    ))
                  )}
                  {verificacion.total_consumos_pendientes > 0 && (
                    <div className="flex justify-between p-2 font-medium text-red-600">
                      <span>Total pendiente</span><span>{formatCurrency(verificacion.total_consumos_pendientes)}</span>
                    </div>
                  )}
                </div>

                {verificacion.mora_penalidad > 0 && (
                  <div className="flex justify-between p-2 bg-red-50 rounded-md text-sm font-medium text-red-700">
                    <span>Mora/Penalidad</span><span>{formatCurrency(verificacion.mora_penalidad)}</span>
                  </div>
                )}

                {verificacion.total_pagado > 0 && (
                  <div className="flex justify-between p-2 bg-green-50 rounded-md text-sm font-medium text-green-700">
                    <span>Total pagado (adelantos)</span><span>-{formatCurrency(verificacion.total_pagado)}</span>
                  </div>
                )}

                <div className="flex justify-between p-3 bg-blue-50 rounded-md text-base font-bold text-blue-800">
                  <span>Total a pagar</span><span>{formatCurrency(verificacion.total_a_pagar)}</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Método de pago</label>
                    <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={metodoPago}
                      onChange={(e) => {
                        setMetodoPago(e.target.value)
                        setCheckoutEfectivoRecibido("")
                      }}>
                      {metodosPago.length === 0 && <option value="">Configura un método de pago</option>}
                      {metodosPago.map((metodo) => <option key={metodo.id} value={metodo.nombre}>{metodo.nombre}</option>)}
                    </select>
                  </div>

                  {metodoPago.toLowerCase().includes("efectivo") && verificacion.total_a_pagar > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-950 flex items-center gap-1.5">
                          <Banknote className="h-4 w-4 text-emerald-700" />
                          Efectivo recibido del cliente *
                        </span>
                        <button
                          type="button"
                          onClick={() => setCheckoutEfectivoRecibido(verificacion.total_a_pagar.toString())}
                          className="text-xs text-emerald-800 underline font-semibold hover:text-emerald-950"
                        >
                          Exacto ({formatCurrency(verificacion.total_a_pagar)})
                        </button>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        value={checkoutEfectivoRecibido}
                        onChange={(e) => setCheckoutEfectivoRecibido(e.target.value)}
                        className="border-emerald-300 focus:border-emerald-500 font-semibold"
                      />
                      {getQuickCashOptions(verificacion.total_a_pagar).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {getQuickCashOptions(verificacion.total_a_pagar).map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setCheckoutEfectivoRecibido(amt.toString())}
                              className="px-2 py-0.5 text-xs rounded bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-medium"
                            >
                              {formatCurrency(amt)}
                            </button>
                          ))}
                        </div>
                      )}
                      {(parseFloat(checkoutEfectivoRecibido) || 0) >= verificacion.total_a_pagar ? (
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-600 text-white font-medium text-xs shadow-sm">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                            Cambio a devolver al huésped:
                          </span>
                          <span className="text-base font-bold">
                            {formatCurrency(Math.max(0, (parseFloat(checkoutEfectivoRecibido) || 0) - verificacion.total_a_pagar))}
                          </span>
                        </div>
                      ) : (parseFloat(checkoutEfectivoRecibido) || 0) > 0 ? (
                        <div className="flex items-center justify-between p-2 rounded bg-amber-100 border border-amber-300 text-amber-900 text-xs">
                          <span>⚠️ Monto insuficiente. Faltan:</span>
                          <span className="font-bold text-red-600">
                            {formatCurrency(verificacion.total_a_pagar - (parseFloat(checkoutEfectivoRecibido) || 0))}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-emerald-800/80 italic">
                          Ingresa el dinero recibido en efectivo para calcular el cambio a devolver.
                        </p>
                      )}
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleConfirm}
                    disabled={
                      culminando ||
                      verificacion.total_a_pagar < 0 ||
                      (metodoPago.toLowerCase().includes("efectivo") &&
                        verificacion.total_a_pagar > 0 &&
                        (parseFloat(checkoutEfectivoRecibido) || 0) < verificacion.total_a_pagar)
                    }
                  >
                    {culminando ? "Procesando..." : "Culminar Salida"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-500">Error al cargar datos de verificación</p>
            )}
          </div>
        )}
      </Dialog>

      <NuevaReservaDialog
        open={showQuickReserva}
        onClose={() => setShowQuickReserva(false)}
        onCreated={() => { setSuccess("Reserva creada correctamente"); loadData() }}
      />

      <RentarHabitacionDialog
        room={roomToRent}
        onClose={() => setRoomToRent(null)}
        onCreated={() => { setRoomToRent(null); setSuccess("Habitación rentada correctamente"); loadData() }}
      />

      <DetalleHabitacionOcupadaDialog
        room={occupiedRoom}
        onClose={() => setOccupiedRoom(null)}
        onUpdated={() => { setOccupiedRoom(null); setSuccess("Estadía extendida correctamente"); loadData() }}
      />

      <SuccessToast message={success} onClose={() => setSuccess("")} />
    </div>
  )
}

function NuevaReservaDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    nombres: "", apellidos: "", tipo_documento: "DNI", numero_documento: "",
    telefono: "", email: "",
    tipo_habitacion_id: "", fecha_entrada: "", fecha_salida: "",
    adultos: 1, ninos: 0, origen: "Walk-in",
  })
  const [tipos, setTipos] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      api.tiposHabitacion.listar().then(setTipos).catch(() => {})
      const hoy = getLocalDateString()
      const maniana = addDaysToDateString(hoy, 1)
      setForm((f) => ({ ...f, fecha_entrada: hoy, fecha_salida: maniana }))
    }
  }, [open])

  async function handleSubmit() {
    setError("")
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.fecha_entrada || !form.fecha_salida || !form.tipo_habitacion_id) {
      setError("Completa todos los campos obligatorios (*)")
      return
    }
    if (form.fecha_salida <= form.fecha_entrada) {
      setError("La fecha de salida debe ser posterior a la fecha de entrada")
      return
    }
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("El correo electrónico ingresado no tiene un formato válido")
      return
    }
    setSaving(true)
    try {
      const huespedes = await api.huespedes.listar(form.numero_documento)
      let huesped = huespedes.find((h: any) => h.numero_documento === form.numero_documento)
      if (!huesped) {
        huesped = await api.huespedes.crear({
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          tipo_documento: form.tipo_documento,
          numero_documento: form.numero_documento.trim() || undefined,
          telefono: form.telefono.trim() || undefined,
          email: form.email.trim() || undefined,
        })
      }
      await api.reservas.crear({
        huesped_id: huesped.id,
        tipo_habitacion_id: form.tipo_habitacion_id,
        fecha_entrada: form.fecha_entrada,
        fecha_salida: form.fecha_salida,
        adultos: form.adultos,
        ninos: form.ninos,
        origen: form.origen,
      })
      onClose()
      onCreated()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Nueva Reserva Rápida" className="max-w-xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nombres *</label>
            <Input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Apellidos *</label>
            <Input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Tipo Doc.</label>
            <select
              className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
              value={form.tipo_documento}
              onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}
            >
              <option value="DNI">DNI</option>
              <option value="Pasaporte">Pasaporte</option>
              <option value="Cédula">Cédula</option>
            </select>
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-sm font-medium">N° Documento</label>
            <Input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Teléfono</label>
            <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Tipo de Habitación *</label>
          <select
            className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
            value={form.tipo_habitacion_id}
            onChange={(e) => setForm({ ...form, tipo_habitacion_id: e.target.value })}
          >
            <option value="">Seleccionar...</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre} - {formatCurrency(t.precio_base)}/noche</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Entrada *</label>
            <Input type="date" value={form.fecha_entrada} onChange={(e) => setForm({ ...form, fecha_entrada: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Salida *</label>
            <Input type="date" value={form.fecha_salida} onChange={(e) => setForm({ ...form, fecha_salida: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Adultos</label>
            <Input type="number" min={1} value={form.adultos} onChange={(e) => setForm({ ...form, adultos: parseInt(e.target.value) || 1 })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Niños</label>
            <Input type="number" min={0} value={form.ninos} onChange={(e) => setForm({ ...form, ninos: parseInt(e.target.value) || 0 })} />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold animate-in fade-in shadow-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-100 transition"
              aria-label="Cerrar error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : "Crear Reserva"}
          </Button>
        </div>
      </div>
      <ErrorToast message={error} onClose={() => setError("")} />
    </Dialog>
  )
}

function DetalleHabitacionOcupadaDialog({ room, onClose, onUpdated }: { room: any | null; onClose: () => void; onUpdated: () => void }) {
  const [detalle, setDetalle] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [nuevaFechaSalida, setNuevaFechaSalida] = useState("")
  const [extending, setExtending] = useState(false)

  useEffect(() => {
    if (!room) return

    setLoading(true)
    setDetalle(null)
    setError("")
    setNuevaFechaSalida("")
    api.ventas.detalleOcupacion(room.id)
      .then(setDetalle)
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [room])

  async function handleExtension() {
    if (!detalle || !nuevaFechaSalida) return
    setExtending(true)
    setError("")
    try {
      const resultado = await api.reservas.extenderEstadia(detalle.reserva_id, nuevaFechaSalida)
      setDetalle((actual: any) => ({ ...actual, fecha_salida: resultado.nueva_fecha_salida }))
      setNuevaFechaSalida("")
      onUpdated()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setExtending(false)
    }
  }

  return (
    <Dialog open={!!room} onClose={onClose} title={`Habitación ${room?.numero} ocupada`} className="max-w-2xl">
      {loading ? (
        <p className="text-sm text-gray-500">Cargando detalles...</p>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
      ) : detalle ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-yellow-700">Estadía activa</p>
                <h3 className="mt-1 text-xl font-bold text-yellow-950">{detalle.huesped?.nombre}</h3>
                <p className="text-sm text-yellow-800">Reserva {detalle.codigo_confirmacion}</p>
              </div>
              <Badge variant="warning">Ocupada</Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="Habitación" value={`${detalle.habitacion?.numero || "-"} · ${detalle.habitacion?.tipo || "Sin tipo"}`} />
            <InfoItem label="Piso" value={detalle.habitacion?.piso || "-"} />
            <InfoItem label="Entrada" value={formatDateShort(detalle.fecha_entrada)} />
            <InfoItem label="Salida" value={formatDateShort(detalle.fecha_salida)} />
            <InfoItem label="Huéspedes" value={`${detalle.adultos} adulto${detalle.adultos !== 1 ? "s" : ""}, ${detalle.ninos} niño${detalle.ninos !== 1 ? "s" : ""}`} />
            <InfoItem label="Total habitación" value={formatCurrency(detalle.total || 0)} />
          </div>

          <div className="rounded-xl border p-4">
            <h4 className="text-sm font-semibold">Datos del huésped</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <InfoItem label="Documento" value={`${detalle.huesped?.tipo_documento || "Doc."}: ${detalle.huesped?.numero_documento || "-"}`} />
              <InfoItem label="Teléfono" value={detalle.huesped?.telefono || "-"} />
              <InfoItem label="Email" value={detalle.huesped?.email || "-"} />
              <InfoItem label="Nacionalidad" value={detalle.huesped?.nacionalidad || "-"} />
              <InfoItem label="Dirección" value={detalle.huesped?.direccion || "-"} className="sm:col-span-2" />
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${detalle.tiene_vehiculo ? "border-blue-200 bg-blue-50" : "bg-gray-50"}`}>
            <h4 className="text-sm font-semibold">Vehículo</h4>
            <p className="mt-2 text-sm text-gray-700">
              {detalle.tiene_vehiculo ? detalle.detalle_vehiculo || "Tiene vehículo, sin detalle registrado." : "No tiene vehículo registrado."}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1 space-y-1">
                <h4 className="text-sm font-semibold text-blue-950">Extender estadía</h4>
                <p className="text-xs text-blue-800">Conserva esta reserva, sus pagos y su folio actual.</p>
                <Input
                  type="date"
                  min={detalle.fecha_salida}
                  value={nuevaFechaSalida}
                  onChange={(event) => setNuevaFechaSalida(event.target.value)}
                />
              </div>
              <Button onClick={handleExtension} disabled={extending || !nuevaFechaSalida}>
                {extending ? "Guardando..." : "Confirmar extensión"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      ) : null}
      <ErrorToast message={error} onClose={() => setError("")} />
    </Dialog>
  )
}

function InfoItem({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{value}</p>
    </div>
  )
}

function RentarHabitacionDialog({ room, onClose, onCreated }: { room: any | null; onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<"buscar" | "nuevo">("buscar")
  const [searchTerm, setSearchTerm] = useState("")
  const [guestResults, setGuestResults] = useState<any[]>([])
  const [selectedGuest, setSelectedGuest] = useState<any | null>(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [tipoRegistro, setTipoRegistro] = useState<"hospedar" | "reserva">("hospedar")
  const [extraDesc, setExtraDesc] = useState("")
  const [extraMonto, setExtraMonto] = useState<string>("")
  const [taxRate, setTaxRate] = useState(15)
  const [metodosPago, setMetodosPago] = useState<any[]>([])
  const [efectivoRecibido, setEfectivoRecibido] = useState("")

  const [form, setForm] = useState({
    nombres: "",
    apellidos: "",
    tipo_documento: "DNI",
    numero_documento: "",
    telefono: "",
    email: "",
    fecha_entrada: "",
    hora_entrada: "15:00",
    fecha_salida: "",
    hora_salida: "12:00",
    adultos: 1,
    ninos: 0,
    descuento: "" as string | number,
    adelanto: "" as string | number,
    metodo_pago: "",
    tiene_vehiculo: false,
    detalle_vehiculo: "",
  })

  useEffect(() => {
    if (!room) return
    Promise.all([api.configuracion.obtener(), api.metodosPago.listar()])
      .then(([config, metodos]) => {
        const activos = metodos.filter((metodo: any) => metodo.activo)
        setTaxRate(Number(config.impuesto) || 0)
        setMetodosPago(activos)
        setForm((actual) => ({
          ...actual,
          metodo_pago: actual.metodo_pago || activos[0]?.nombre || "",
        }))
      })
      .catch(() => setTaxRate(15))
  }, [room])

  useEffect(() => {
    if (room) {
      setStep("buscar")
      setSelectedGuest(null)
      setSearchTerm("")
      setGuestResults([])
      setError("")
      setTipoRegistro("hospedar")
      setExtraDesc("")
      setExtraMonto("")
      setEfectivoRecibido("")
      const hoy = getLocalDateString()
      const maniana = addDaysToDateString(hoy, 1)
      setForm((f) => ({
        ...f,
        nombres: "",
        apellidos: "",
        tipo_documento: "DNI",
        numero_documento: "",
        telefono: "",
        email: "",
        fecha_entrada: hoy,
        fecha_salida: maniana,
        adultos: 1,
        ninos: 0,
        descuento: "",
        adelanto: "",
        tiene_vehiculo: false,
        detalle_vehiculo: "",
      }))
    }
  }, [room])

  // Calculations
  const precioNoche = Number(room?.tipo_habitacion?.precio_base) || 0
  const noches = calculateNights(form.fecha_entrada, form.fecha_salida)
  const subtotal = Math.round(precioNoche * noches * 100) / 100
  const impuesto = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const numDescuento = Math.max(0, parseFloat(String(form.descuento)) || 0)
  const numExtra = Math.max(0, parseFloat(String(extraMonto)) || 0)
  const totalNeto = Math.max(0, Math.round((subtotal + impuesto - numDescuento + numExtra) * 100) / 100)
  const totalFinal = totalNeto

  const rawAdelanto = parseFloat(String(form.adelanto))
  const numAdelanto = isNaN(rawAdelanto) ? 0 : Math.max(0, rawAdelanto)
  const adelanto = Math.min(numAdelanto, totalFinal)
  const saldo = Math.max(0, Math.round((totalFinal - adelanto) * 100) / 100)

  // Cash and change calculations
  const isEfectivo = form.metodo_pago.toLowerCase().includes("efectivo") || form.metodo_pago.toLowerCase() === "cash"
  const rawRecibido = parseFloat(efectivoRecibido)
  const numRecibido = isNaN(rawRecibido) ? 0 : Math.max(0, rawRecibido)
  const cambio = Math.max(0, Math.round((numRecibido - adelanto) * 100) / 100)
  const efectivoFaltante = Math.max(0, Math.round((adelanto - numRecibido) * 100) / 100)

  const quickCashOptions = getQuickCashOptions(adelanto)

  // Capacity validation
  const capBase = room?.tipo_habitacion?.capacidad_base || 2
  const capMax = room?.tipo_habitacion?.capacidad_maxima || capBase
  const totalPersonas = Number(form.adultos || 0) + Number(form.ninos || 0)
  const excedeCapacidad = totalPersonas > capMax

  // Date handlers
  function handleFechaEntradaChange(nuevaEntrada: string) {
    setForm((f) => {
      let nuevaSalida = f.fecha_salida
      if (!nuevaSalida || nuevaSalida <= nuevaEntrada) {
        nuevaSalida = addDaysToDateString(nuevaEntrada, 1)
      }
      return { ...f, fecha_entrada: nuevaEntrada, fecha_salida: nuevaSalida }
    })
  }

  function handleFechaSalidaChange(nuevaSalida: string) {
    setForm((f) => ({ ...f, fecha_salida: nuevaSalida }))
  }

  // Quick adelanto shortcuts
  function handleAdelantoRapido(tipo: "todo" | "mitad" | "cero") {
    if (tipo === "todo") {
      setForm((f) => ({ ...f, adelanto: totalFinal }))
      if (isEfectivo) {
        setEfectivoRecibido(totalFinal.toString())
      }
    } else if (tipo === "mitad") {
      const mitad = Math.round((totalFinal / 2) * 100) / 100
      setForm((f) => ({ ...f, adelanto: mitad }))
      if (isEfectivo) {
        setEfectivoRecibido(mitad.toString())
      }
    } else {
      setForm((f) => ({ ...f, adelanto: 0 }))
      setEfectivoRecibido("")
    }
  }

  useEffect(() => {
    if (!room || step !== "buscar") return

    const term = searchTerm.trim()
    if (!term) {
      setGuestResults([])
      setSearching(false)
      return
    }

    let active = true
    setSearching(true)
    const timer = window.setTimeout(() => {
      api.huespedes.listar(term)
        .then((results) => {
          if (active) setGuestResults(results)
        })
        .catch((err: any) => {
          if (active) setError(err.message)
        })
        .finally(() => {
          if (active) setSearching(false)
        })
    }, 350)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [room, searchTerm, step])

  async function handleSubmit() {
    if (!room) return
    setError("")

    if (room.estado_limpieza !== "LIMPIA") {
      setError("Esta habitación no se puede rentar porque no está en estado LIMPIA")
      return
    }

    if (room.estado_operativo !== "DISPONIBLE") {
      setError(`Esta habitación no está disponible para renta (Estado: ${room.estado_operativo})`)
      return
    }

    if (step === "buscar" && !selectedGuest) {
      setError("Debes seleccionar un huésped existente o pulsar '+ Nuevo' para registrar uno")
      return
    }

    if (!form.fecha_entrada || !form.fecha_salida) {
      setError("Selecciona las fechas de entrada y salida")
      return
    }

    if (form.fecha_salida <= form.fecha_entrada) {
      setError("La fecha de salida debe ser posterior a la fecha de entrada")
      return
    }

    if (noches < 1) {
      setError("La estancia debe ser de al menos 1 noche")
      return
    }

    if (Number(form.adultos) < 1) {
      setError("Debe registrarse al menos 1 adulto")
      return
    }

    if (Number(form.ninos) < 0) {
      setError("El número de niños no puede ser negativo")
      return
    }

    if (form.tiene_vehiculo && !form.detalle_vehiculo.trim()) {
      setError("Has marcado que anda vehículo; por favor indica marca, modelo o número de placa")
      return
    }

    if (numExtra > 0 && !extraDesc.trim()) {
      setError("Ingresaste un monto extra; debes indicar una descripción para dicho cargo (ej: Cama adicional)")
      return
    }

    if (extraDesc.trim() && numExtra <= 0) {
      setError("Indicaste una descripción de cargo extra; debes especificar un monto mayor a 0")
      return
    }

    if (numDescuento < 0) {
      setError("El descuento no puede ser negativo")
      return
    }

    if (numDescuento > subtotal + impuesto + numExtra) {
      setError(`El descuento no puede superar el total a cobrar (${formatCurrency(subtotal + impuesto + numExtra)})`)
      return
    }

    if (numAdelanto < 0) {
      setError("El adelanto a pagar no puede ser negativo")
      return
    }

    if (numAdelanto > totalFinal + 0.01) {
      setError(`El adelanto (${formatCurrency(numAdelanto)}) no puede superar el total a pagar (${formatCurrency(totalFinal)})`)
      return
    }

    if (adelanto > 0) {
      if (!form.metodo_pago) {
        setError("Selecciona el método de pago con el que se recibe el adelanto")
        return
      }
      if (isEfectivo) {
        if (!efectivoRecibido.trim() || numRecibido <= 0) {
          setError("Ingresa el monto de efectivo recibido del cliente para dar el cambio")
          return
        }
        if (numRecibido < adelanto) {
          setError(`El efectivo recibido (${formatCurrency(numRecibido)}) es insuficiente. Faltan ${formatCurrency(efectivoFaltante)}`)
          return
        }
      }
    }

    let guest = selectedGuest

    if (step === "nuevo") {
      if (!form.nombres.trim() || !form.apellidos.trim()) {
        setError("Completa nombres y apellidos del nuevo huésped")
        return
      }
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        setError("El correo electrónico del nuevo huésped no tiene un formato válido")
        return
      }
      try {
        guest = await api.huespedes.crear({
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          tipo_documento: form.tipo_documento,
          numero_documento: form.numero_documento.trim() || undefined,
          telefono: form.telefono.trim() || undefined,
          email: form.email.trim() || undefined,
        })
      } catch (err: any) {
        setError(err.message)
        return
      }
    } else if (selectedGuest) {
      if (!selectedGuest.nombres?.trim() || !selectedGuest.apellidos?.trim()) {
        setError("Los nombres y apellidos del huésped son obligatorios")
        return
      }
      if (selectedGuest.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(selectedGuest.email.trim())) {
        setError("El correo electrónico del huésped no tiene un formato válido")
        return
      }
    }

    setSaving(true)
    try {
      if (step === "buscar" && selectedGuest) {
        guest = await api.huespedes.actualizar(selectedGuest.id, {
          nombres: selectedGuest.nombres.trim(),
          apellidos: selectedGuest.apellidos.trim(),
          tipo_documento: selectedGuest.tipo_documento || undefined,
          numero_documento: selectedGuest.numero_documento?.trim() || undefined,
          telefono: selectedGuest.telefono?.trim() || undefined,
          email: selectedGuest.email?.trim() || undefined,
          nacionalidad: selectedGuest.nacionalidad?.trim() || undefined,
          direccion: selectedGuest.direccion?.trim() || undefined,
          fecha_nacimiento: selectedGuest.fecha_nacimiento || undefined,
          notas: selectedGuest.notas?.trim() || undefined,
        })
      }

      const reserva = await api.reservas.crear({
        huesped_id: guest.id,
        tipo_habitacion_id: room.tipo_habitacion_id,
        habitacion_id: room.id,
        fecha_entrada: form.fecha_entrada,
        fecha_salida: form.fecha_salida,
        adultos: form.adultos,
        ninos: form.ninos,
        descuento: numDescuento,
        origen: "Walk-in",
        tiene_vehiculo: form.tiene_vehiculo,
        detalle_vehiculo: form.tiene_vehiculo ? form.detalle_vehiculo.trim() : undefined,
      })

      if (numExtra > 0) {
        await api.facturacion.agregarCargo(reserva.id, {
          descripcion: extraDesc.trim() || "Cargo extra",
          cantidad: 1,
          precio_unitario: numExtra,
          total: numExtra,
        })
      }

      if (adelanto > 0) {
        const refPago = isEfectivo && numRecibido
          ? `Adelanto efectivo (Recibido: ${formatCurrency(numRecibido)}, Cambio: ${formatCurrency(cambio)})`
          : `Adelanto - ${form.fecha_entrada}`
        await api.facturacion.agregarPago(reserva.id, {
          monto: adelanto,
          metodo_pago: form.metodo_pago,
          referencia: refPago,
        })
      }

      if (tipoRegistro === "hospedar") {
        await api.reservas.checkIn(reserva.id, room.id)
      }

      onCreated()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <Dialog open={!!room} onClose={onClose} title={`Rentar Habitación ${room?.numero}`} className="max-w-4xl">
      {room && (
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Room Header Info */}
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-3.5 rounded-xl shadow-sm">
            <div>
              <p className="text-base font-bold text-gray-900">{room.tipo_habitacion?.nombre} · Habitación {room.numero}</p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-600">
                <span>Piso {room.piso || "-"}</span>
                <span>•</span>
                <span>Capacidad sugerida: {capBase} pers. (Máx. {capMax})</span>
                <span>•</span>
                <span className="inline-flex items-center text-green-700 font-semibold bg-green-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Lista para rentar
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-extrabold text-blue-700">{formatCurrency(precioNoche)}</p>
              <p className="text-xs text-gray-500 font-medium">por noche</p>
            </div>
          </div>

          {/* Type Toggle: Hospedar inmediato vs Reserva */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${tipoRegistro === "hospedar" ? "bg-white shadow text-blue-700 ring-1 ring-black/5" : "text-gray-600 hover:text-gray-900"}`}
              onClick={() => setTipoRegistro("hospedar")}
            >
              🏨 Hospedar Inmediato (Check-in ahora)
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${tipoRegistro === "reserva" ? "bg-white shadow text-blue-700 ring-1 ring-black/5" : "text-gray-600 hover:text-gray-900"}`}
              onClick={() => setTipoRegistro("reserva")}
            >
              📋 Solo Reservar
            </button>
          </div>

          {/* Guest selection / creation */}
          {step === "buscar" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-800">Huésped Titular *</label>
                <Button size="sm" variant="outline" onClick={() => { setStep("nuevo"); setSelectedGuest(null) }} className="text-xs h-8">
                  <Plus className="h-3.5 w-3.5 mr-1 text-blue-600" /> Crear Nuevo Huésped
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nombre, documento o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {searching && <p className="text-xs text-gray-500 animate-pulse">Buscando huéspedes...</p>}

              {guestResults.length > 0 && !selectedGuest && (
                <div className="max-h-36 overflow-auto space-y-1 border rounded-lg p-1.5 bg-white shadow-sm">
                  {guestResults.map((g) => (
                    <div
                      key={g.id}
                      className="p-2 rounded-md cursor-pointer text-sm bg-gray-50 hover:bg-blue-50 transition border border-transparent hover:border-blue-200"
                      onClick={() => setSelectedGuest(g)}
                    >
                      <p className="font-semibold text-gray-900">{g.nombres} {g.apellidos}</p>
                      <p className="text-xs text-gray-500">{g.tipo_documento || "Doc"}: {g.numero_documento || "S/D"} · Tel: {g.telefono || "S/T"}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedGuest && (
                <div className="rounded-xl border border-green-200 bg-green-50/70 p-4 text-sm shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3 border-b border-green-200/80 pb-2">
                    <div>
                      <span className="inline-flex items-center text-xs font-semibold uppercase tracking-wider text-green-800 bg-green-100 px-2 py-0.5 rounded">
                        ✓ Huésped Seleccionado
                      </span>
                      <p className="font-bold text-gray-900 mt-1">{selectedGuest.nombres} {selectedGuest.apellidos}</p>
                      <p className="text-xs text-green-800">Puedes verificar o actualizar sus datos de contacto aquí mismo.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedGuest(null)}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 bg-white border border-red-200 px-2 py-1 rounded"
                    >
                      Cambiar
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700">Nombres *</label>
                      <Input value={selectedGuest.nombres || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, nombres: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700">Apellidos *</label>
                      <Input value={selectedGuest.apellidos || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, apellidos: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700">N° Documento</label>
                      <Input value={selectedGuest.numero_documento || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, numero_documento: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700">Teléfono</label>
                      <Input value={selectedGuest.telefono || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, telefono: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-700">Email</label>
                      <Input type="email" value={selectedGuest.email || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, email: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "nuevo" && (
            <div className="space-y-3 p-4 bg-gray-50 border rounded-xl shadow-sm">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-blue-600" /> Registrar Nuevo Huésped
                </span>
                <button
                  type="button"
                  onClick={() => setStep("buscar")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                >
                  Buscar Huésped Existente
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Nombres *</label>
                  <Input placeholder="Ej: Juan Carlos" value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Apellidos *</label>
                  <Input placeholder="Ej: Pérez Rodríguez" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Tipo Doc.</label>
                  <select className={inputCls} value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}>
                    <option value="DNI">DNI</option>
                    <option value="Pasaporte">Pasaporte</option>
                    <option value="Cédula">Cédula</option>
                    <option value="Licencia">Licencia</option>
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-700">N° Documento</label>
                  <Input placeholder="0801-1990-12345" value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Teléfono</label>
                  <Input placeholder="9999-9999" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">Email</label>
                  <Input type="email" placeholder="cliente@ejemplo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* Dates & Times */}
          <div className="rounded-xl border p-4 bg-white shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-600" /> Fechas de Estadía
              </span>
              <span className="inline-flex items-center font-bold text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                {noches} {noches === 1 ? "noche" : "noches"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Entrada *</label>
                <Input
                  type="date"
                  min={getLocalDateString()}
                  value={form.fecha_entrada}
                  onChange={(e) => handleFechaEntradaChange(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Hora Entrada</label>
                <Input type="time" value={form.hora_entrada} onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Salida *</label>
                <Input
                  type="date"
                  min={addDaysToDateString(form.fecha_entrada, 1)}
                  value={form.fecha_salida}
                  onChange={(e) => handleFechaSalidaChange(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Hora Salida</label>
                <Input type="time" value={form.hora_salida} onChange={(e) => setForm({ ...form, hora_salida: e.target.value })} />
              </div>
            </div>

            {/* Guests count */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Adultos (mín. 1) *</label>
                <Input
                  type="number"
                  min={1}
                  value={form.adultos}
                  onChange={(e) => setForm({ ...form, adultos: Math.max(1, parseInt(e.target.value) || 1) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Niños</label>
                <Input
                  type="number"
                  min={0}
                  value={form.ninos}
                  onChange={(e) => setForm({ ...form, ninos: Math.max(0, parseInt(e.target.value) || 0) })}
                />
              </div>
            </div>

            {excedeCapacidad && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg font-medium">
                ⚠️ Atención: La capacidad máxima sugerida para esta habitación es de {capMax} personas. Has indicado {totalPersonas} personas.
              </p>
            )}
          </div>

          {/* Vehicle Check */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3.5 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">¿El huésped tiene vehículo?</p>
                <p className="text-xs text-gray-500">Se registrará en el sistema para control de estacionamiento.</p>
              </div>
              <div className="flex rounded-lg bg-white p-1 text-xs font-semibold ring-1 ring-gray-200">
                <button
                  type="button"
                  className={`rounded-md px-4 py-1.5 transition ${!form.tiene_vehiculo ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                  onClick={() => setForm({ ...form, tiene_vehiculo: false, detalle_vehiculo: "" })}
                >
                  No
                </button>
                <button
                  type="button"
                  className={`rounded-md px-4 py-1.5 transition ${form.tiene_vehiculo ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                  onClick={() => setForm({ ...form, tiene_vehiculo: true })}
                >
                  Sí
                </button>
              </div>
            </div>
            {form.tiene_vehiculo && (
              <div className="space-y-1 pt-1">
                <label className="text-xs font-semibold text-gray-700">Detalles del vehículo (Marca, Modelo, Placa) *</label>
                <Input
                  placeholder="Ej: Toyota Hilux gris, Placa HAK-1234"
                  value={form.detalle_vehiculo}
                  onChange={(e) => setForm({ ...form, detalle_vehiculo: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Extra charge & Discount */}
          <div className="rounded-xl border p-4 bg-white shadow-sm space-y-3">
            <h4 className="text-sm font-bold text-gray-900">Cargos Extra y Descuento</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Descuento aplicado</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.descuento}
                  onChange={(e) => setForm({ ...form, descuento: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Descripción de Cargo Extra</label>
                <Input
                  placeholder="Ej: Cama adicional, Early check-in..."
                  value={extraDesc}
                  onChange={(e) => setExtraDesc(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Monto Cargo Extra</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={extraMonto}
                  onChange={(e) => setExtraMonto(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm border shadow-sm">
            <div className="flex justify-between text-gray-600">
              <span>Hospedaje ({noches} noche{noches !== 1 ? "s" : ""} × {formatCurrency(precioNoche)})</span>
              <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Impuesto hotelero ({taxRate}%)</span>
              <span className="font-semibold text-gray-900">+{formatCurrency(impuesto)}</span>
            </div>
            {numDescuento > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Descuento</span>
                <span className="font-semibold">-{formatCurrency(numDescuento)}</span>
              </div>
            )}
            {numExtra > 0 && (
              <div className="flex justify-between text-blue-700">
                <span>Cargo extra ({extraDesc || "Adicional"})</span>
                <span className="font-semibold">+{formatCurrency(numExtra)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-base pt-2 border-t mt-1 text-gray-900">
              <span>TOTAL ESTADÍA</span>
              <span className="text-blue-800 text-lg">{formatCurrency(totalFinal)}</span>
            </div>
          </div>

          {/* Payment Section: Adelanto / Immediate Payment */}
          <div className="rounded-xl border p-4 bg-white shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-emerald-600" /> Cobro en Recepción (Adelanto / Total)
                </h4>
                <p className="text-xs text-gray-500">Monto que el huésped pagará en este momento.</p>
              </div>

              {/* Quick shortcut buttons */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAdelantoRapido("todo")}
                  className="px-2.5 py-1 text-xs rounded-md bg-emerald-50 border border-emerald-300 text-emerald-800 font-semibold hover:bg-emerald-100 transition"
                >
                  Cobrar Todo ({formatCurrency(totalFinal)})
                </button>
                <button
                  type="button"
                  onClick={() => handleAdelantoRapido("mitad")}
                  className="px-2.5 py-1 text-xs rounded-md bg-blue-50 border border-blue-300 text-blue-800 font-semibold hover:bg-blue-100 transition"
                >
                  Cobrar 50% ({formatCurrency(Math.round((totalFinal / 2) * 100) / 100)})
                </button>
                <button
                  type="button"
                  onClick={() => handleAdelantoRapido("cero")}
                  className="px-2.5 py-1 text-xs rounded-md bg-gray-50 border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition"
                >
                  Sin cobro ahora ($0)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Monto a Cobrar Ahora *</label>
                <Input
                  type="number"
                  min={0}
                  max={totalFinal}
                  step={0.01}
                  placeholder="0.00"
                  value={form.adelanto}
                  onChange={(e) => {
                    setForm({ ...form, adelanto: e.target.value })
                    if (isEfectivo && efectivoRecibido) {
                      // re-eval
                    }
                  }}
                  className="font-bold text-base"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Método de Pago *</label>
                <select
                  className={inputCls}
                  value={form.metodo_pago}
                  onChange={(e) => {
                    setForm({ ...form, metodo_pago: e.target.value })
                    setEfectivoRecibido("")
                  }}
                >
                  {metodosPago.length === 0 && <option value="">Configura un método de pago</option>}
                  {metodosPago.map((metodo) => (
                    <option key={metodo.id} value={metodo.nombre}>
                      {metodo.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Saldo summary */}
            <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-gray-50 border">
              <span className="text-gray-600 font-medium">
                Cobro ahora: <strong className="text-emerald-700">{formatCurrency(adelanto)}</strong>
              </span>
              <span className="text-gray-600 font-medium">
                Saldo pendiente en Check-out: <strong className="text-blue-700">{formatCurrency(saldo)}</strong>
              </span>
            </div>

            {/* CASH PAYMENT & CHANGE SECTION (Calculadora de cambio para efectivo) */}
            {isEfectivo && adelanto > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-emerald-700" />
                    <div>
                      <h5 className="font-bold text-emerald-950 text-sm">Pago en Efectivo y Cambio</h5>
                      <p className="text-[11px] text-emerald-800">Calculadora automática de cambio para el cliente.</p>
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-900 font-bold px-2.5 py-1 rounded-full border border-emerald-300">
                    A cobrar: {formatCurrency(adelanto)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-950">Efectivo Recibido del Huésped *</label>
                      <button
                        type="button"
                        onClick={() => setEfectivoRecibido(adelanto.toString())}
                        className="text-[11px] text-emerald-800 hover:text-emerald-950 font-semibold underline"
                      >
                        Monto exacto
                      </button>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={efectivoRecibido}
                      onChange={(e) => setEfectivoRecibido(e.target.value)}
                      className="border-emerald-300 focus:border-emerald-500 font-extrabold text-base bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-emerald-900">Billetes sugeridos</label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEfectivoRecibido(adelanto.toString())}
                        className="px-2 py-1 text-xs rounded-md bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-semibold shadow-2xs"
                      >
                        Exacto ({formatCurrency(adelanto)})
                      </button>
                      {quickCashOptions.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setEfectivoRecibido(amount.toString())}
                          className="px-2 py-1 text-xs rounded-md bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-semibold shadow-2xs"
                        >
                          {formatCurrency(amount)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Change calculation display */}
                {numRecibido >= adelanto ? (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-600 text-white font-medium shadow-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-200" />
                      <span className="text-sm font-semibold">Cambio a entregar al cliente:</span>
                    </div>
                    <span className="text-xl font-extrabold tracking-tight">
                      {formatCurrency(cambio)}
                    </span>
                  </div>
                ) : numRecibido > 0 ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      El dinero recibido es insuficiente. Faltan:
                    </span>
                    <span className="font-extrabold text-sm text-red-600">
                      {formatCurrency(efectivoFaltante)}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-800/80 italic">
                    Ingresa el monto en efectivo recibido para ver el cambio exacto a entregar.
                  </p>
                )}
              </div>
            )}

            {adelanto === 0 && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 font-medium">
                ℹ️ No se realizará cobro en este momento. El total completo de {formatCurrency(totalFinal)} se cobrará al finalizar la estancia en el Check-out.
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t space-y-2.5">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold animate-in fade-in shadow-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-100 transition"
                  aria-label="Cerrar error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  saving ||
                  (!selectedGuest && step === "buscar") ||
                  (isEfectivo && adelanto > 0 && numRecibido < adelanto)
                }
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5"
              >
                {saving ? "Procesando..." : tipoRegistro === "hospedar" ? "🏨 Confirmar y Hospedar" : "📋 Confirmar Reserva"}
              </Button>
            </div>
          </div>
        </div>
      )}
      <ErrorToast message={error} onClose={() => setError("")} />
    </Dialog>
  )
}
