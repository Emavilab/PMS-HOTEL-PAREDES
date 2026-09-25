"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, statusBadge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { AlertTriangle, BedDouble, Calendar, Check, ClipboardList, Clock, DoorOpen, LogIn, LogOut, Plus, RefreshCw, Search, X } from "lucide-react"

interface AccionConfirmar {
  tipo: "checkin" | "checkout"
  reserva: any
}

export default function RecepcionPage() {
  const [arrivals, setArrivals] = useState<any[]>([])
  const [departures, setDepartures] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [accion, setAccion] = useState<AccionConfirmar | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string>("")
  const [confirming, setConfirming] = useState(false)

  const [verificacion, setVerificacion] = useState<any | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [metodosPago, setMetodosPago] = useState<any[]>([])
  const [metodoPago, setMetodoPago] = useState("")
  const [culminando, setCulminando] = useState(false)

  const [showQuickReserva, setShowQuickReserva] = useState(false)
  const [roomToRent, setRoomToRent] = useState<any | null>(null)
  const [occupiedRoom, setOccupiedRoom] = useState<any | null>(null)
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<any[] | null>(null)
  const [searching, setSearching] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.reportes.llegadas(),
      api.reportes.salidas(),
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
      } else {
        if (!verificacion) {
          setError("No hay datos de verificación de salida")
          setConfirming(false)
          return
        }
        setCulminando(true)
        await api.ventas.culminarSalida(accion.reserva.reserva_id || accion.reserva.id, metodoPago)
      }
      setAccion(null)
      setSelectedRoomId("")
      setVerificacion(null)
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

  async function handleSearch() {
    if (!search.trim()) return
    setSearching(true)
    try {
      const results = await api.huespedes.listar(search)
      setSearchResults(results)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

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
              <Button variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={() => setShowQuickReserva(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nueva Reserva
              </Button>
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
              <p className="mt-2 text-3xl font-bold">{loading ? "-" : departures.length}</p>
              <p className="text-xs text-blue-50">Habitaciones por liberar</p>
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

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Buscar huésped por nombre, documento o email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={searching || !search.trim()} className="sm:w-32">
              {searching ? "Buscando" : "Buscar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchResults !== null && (
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Resultados de búsqueda</CardTitle>
              <button onClick={() => { setSearchResults(null); setSearch("") }} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="py-2">
            {searching ? (
              <p className="text-sm text-gray-500">Buscando...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-gray-500">No se encontraron huéspedes</p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                    <div>
                      <p className="font-medium">{h.nombres} {h.apellidos}</p>
                      <p className="text-xs text-gray-500">{h.tipo_documento}: {h.numero_documento} {h.email && `| ${h.email}`}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>
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
          <CardHeader className="border-b bg-orange-50/70">
            <CardTitle className="text-lg flex items-center gap-2">
              <LogOut className="h-5 w-5 text-orange-600" /> Salidas del Día
              {!loading && <span className="text-sm font-normal text-gray-500">({departures.length})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : departures.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                No hay salidas programadas para hoy.
              </div>
            ) : (
              <div className="space-y-2">
                {departures.map((dep) => (
                  <div key={dep.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{dep.huesped}</p>
                      <p className="text-xs text-gray-500">{dep.codigo_confirmacion}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        {dep.habitacion && <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" />Hab. {dep.habitacion}</span>}
                        {dep.total != null && <span className="font-medium text-gray-600">{formatCurrency(dep.total)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 sm:ml-2">
                      <Badge {...statusBadge(dep.estado)} />
                      <Button size="sm" variant="secondary" onClick={() => openCheckOut(dep)}>
                        Check-out
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                      onChange={(e) => setMetodoPago(e.target.value)}>
                      {metodosPago.length === 0 && <option value="">Configura un método de pago</option>}
                      {metodosPago.map((metodo) => <option key={metodo.id} value={metodo.nombre}>{metodo.nombre}</option>)}
                    </select>
                  </div>
                  <Button className="w-full" onClick={handleConfirm} disabled={culminando || verificacion.total_a_pagar < 0}>
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
        onCreated={loadData}
      />

      <RentarHabitacionDialog
        room={roomToRent}
        onClose={() => setRoomToRent(null)}
        onCreated={() => { setRoomToRent(null); loadData() }}
      />

      <DetalleHabitacionOcupadaDialog
        room={occupiedRoom}
        onClose={() => setOccupiedRoom(null)}
        onUpdated={() => { setOccupiedRoom(null); loadData() }}
      />
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
      const hoy = new Date().toISOString().split("T")[0]
      const maniana = new Date(Date.now() + 86400000).toISOString().split("T")[0]
      setForm((f) => ({ ...f, fecha_entrada: hoy, fecha_salida: maniana }))
    }
  }, [open])

  async function handleSubmit() {
    setError("")
    if (!form.nombres || !form.apellidos || !form.fecha_entrada || !form.fecha_salida || !form.tipo_habitacion_id) {
      setError("Completa todos los campos obligatorios")
      return
    }
    setSaving(true)
    try {
      const huespedes = await api.huespedes.listar(form.numero_documento)
      let huesped = huespedes.find((h: any) => h.numero_documento === form.numero_documento)
      if (!huesped) {
        huesped = await api.huespedes.crear({
          nombres: form.nombres,
          apellidos: form.apellidos,
          tipo_documento: form.tipo_documento,
          numero_documento: form.numero_documento,
          telefono: form.telefono || undefined,
          email: form.email || undefined,
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
        {error && <div className="p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}

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

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : "Crear Reserva"}
          </Button>
        </div>
      </div>
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
  const [extraMonto, setExtraMonto] = useState(0)
  const [taxRate, setTaxRate] = useState(15)
  const [metodosPago, setMetodosPago] = useState<any[]>([])

  const [form, setForm] = useState({
    nombres: "", apellidos: "", tipo_documento: "DNI", numero_documento: "",
    telefono: "", email: "",
    fecha_entrada: "", hora_entrada: "15:00",
    fecha_salida: "", hora_salida: "12:00",
    adultos: 1, ninos: 0,
    descuento: 0,
    adelanto: 0,
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
        setForm((actual) => ({ ...actual, metodo_pago: activos[0]?.nombre || "" }))
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
      setExtraMonto(0)
      const hoy = new Date().toISOString().split("T")[0]
      const maniana = new Date(Date.now() + 86400000).toISOString().split("T")[0]
      setForm((f) => ({ ...f, fecha_entrada: hoy, fecha_salida: maniana, tiene_vehiculo: false, detalle_vehiculo: "" }))
    }
  }, [room])

  const precioNoche = room?.tipo_habitacion?.precio_base || 0
  const fechaEntrada = form.fecha_entrada ? new Date(form.fecha_entrada + "T12:00:00") : null
  const fechaSalida = form.fecha_salida ? new Date(form.fecha_salida + "T12:00:00") : null
  const noches = fechaEntrada && fechaSalida ? Math.max(0, Math.round((fechaSalida.getTime() - fechaEntrada.getTime()) / 86400000)) : 0
  const subtotal = precioNoche * noches
  const impuesto = Math.round(subtotal * (taxRate / 100) * 100) / 100
  const descuento = form.descuento || 0
  const extra = extraMonto || 0
  const totalNeto = subtotal + impuesto - descuento + extra
  const totalFinal = Math.max(0, totalNeto)
  const adelanto = Math.min(form.adelanto || 0, totalFinal)
  const saldo = totalFinal - adelanto

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
      setError("Esta habitación no se puede rentar porque no está limpia")
      return
    }

    if (step === "buscar" && !selectedGuest) {
      setError("Selecciona un huésped o crea uno nuevo")
      return
    }

    if (!form.fecha_entrada || !form.fecha_salida) {
      setError("Selecciona las fechas de entrada y salida")
      return
    }

    if (form.fecha_salida <= form.fecha_entrada) {
      setError("La fecha de salida debe ser posterior a la entrada")
      return
    }

    if (form.tiene_vehiculo && !form.detalle_vehiculo.trim()) {
      setError("Indica el detalle del vehículo")
      return
    }

    let guest = selectedGuest

    if (step === "nuevo") {
      if (!form.nombres || !form.apellidos) {
        setError("Completa nombre y apellidos del huésped")
        return
      }
      try {
        guest = await api.huespedes.crear({
          nombres: form.nombres,
          apellidos: form.apellidos,
          tipo_documento: form.tipo_documento,
          numero_documento: form.numero_documento || undefined,
          telefono: form.telefono || undefined,
          email: form.email || undefined,
        })
      } catch (err: any) {
        setError(err.message)
        return
      }
    } else if (selectedGuest) {
      if (!selectedGuest.nombres || !selectedGuest.apellidos) {
        setError("Completa nombre y apellidos del huésped")
        return
      }
    }

    setSaving(true)
    try {
      if (step === "buscar" && selectedGuest) {
        guest = await api.huespedes.actualizar(selectedGuest.id, {
          nombres: selectedGuest.nombres,
          apellidos: selectedGuest.apellidos,
          tipo_documento: selectedGuest.tipo_documento || undefined,
          numero_documento: selectedGuest.numero_documento || undefined,
          telefono: selectedGuest.telefono || undefined,
          email: selectedGuest.email || undefined,
          nacionalidad: selectedGuest.nacionalidad || undefined,
          direccion: selectedGuest.direccion || undefined,
          fecha_nacimiento: selectedGuest.fecha_nacimiento || undefined,
          notas: selectedGuest.notas || undefined,
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
        descuento: descuento,
        origen: "Walk-in",
        tiene_vehiculo: form.tiene_vehiculo,
        detalle_vehiculo: form.tiene_vehiculo ? form.detalle_vehiculo : undefined,
      })

      if (extra > 0 && extraDesc) {
        await api.facturacion.agregarCargo(reserva.id, {
          descripcion: extraDesc,
          cantidad: 1,
          precio_unitario: extra,
          total: extra,
        })
      }

      if (adelanto > 0) {
        await api.facturacion.agregarPago(reserva.id, {
          monto: adelanto,
          metodo_pago: form.metodo_pago,
          referencia: `Adelanto - ${form.fecha_entrada}`,
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

  const inputCls = "w-full h-10 px-3 rounded-md border border-gray-300 text-sm"

  return (
    <Dialog open={!!room} onClose={onClose} title={`Rentar Hab. ${room?.numero}`} className="max-w-4xl">
      {room && (
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between bg-blue-50 p-3 rounded-md">
            <div>
              <p className="text-sm font-semibold">{room.tipo_habitacion?.nombre} - Hab. {room.numero}</p>
              <p className="text-xs text-gray-500">Piso {room.piso} · Cap. {room.tipo_habitacion?.capacidad_base} pers.</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-blue-700">{formatCurrency(precioNoche)}</p>
              <p className="text-xs text-gray-500">/noche</p>
            </div>
          </div>

          {error && <div className="p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}

          <div className="flex gap-2 bg-gray-100 p-1 rounded-md">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tipoRegistro === "hospedar" ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-800"}`}
              onClick={() => setTipoRegistro("hospedar")}
            >🏨 Hospedar</button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tipoRegistro === "reserva" ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-800"}`}
              onClick={() => setTipoRegistro("reserva")}
            >📋 Reserva</button>
          </div>

          {step === "buscar" && (
            <div className="space-y-3">
              <label className="text-sm font-medium block">Huésped</label>
              <div className="flex gap-2">
                <Input placeholder="Buscar por nombre, doc. o email..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)} />
                <Button size="sm" variant="outline" onClick={() => { setStep("nuevo"); setSelectedGuest(null) }}>
                  <Plus className="h-4 w-4 mr-1" /> Nuevo
                </Button>
              </div>

              {searching && <p className="text-xs text-gray-500">Buscando...</p>}

              {guestResults.length > 0 && (
                <div className="max-h-32 overflow-auto space-y-1 border rounded-md p-1">
                  {guestResults.map((g) => (
                    <div key={g.id}
                      className={`p-2 rounded-md cursor-pointer text-sm ${selectedGuest?.id === g.id ? "bg-blue-100 border border-blue-300" : "bg-gray-50 hover:bg-gray-100"}`}
                      onClick={() => setSelectedGuest(g)}>
                      <p className="font-medium">{g.nombres} {g.apellidos}</p>
                      <p className="text-xs text-gray-500">{g.tipo_documento}: {g.numero_documento}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedGuest && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-green-900">Cliente seleccionado</p>
                      <p className="text-xs text-green-700">Revisa y corrige sus datos antes de hospedar o reservar.</p>
                    </div>
                    <button onClick={() => setSelectedGuest(null)} className="text-xs font-medium text-red-600 hover:underline">Quitar</button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Nombres *</label>
                      <Input value={selectedGuest.nombres || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, nombres: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Apellidos *</label>
                      <Input value={selectedGuest.apellidos || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, apellidos: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Tipo Doc.</label>
                      <select className={inputCls} value={selectedGuest.tipo_documento || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, tipo_documento: e.target.value })}>
                        <option value="">Sin especificar</option>
                        <option value="DNI">DNI</option>
                        <option value="Pasaporte">Pasaporte</option>
                        <option value="Cédula">Cédula</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">N° Documento</label>
                      <Input value={selectedGuest.numero_documento || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, numero_documento: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Teléfono</label>
                      <Input value={selectedGuest.telefono || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, telefono: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Email</label>
                      <Input type="email" value={selectedGuest.email || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, email: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Nacionalidad</label>
                      <Input value={selectedGuest.nacionalidad || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, nacionalidad: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Fecha nacimiento</label>
                      <Input type="date" value={selectedGuest.fecha_nacimiento || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, fecha_nacimiento: e.target.value })} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-medium">Dirección</label>
                      <Input value={selectedGuest.direccion || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, direccion: e.target.value })} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-medium">Notas</label>
                      <Input value={selectedGuest.notas || ""} onChange={(e) => setSelectedGuest({ ...selectedGuest, notas: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {step === "nuevo" && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Nuevo huésped</span>
                <button onClick={() => setStep("buscar")} className="text-xs text-blue-600 hover:underline">Buscar existente</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium">Nombres *</label><Input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} /></div>
                <div><label className="text-xs font-medium">Apellidos *</label><Input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium">Tipo Doc.</label>
                  <select className={inputCls} value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}>
                    <option value="DNI">DNI</option>
                    <option value="Pasaporte">Pasaporte</option>
                    <option value="Cédula">Cédula</option>
                  </select>
                </div>
                <div className="col-span-2"><label className="text-xs font-medium">N° Documento</label><Input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium">Teléfono</label><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
                <div><label className="text-xs font-medium">Email</label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Entrada</label>
              <Input type="date" value={form.fecha_entrada} onChange={(e) => setForm({ ...form, fecha_entrada: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Hora entrada</label>
              <Input type="time" value={form.hora_entrada} onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Salida</label>
              <Input type="date" value={form.fecha_salida} onChange={(e) => setForm({ ...form, fecha_salida: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Hora salida</label>
              <Input type="time" value={form.hora_salida} onChange={(e) => setForm({ ...form, hora_salida: e.target.value })} />
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

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">¿El huésped anda vehículo?</p>
                <p className="text-xs text-gray-500">Se guardará en la estadía para consulta desde habitación ocupada.</p>
              </div>
              <div className="flex rounded-md bg-white p-1 text-sm ring-1 ring-gray-200">
                <button
                  type="button"
                  className={`rounded px-4 py-1.5 font-medium ${!form.tiene_vehiculo ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                  onClick={() => setForm({ ...form, tiene_vehiculo: false, detalle_vehiculo: "" })}
                >No</button>
                <button
                  type="button"
                  className={`rounded px-4 py-1.5 font-medium ${form.tiene_vehiculo ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                  onClick={() => setForm({ ...form, tiene_vehiculo: true })}
                >Sí</button>
              </div>
            </div>
            {form.tiene_vehiculo && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Detalle del vehículo *</label>
                <Input
                  placeholder="Ej: Toyota Corolla blanco, placa ABC-123"
                  value={form.detalle_vehiculo}
                  onChange={(e) => setForm({ ...form, detalle_vehiculo: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="border-t pt-3 space-y-3">
            <h4 className="text-sm font-semibold">Cobros</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Descuento</label>
                <Input type="number" min={0} step={0.01} value={form.descuento} onChange={(e) => setForm({ ...form, descuento: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Adelanto (a pagar ahora)</label>
                <Input type="number" min={0} step={0.01} value={form.adelanto} onChange={(e) => setForm({ ...form, adelanto: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Método de pago</label>
                <select className={inputCls} value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}>
                  {metodosPago.length === 0 && <option value="">Configura un método de pago</option>}
                  {metodosPago.map((metodo) => <option key={metodo.id} value={metodo.nombre}>{metodo.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Cargo extra</label>
                <Input placeholder="Descripción" value={extraDesc} onChange={(e) => setExtraDesc(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Monto extra</label>
                <Input type="number" min={0} step={0.01} value={extraMonto} onChange={(e) => setExtraMonto(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-md p-3 space-y-1 text-sm border">
            <div className="flex justify-between"><span>Subtotal ({noches} noche{noches !== 1 ? "s" : ""})</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span>Impuesto ({taxRate}%)</span><span>{formatCurrency(impuesto)}</span></div>
            {descuento > 0 && <div className="flex justify-between text-red-600"><span>Descuento</span><span>-{formatCurrency(descuento)}</span></div>}
            {extra > 0 && <div className="flex justify-between"><span>Cargo extra: {extraDesc || "—"}</span><span>+{formatCurrency(extra)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-1 border-t mt-1"><span>Total</span><span>{formatCurrency(totalFinal)}</span></div>
            {adelanto > 0 && <div className="flex justify-between text-green-600"><span>Adelanto</span><span>-{formatCurrency(adelanto)}</span></div>}
            {adelanto > 0 && <div className="flex justify-between font-semibold text-blue-700"><span>Saldo pendiente</span><span>{formatCurrency(saldo)}</span></div>}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving || (!selectedGuest && step === "buscar")}>
              {saving ? "Procesando..." : tipoRegistro === "hospedar" ? "Hospedar" : "Crear Reserva"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
