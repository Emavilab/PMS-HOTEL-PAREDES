"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, statusBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog } from "@/components/ui/dialog"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { CalendarDays, ChevronLeft, ChevronRight, LayoutList, Plus, Search, Trash2 } from "lucide-react"
import type { ReservaLista } from "@/types"

type VistaReserva = "calendario" | "semana" | "dia" | "agenda"

const VISTAS: { key: VistaReserva; label: string }[] = [
  { key: "calendario", label: "Calendario" },
  { key: "semana", label: "Semana" },
  { key: "dia", label: "Día" },
  { key: "agenda", label: "Agenda" },
]

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const ESTADOS_RESERVA = [
  { value: "PENDIENTE", label: "Reservación sin confirmar", className: "border-yellow-200 bg-yellow-50 text-yellow-950" },
  { value: "CONFIRMADA", label: "Reservación confirmada", className: "border-blue-200 bg-blue-50 text-blue-950" },
  { value: "CHECKED_IN", label: "Ingreso", className: "border-green-200 bg-green-50 text-green-950" },
  { value: "NO_SHOW", label: "No ingreso", className: "border-red-200 bg-red-50 text-red-950" },
  { value: "CHECKED_OUT", label: "Hospedaje terminado", className: "border-gray-200 bg-gray-50 text-gray-950" },
]

export default function ReservasPage() {
  const [reservations, setReservations] = useState<ReservaLista[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [vista, setVista] = useState<VistaReserva>("calendario")
  const [fechaActual, setFechaActual] = useState(() => startOfDay(new Date()))
  const [selectedReserva, setSelectedReserva] = useState<ReservaLista | null>(null)

  useEffect(() => {
    loadReservations()
  }, [])

  function loadReservations() {
    setLoading(true)
    api.reservas.listar().then(setReservations).finally(() => setLoading(false))
  }

  const activeReservations = reservations.filter((r) => r.estado !== "CHECKED_OUT")
  const finishedCount = reservations.length - activeReservations.length

  const filtered = activeReservations.filter((r) => {
    const term = search.toLowerCase()
    return (
      (r.huesped_nombre || "").toLowerCase().includes(term) ||
      r.codigo_confirmacion.toLowerCase().includes(term) ||
      (r.numero_habitacion || "").toLowerCase().includes(term)
    )
  })

  const confirmadas = filtered.filter((r) => ["PENDIENTE", "CONFIRMADA", "CHECKED_IN"].includes(r.estado)).length
  const checkedIn = filtered.filter((r) => r.estado === "CHECKED_IN").length
  const noIngreso = filtered.filter((r) => r.estado === "NO_SHOW").length
  const totalVisible = filtered.reduce((sum, r) => sum + (r.total || 0), 0)

  function moverPeriodo(direccion: -1 | 1) {
    if (vista === "calendario") setFechaActual(addMonths(fechaActual, direccion))
    if (vista === "semana") setFechaActual(addDays(fechaActual, direccion * 7))
    if (vista === "dia" || vista === "agenda") setFechaActual(addDays(fechaActual, direccion))
  }

  const tituloPeriodo = getTituloPeriodo(vista, fechaActual)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reservas</h1>
          <p className="mt-1 text-sm text-gray-500">Visualiza la ocupación activa por mes, semana, día o agenda operativa.</p>
        </div>
        <Link href="/reservas/nueva">
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Nueva Reserva
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Reservas visibles" value={filtered.length.toString()} />
        <MetricCard label="Activas" value={confirmadas.toString()} />
        <MetricCard label="En casa" value={checkedIn.toString()} />
        <MetricCard label="Valor visible" value={formatCurrency(totalVisible)} muted={`${noIngreso} no ingreso`} />
      </div>

      {finishedCount > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          {finishedCount} hospedaje{finishedCount !== 1 ? "s" : ""} terminado{finishedCount !== 1 ? "s" : ""} no se muestra{finishedCount !== 1 ? "n" : ""} en reservaciones activas.
        </div>
      )}

      <StatusLegend />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por huésped, código o habitación..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="grid grid-cols-4 rounded-lg bg-gray-100 p-1 text-sm">
                {VISTAS.map((item) => (
                  <button
                    key={item.key}
                    className={`rounded-md px-3 py-2 font-medium transition ${vista === item.key ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                    onClick={() => setVista(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-start">
                <Button variant="outline" size="icon" onClick={() => moverPeriodo(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => setFechaActual(startOfDay(new Date()))}>Hoy</Button>
                <Button variant="outline" size="icon" onClick={() => moverPeriodo(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gray-50">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              {vista === "agenda" ? <LayoutList className="h-5 w-5 text-blue-600" /> : <CalendarDays className="h-5 w-5 text-blue-600" />}
              {tituloPeriodo}
            </CardTitle>
            <span className="text-sm text-gray-500">{filtered.length} reserva{filtered.length !== 1 ? "s" : ""}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-gray-500">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-gray-500">No se encontraron reservas</p>
          ) : vista === "calendario" ? (
            <CalendarMonth fecha={fechaActual} reservas={filtered} onSelect={setSelectedReserva} />
          ) : vista === "semana" ? (
            <WeekView fecha={fechaActual} reservas={filtered} onSelect={setSelectedReserva} />
          ) : vista === "dia" ? (
            <DayView fecha={fechaActual} reservas={filtered} onSelect={setSelectedReserva} />
          ) : (
            <AgendaView fecha={fechaActual} reservas={filtered} onSelect={setSelectedReserva} />
          )}
        </CardContent>
      </Card>

      <ReservaDetalleDialog
        reserva={selectedReserva}
        onClose={() => setSelectedReserva(null)}
        onChanged={() => { setSelectedReserva(null); loadReservations() }}
      />
    </div>
  )
}

function CalendarMonth({ fecha, reservas, onSelect }: { fecha: Date; reservas: ReservaLista[]; onSelect: (reserva: ReservaLista) => void }) {
  const semanas = getMonthWeeks(fecha)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[920px]">
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {DIAS_SEMANA.map((dia) => (
            <div key={dia} className="p-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">{dia}</div>
          ))}
        </div>
        {semanas.map((semana) => <CalendarWeekRow key={toDateKey(semana[0])} semana={semana} mes={fecha.getMonth()} reservas={reservas} onSelect={onSelect} />)}
      </div>
    </div>
  )
}

function CalendarWeekRow({ semana, mes, reservas, onSelect }: { semana: Date[]; mes: number; reservas: ReservaLista[]; onSelect: (reserva: ReservaLista) => void }) {
  const inicio = semana[0]
  const fin = semana[6]
  const segmentos = reservas
    .filter((r) => reservationTouchesRange(r, inicio, fin))
    .sort((a, b) => parseDate(a.fecha_entrada).getTime() - parseDate(b.fecha_entrada).getTime())
  const altura = Math.max(150, 54 + segmentos.length * 32)

  return (
    <div className="relative grid grid-cols-7 border-b" style={{ minHeight: altura }}>
      {semana.map((dia) => {
        const fueraMes = dia.getMonth() !== mes
        return (
          <div key={toDateKey(dia)} className={`border-r p-2 ${fueraMes ? "bg-gray-50/70 text-gray-400" : "bg-white"}`}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isSameDay(dia, new Date()) ? "bg-blue-600 text-white" : ""}`}>
              {dia.getDate()}
            </span>
          </div>
        )
      })}
      {segmentos.map((reserva, index) => {
        const entrada = parseDate(reserva.fecha_entrada)
        const salida = parseDate(reserva.fecha_salida)
        const start = Math.max(0, daysBetween(inicio, entrada))
        const end = Math.min(6, daysBetween(inicio, salida))
        return (
          <button
            key={`${reserva.id}-${toDateKey(inicio)}`}
            className={`absolute rounded-md border px-2 py-1 text-left text-xs shadow-sm transition hover:shadow-md ${getStatusClasses(reserva.estado)}`}
            style={{
              left: `${(start / 7) * 100}%`,
              width: `${((end - start + 1) / 7) * 100}%`,
              top: 42 + index * 32,
            }}
            onClick={() => onSelect(reserva)}
            title={`${reserva.codigo_confirmacion} · ${reserva.huesped_nombre || "Sin huésped"}`}
          >
            <p className="truncate font-semibold">{reserva.huesped_nombre || "Sin huésped"}</p>
            <p className="truncate opacity-80">{formatDateShort(reserva.fecha_entrada)} - {formatDateShort(reserva.fecha_salida)}</p>
          </button>
        )
      })}
    </div>
  )
}

function WeekView({ fecha, reservas, onSelect }: { fecha: Date; reservas: ReservaLista[]; onSelect: (reserva: ReservaLista) => void }) {
  const dias = getWeekDays(fecha)
  const inicio = dias[0]
  const fin = dias[6]
  const segmentos = reservas
    .filter((r) => reservationTouchesRange(r, inicio, fin))
    .sort((a, b) => parseDate(a.fecha_entrada).getTime() - parseDate(b.fecha_entrada).getTime())
  const altura = Math.max(260, 70 + segmentos.length * 44)

  return (
    <div className="relative grid grid-cols-7 divide-x overflow-x-auto" style={{ minHeight: altura }}>
      {dias.map((dia) => {
        return (
          <div key={toDateKey(dia)} className="min-w-32 p-3">
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{DIAS_SEMANA[(dia.getDay() + 6) % 7]}</p>
              <p className={`mt-1 text-xl font-bold ${isSameDay(dia, new Date()) ? "text-blue-700" : "text-gray-900"}`}>{dia.getDate()}</p>
            </div>
          </div>
        )
      })}
      {segmentos.length === 0 && <p className="absolute left-4 top-20 text-sm text-gray-400">Sin reservas en esta semana</p>}
      {segmentos.map((reserva, index) => {
        const entrada = parseDate(reserva.fecha_entrada)
        const salida = parseDate(reserva.fecha_salida)
        const start = Math.max(0, daysBetween(inicio, entrada))
        const end = Math.min(6, daysBetween(inicio, salida))
        return (
          <button
            key={reserva.id}
            className={`absolute rounded-xl border p-3 text-left shadow-sm transition hover:shadow-md ${getStatusClasses(reserva.estado)}`}
            style={{
              left: `${(start / 7) * 100}%`,
              width: `${((end - start + 1) / 7) * 100}%`,
              top: 72 + index * 44,
            }}
            onClick={() => onSelect(reserva)}
          >
            <ReservationSummary reserva={reserva} />
          </button>
        )
      })}
    </div>
  )
}

function DayView({ fecha, reservas, onSelect }: { fecha: Date; reservas: ReservaLista[]; onSelect: (reserva: ReservaLista) => void }) {
  const delDia = reservas.filter((r) => reservationStartsDate(r, fecha))

  return (
    <div className="p-4">
      {delDia.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">No hay reservas con entrada para este día.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {delDia.map((r) => <ReservationCard key={r.id} reserva={r} detailed onSelect={onSelect} />)}
        </div>
      )}
    </div>
  )
}

function AgendaView({ fecha, reservas, onSelect }: { fecha: Date; reservas: ReservaLista[]; onSelect: (reserva: ReservaLista) => void }) {
  const inicio = fecha
  const fin = addDays(fecha, 30)
  const agenda = reservas
    .filter((r) => parseDate(r.fecha_salida) >= inicio && parseDate(r.fecha_entrada) <= fin)
    .sort((a, b) => parseDate(a.fecha_entrada).getTime() - parseDate(b.fecha_entrada).getTime())

  return (
    <div className="divide-y">
      {agenda.length === 0 ? (
        <p className="p-6 text-sm text-gray-500">No hay reservas en los próximos 30 días desde la fecha seleccionada.</p>
      ) : agenda.map((r) => (
        <button key={r.id} className="grid w-full gap-3 p-4 text-left transition hover:bg-gray-50 md:grid-cols-[160px_1fr_auto] md:items-center" onClick={() => onSelect(r)}>
          <div>
            <p className="text-sm font-semibold">{formatDateShort(r.fecha_entrada)}</p>
            <p className="text-xs text-gray-500">hasta {formatDateShort(r.fecha_salida)}</p>
          </div>
          <ReservationSummary reserva={r} />
          <div className="text-left md:text-right">
            <p className="font-semibold">{formatCurrency(r.total)}</p>
            <Badge {...statusBadge(r.estado)} />
          </div>
        </button>
      ))}
    </div>
  )
}

function ReservationPill({ reserva, compact = false, onSelect }: { reserva: ReservaLista; compact?: boolean; onSelect: (reserva: ReservaLista) => void }) {
  return (
    <button className={`w-full rounded-md border px-2 py-1 text-left text-xs transition hover:shadow-sm ${getStatusClasses(reserva.estado)}`} title={`${reserva.codigo_confirmacion} · ${reserva.huesped_nombre || "Sin huésped"}`} onClick={() => onSelect(reserva)}>
      <p className="truncate font-semibold">{reserva.huesped_nombre || "Sin huésped"}</p>
      {!compact && <p className="truncate opacity-80">{reserva.codigo_confirmacion}</p>}
    </button>
  )
}

function ReservationCard({ reserva, detailed = false, onSelect }: { reserva: ReservaLista; detailed?: boolean; onSelect: (reserva: ReservaLista) => void }) {
  return (
    <button className={`w-full rounded-xl border p-3 text-left shadow-sm transition hover:shadow-md ${getStatusClasses(reserva.estado)}`} onClick={() => onSelect(reserva)}>
      <div className="flex items-start justify-between gap-3">
        <ReservationSummary reserva={reserva} />
        <Badge {...statusBadge(reserva.estado)} />
      </div>
      {detailed && (
        <div className="mt-3 grid gap-2 border-t pt-3 text-sm sm:grid-cols-3">
          <Info label="Entrada" value={formatDateShort(reserva.fecha_entrada)} />
          <Info label="Salida" value={formatDateShort(reserva.fecha_salida)} />
          <Info label="Total" value={formatCurrency(reserva.total)} />
        </div>
      )}
    </button>
  )
}

function ReservationSummary({ reserva }: { reserva: ReservaLista }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold">{reserva.huesped_nombre || "Sin huésped"}</p>
      <p className="text-xs text-gray-500">{reserva.codigo_confirmacion}</p>
      <p className="mt-1 text-xs text-gray-600">
        Hab. {reserva.numero_habitacion || "sin asignar"}{reserva.tipo_habitacion_nombre ? ` · ${reserva.tipo_habitacion_nombre}` : ""}
      </p>
    </div>
  )
}

function StatusLegend() {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-3 text-sm font-semibold">Leyenda de colores y estatus</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {ESTADOS_RESERVA.map((estado) => (
            <div key={estado.value} className={`rounded-lg border px-3 py-2 text-xs font-medium ${estado.className}`}>
              {estado.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ReservaDetalleDialog({ reserva, onClose, onChanged }: { reserva: ReservaLista | null; onClose: () => void; onChanged: () => void }) {
  const [detalle, setDetalle] = useState<any | null>(null)
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [roomOptions, setRoomOptions] = useState<any[]>([])

  useEffect(() => {
    if (!reserva) return

    setLoading(true)
    setDetalle(null)
    setError("")
    api.reservas.obtener(reserva.id)
      .then((data) => {
        setDetalle(data)
        setForm({
          fecha_entrada: data.fecha_entrada || "",
          fecha_salida: data.fecha_salida || "",
          habitacion_id: data.habitacion_id || "",
          adultos: data.adultos || 1,
          ninos: data.ninos || 0,
          estado: data.estado || "PENDIENTE",
          total: data.total || 0,
          descuento: data.descuento || 0,
          tiene_vehiculo: data.tiene_vehiculo || false,
          detalle_vehiculo: data.detalle_vehiculo || "",
          solicitudes_especiales: data.solicitudes_especiales || "",
        })
        return api.habitaciones.listar().then((rooms) => {
          const disponibles = rooms.filter((room: any) => {
            const mismaCategoria = !data.tipo_habitacion_id || room.tipo_habitacion_id === data.tipo_habitacion_id
            return room.estado_operativo === "DISPONIBLE" && mismaCategoria
          })
          setRoomOptions(disponibles)
        })
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [reserva])

  async function handleSave() {
    if (!reserva) return
    setError("")
    if (!form.fecha_entrada || !form.fecha_salida) {
      setError("Selecciona fechas de entrada y salida")
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
    const requiereCheckIn = form.estado === "CHECKED_IN" && detalle?.estado !== "CHECKED_IN"
    if (requiereCheckIn && !form.habitacion_id) {
      setError("Selecciona una habitación disponible para registrar el ingreso")
      return
    }

    setSaving(true)
    try {
      const estadoParaActualizar = requiereCheckIn ? detalle.estado : form.estado
      await api.reservas.actualizar(reserva.id, {
        fecha_entrada: form.fecha_entrada,
        fecha_salida: form.fecha_salida,
        habitacion_id: form.habitacion_id || undefined,
        adultos: Number(form.adultos) || 1,
        ninos: Number(form.ninos) || 0,
        estado: estadoParaActualizar,
        total: Number(form.total) || 0,
        descuento: Number(form.descuento) || 0,
        tiene_vehiculo: Boolean(form.tiene_vehiculo),
        detalle_vehiculo: form.tiene_vehiculo ? form.detalle_vehiculo : undefined,
        solicitudes_especiales: form.solicitudes_especiales || undefined,
      })
      if (requiereCheckIn) {
        await api.reservas.checkIn(reserva.id, form.habitacion_id)
      }
      onChanged()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!reserva) return
    if (!window.confirm(`¿Eliminar la reserva ${reserva.codigo_confirmacion}? Esta acción no se puede deshacer.`)) return

    setSaving(true)
    setError("")
    try {
      await api.reservas.eliminar(reserva.id)
      onChanged()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!reserva} onClose={onClose} title="Detalle de reservación" className="max-w-3xl">
      {loading ? (
        <p className="text-sm text-gray-500">Cargando reservación...</p>
      ) : error ? (
        <div className="space-y-4">
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
          {detalle && <ReservaForm detalle={detalle} form={form} setForm={setForm} roomOptions={roomOptions} />}
          <DialogActions saving={saving} estado={form.estado} onClose={onClose} onSave={handleSave} onDelete={handleDelete} />
        </div>
      ) : detalle ? (
        <div className="space-y-4">
          <div className={`rounded-xl border p-4 ${getStatusClasses(form.estado)}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide opacity-70">{detalle.codigo_confirmacion}</p>
                <h3 className="mt-1 text-xl font-bold">{detalle.huesped ? `${detalle.huesped.nombres} ${detalle.huesped.apellidos}` : reserva?.huesped_nombre}</h3>
                <p className="text-sm opacity-80">Hab. {reserva?.numero_habitacion || "sin asignar"}{reserva?.tipo_habitacion_nombre ? ` · ${reserva.tipo_habitacion_nombre}` : ""}</p>
              </div>
              <Badge {...statusBadge(form.estado)} />
            </div>
          </div>

          <ReservaForm detalle={detalle} form={form} setForm={setForm} roomOptions={roomOptions} />
          <DialogActions saving={saving} estado={form.estado} onClose={onClose} onSave={handleSave} onDelete={handleDelete} />
        </div>
      ) : null}
    </Dialog>
  )
}

function ReservaForm({ detalle, form, setForm, roomOptions }: { detalle: any; form: any; setForm: (form: any) => void; roomOptions: any[] }) {
  const necesitaHabitacion = form.estado === "CHECKED_IN" && detalle.estado !== "CHECKED_IN" && !detalle.habitacion_id

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ReadOnlyItem label="Documento" value={detalle.huesped ? `${detalle.huesped.tipo_documento || "Doc."}: ${detalle.huesped.numero_documento || "-"}` : "-"} />
        <ReadOnlyItem label="Contacto" value={detalle.huesped?.telefono || detalle.huesped?.email || "-"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">Entrada</label>
          <Input type="date" value={form.fecha_entrada || ""} onChange={(e) => setForm({ ...form, fecha_entrada: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Salida</label>
          <Input type="date" value={form.fecha_salida || ""} onChange={(e) => setForm({ ...form, fecha_salida: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Adultos</label>
          <Input type="number" min={1} value={form.adultos ?? 1} onChange={(e) => setForm({ ...form, adultos: parseInt(e.target.value) || 1 })} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Niños</label>
          <Input type="number" min={0} value={form.ninos ?? 0} onChange={(e) => setForm({ ...form, ninos: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Estatus</label>
          <select className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={form.estado || "PENDIENTE"} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
            {ESTADOS_RESERVA.map((estado) => <option key={estado.value} value={estado.value}>{estado.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Total</label>
          <Input type="number" min={0} step={0.01} value={form.total ?? 0} onChange={(e) => setForm({ ...form, total: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Descuento</label>
          <Input type="number" min={0} step={0.01} value={form.descuento ?? 0} onChange={(e) => setForm({ ...form, descuento: parseFloat(e.target.value) || 0 })} />
        </div>
      </div>

      {necesitaHabitacion && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-950">Para registrar ingreso debes asignar una habitación</p>
          <p className="mt-1 text-xs text-blue-800">Estas son habitaciones disponibles recomendadas para este tipo de reserva.</p>
          <div className="mt-3 space-y-2">
            {roomOptions.length === 0 ? (
              <p className="rounded-md bg-white p-3 text-sm text-blue-800">No hay habitaciones disponibles recomendadas. Cambia fechas, tipo de habitación o revisa disponibilidad.</p>
            ) : roomOptions.map((room) => (
              <button
                key={room.id}
                type="button"
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition ${form.habitacion_id === room.id ? "border-blue-400 bg-white shadow-sm" : "border-blue-100 bg-white/70 hover:bg-white"}`}
                onClick={() => setForm({ ...form, habitacion_id: room.id })}
              >
                <span>
                  <span className="font-semibold">Hab. {room.numero}</span>
                  <span className="text-gray-500"> · {room.tipo_habitacion?.nombre || "Sin tipo"}</span>
                </span>
                <span className="text-xs text-gray-500">Piso {room.piso || "-"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-gray-50 p-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Vehículo</p>
            <p className="text-xs text-gray-500">Registra si el huésped ingresó con vehículo.</p>
          </div>
          <div className="flex rounded-md bg-white p-1 text-sm ring-1 ring-gray-200">
            <button type="button" className={`rounded px-4 py-1.5 font-medium ${!form.tiene_vehiculo ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`} onClick={() => setForm({ ...form, tiene_vehiculo: false, detalle_vehiculo: "" })}>No</button>
            <button type="button" className={`rounded px-4 py-1.5 font-medium ${form.tiene_vehiculo ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`} onClick={() => setForm({ ...form, tiene_vehiculo: true })}>Sí</button>
          </div>
        </div>
        {form.tiene_vehiculo && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Detalle del vehículo</label>
            <Input placeholder="Ej: Toyota Corolla blanco, placa ABC-123" value={form.detalle_vehiculo || ""} onChange={(e) => setForm({ ...form, detalle_vehiculo: e.target.value })} />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Solicitudes especiales</label>
        <Input value={form.solicitudes_especiales || ""} onChange={(e) => setForm({ ...form, solicitudes_especiales: e.target.value })} />
      </div>
    </div>
  )
}

function DialogActions({ saving, estado, onClose, onSave, onDelete }: { saving: boolean; estado: string; onClose: () => void; onSave: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <Button variant="destructive" onClick={onDelete} disabled={saving || estado === "CHECKED_IN"}>
        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
      </Button>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cerrar</Button>
        <Button onClick={onSave} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</Button>
      </div>
    </div>
  )
}

function ReadOnlyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function MetricCard({ label, value, muted }: { label: string; value: string; muted?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        {muted && <p className="text-xs text-gray-500">{muted}</p>}
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function getStatusClasses(status: string) {
  if (status === "CHECKED_IN") return "border-green-200 bg-green-50 text-green-950"
  if (status === "CONFIRMADA") return "border-blue-200 bg-blue-50 text-blue-950"
  if (status === "PENDIENTE") return "border-yellow-200 bg-yellow-50 text-yellow-950"
  if (["CANCELADA", "NO_SHOW"].includes(status)) return "border-red-200 bg-red-50 text-red-950"
  return "border-gray-200 bg-gray-50 text-gray-950"
}

function getTituloPeriodo(vista: VistaReserva, fecha: Date) {
  if (vista === "calendario") {
    return new Intl.DateTimeFormat("es-HN", { month: "long", year: "numeric" }).format(fecha)
  }
  if (vista === "semana") {
    const inicio = startOfWeek(fecha)
    const fin = addDays(inicio, 6)
    return `${formatDateShort(inicio)} - ${formatDateShort(fin)}`
  }
  if (vista === "agenda") return `Agenda desde ${formatDateShort(fecha)}`
  return new Intl.DateTimeFormat("es-HN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(fecha)
}

function getMonthGrid(fecha: Date) {
  const primero = new Date(fecha.getFullYear(), fecha.getMonth(), 1)
  const inicio = startOfWeek(primero)
  return Array.from({ length: 42 }, (_, index) => addDays(inicio, index))
}

function getMonthWeeks(fecha: Date) {
  const dias = getMonthGrid(fecha)
  return Array.from({ length: 6 }, (_, index) => dias.slice(index * 7, index * 7 + 7))
}

function getWeekDays(fecha: Date) {
  const inicio = startOfWeek(fecha)
  return Array.from({ length: 7 }, (_, index) => addDays(inicio, index))
}

function reservationStartsDate(reserva: ReservaLista, fecha: Date) {
  return isSameDay(parseDate(reserva.fecha_entrada), fecha)
}

function reservationTouchesRange(reserva: ReservaLista, inicio: Date, fin: Date) {
  const entrada = parseDate(reserva.fecha_entrada)
  const salida = parseDate(reserva.fecha_salida)
  return entrada <= fin && salida >= inicio
}

function parseDate(value: string | Date) {
  if (value instanceof Date) return startOfDay(value)
  return startOfDay(new Date(`${value}T12:00:00`))
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date: Date) {
  const base = startOfDay(date)
  const day = (base.getDay() + 6) % 7
  return addDays(base, -day)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return startOfDay(next)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function daysBetween(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000)
}

function isSameDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b)
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}
