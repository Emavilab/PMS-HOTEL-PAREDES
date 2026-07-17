"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, statusBadge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { LogIn, LogOut, RefreshCw, Plus, Search, BedDouble, User, Calendar, Users, Check, X } from "lucide-react"

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

  const [showQuickReserva, setShowQuickReserva] = useState(false)
  const [roomToRent, setRoomToRent] = useState<any | null>(null)
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<any[] | null>(null)
  const [searching, setSearching] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.reportes.llegadas(),
      api.reportes.salidas(),
      api.habitaciones.listar(),
    ]).then(([arr, dep, r]) => {
      setArrivals(arr)
      setDepartures(dep)
      setRooms(r)
    }).catch((err: any) => {
      setError(err.message)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

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
        await api.reservas.checkOut(accion.reserva.id)
      }
      setAccion(null)
      setSelectedRoomId("")
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setConfirming(false)
    }
  }

  function openCheckIn(reserva: any) {
    setSelectedRoomId(reserva.habitacion_id || "")
    setAccion({ tipo: "checkin", reserva })
  }

  function openCheckOut(reserva: any) {
    setAccion({ tipo: "checkout", reserva })
  }

  const availableRooms = rooms.filter((r) => r.estado_operativo === "DISPONIBLE")
  const matchingRooms = accion?.tipo === "checkin" && accion.reserva.tipo_habitacion_id
    ? availableRooms.filter((r) => r.tipo_habitacion_id === accion.reserva.tipo_habitacion_id)
    : []

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h1 className="text-2xl font-bold">Recepción</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowQuickReserva(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nueva Reserva
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Buscar huésped por nombre, documento o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
      </div>

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
                  <div key={h.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-sm">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LogIn className="h-5 w-5 text-green-600" /> Llegadas del Día
              {!loading && <span className="text-sm font-normal text-gray-500">({arrivals.length})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : arrivals.length === 0 ? (
              <p className="text-gray-500">No hay llegadas programadas</p>
            ) : (
              <div className="space-y-2">
                {arrivals.map((arr) => (
                  <div key={arr.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{arr.huesped}</p>
                      <p className="text-xs text-gray-500">{arr.codigo_confirmacion}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateShort(arr.fecha_salida)}</span>
                        {arr.habitacion && <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" />Hab. {arr.habitacion}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LogOut className="h-5 w-5 text-orange-600" /> Salidas del Día
              {!loading && <span className="text-sm font-normal text-gray-500">({departures.length})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : departures.length === 0 ? (
              <p className="text-gray-500">No hay salidas programadas</p>
            ) : (
              <div className="space-y-2">
                {departures.map((dep) => (
                  <div key={dep.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{dep.huesped}</p>
                      <p className="text-xs text-gray-500">{dep.codigo_confirmacion}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        {dep.habitacion && <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" />Hab. {dep.habitacion}</span>}
                        {dep.total != null && <span className="font-medium text-gray-600">{formatCurrency(dep.total)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estado de Habitaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => room.estado_operativo === "DISPONIBLE" ? setRoomToRent(room) : null}
                className={`p-3 rounded-md text-center relative ${
                  room.estado_operativo === "DISPONIBLE"
                    ? "bg-green-100 text-green-800 cursor-pointer hover:bg-green-200 transition-colors"
                    : room.estado_operativo === "OCUPADA"
                    ? "bg-yellow-100 text-yellow-800 cursor-default"
                    : "bg-red-100 text-red-800 cursor-default"
                }`}
              >
                <p className="font-bold text-lg">{room.numero}</p>
                <p className="text-xs">{room.tipo_habitacion?.nombre}</p>
                <p className="text-xs mt-1">{statusBadge(room.estado_operativo).label}</p>
                <p className="text-[10px] mt-0.5 opacity-60">
                  {room.tipo_habitacion ? formatCurrency(room.tipo_habitacion.precio_base) + "/noche" : ""}
                </p>
                <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                  room.estado_limpieza === "LIMPIA" ? "bg-green-500" :
                  room.estado_limpieza === "SUCIA" ? "bg-red-500" :
                  room.estado_limpieza === "EN_PROGRESO" ? "bg-yellow-500" : "bg-blue-500"
                }`} title={`Limpieza: ${room.estado_limpieza}`} />
              </div>
            ))}
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
              <label className="text-sm font-medium block mb-2">Habitación disponible{matchingRooms.length > 0 ? ` (recomendadas: ${matchingRooms.length})` : ` (${availableRooms.length} totales)`}</label>
              <div className="max-h-48 overflow-auto space-y-2 border rounded-md p-2">
                {(matchingRooms.length > 0 ? matchingRooms : availableRooms).map((room) => (
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
                {availableRooms.length === 0 && <p className="text-sm text-gray-500 text-center py-2">No hay habitaciones disponibles</p>}
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
        onClose={() => setAccion(null)}
        title="Confirmar Check-out"
      >
        {accion?.reserva && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm">
              <p><span className="font-medium">Huésped:</span> {accion.reserva.huesped}</p>
              <p><span className="font-medium">Código:</span> {accion.reserva.codigo_confirmacion}</p>
              {accion.reserva.habitacion && <p><span className="font-medium">Habitación:</span> {accion.reserva.habitacion}</p>}
              {accion.reserva.total != null && (
                <p className="text-base font-semibold text-blue-700 pt-1">Total: {formatCurrency(accion.reserva.total)}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAccion(null)}>Cancelar</Button>
              <Button variant="secondary" onClick={handleConfirm} disabled={confirming}>
                {confirming ? "Procesando..." : "Confirmar Check-out"}
              </Button>
            </div>
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

  const [form, setForm] = useState({
    nombres: "", apellidos: "", tipo_documento: "DNI", numero_documento: "",
    telefono: "", email: "",
    fecha_entrada: "", hora_entrada: "15:00",
    fecha_salida: "", hora_salida: "12:00",
    adultos: 1, ninos: 0,
    descuento: 0,
    adelanto: 0,
  })

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
      setForm((f) => ({ ...f, fecha_entrada: hoy, fecha_salida: maniana }))
    }
  }, [room])

  const precioNoche = room?.tipo_habitacion?.precio_base || 0
  const fechaEntrada = form.fecha_entrada ? new Date(form.fecha_entrada + "T12:00:00") : null
  const fechaSalida = form.fecha_salida ? new Date(form.fecha_salida + "T12:00:00") : null
  const noches = fechaEntrada && fechaSalida ? Math.max(0, Math.round((fechaSalida.getTime() - fechaEntrada.getTime()) / 86400000)) : 0
  const subtotal = precioNoche * noches
  const impuesto = Math.round(subtotal * 0.15 * 100) / 100
  const descuento = form.descuento || 0
  const extra = extraMonto || 0
  const totalNeto = subtotal + impuesto - descuento + extra
  const totalFinal = Math.max(0, totalNeto)
  const adelanto = Math.min(form.adelanto || 0, totalFinal)
  const saldo = totalFinal - adelanto

  async function handleSearch() {
    if (!searchTerm.trim()) return
    setSearching(true)
    setError("")
    try {
      const results = await api.huespedes.listar(searchTerm)
      setGuestResults(results)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function handleSubmit() {
    if (!room) return
    setError("")

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
    }

    setSaving(true)
    try {
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
          metodo_pago: "Efectivo",
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
    <Dialog open={!!room} onClose={onClose} title={`Rentar Hab. ${room?.numero}`} className="max-w-xl">
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                <Button size="sm" variant="outline" onClick={handleSearch} disabled={searching}>Buscar</Button>
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
                <div className="bg-green-50 p-2 rounded-md text-sm flex items-center justify-between">
                  <span>✓ {selectedGuest.nombres} {selectedGuest.apellidos}</span>
                  <button onClick={() => setSelectedGuest(null)} className="text-xs text-red-600 hover:underline">Quitar</button>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => { setStep("nuevo"); setSelectedGuest(null) }}>
                <Plus className="h-4 w-4 mr-1" /> Nuevo huésped
              </Button>
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
            <div className="flex justify-between"><span>Impuesto (15%)</span><span>{formatCurrency(impuesto)}</span></div>
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
