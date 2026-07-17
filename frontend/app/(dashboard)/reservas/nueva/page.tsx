"use client"

import { useState, useEffect, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Huesped, TipoHabitacion, Habitacion, Disponibilidad } from "@/types"

export default function NuevaReservaPage() {
  const router = useRouter()
  const [guests, setGuests] = useState<Huesped[]>([])
  const [roomTypes, setRoomTypes] = useState<TipoHabitacion[]>([])
  const [availableRooms, setAvailableRooms] = useState<Disponibilidad[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    huesped_id: "",
    tipo_habitacion_id: "",
    habitacion_id: "",
    fecha_entrada: "",
    fecha_salida: "",
    adultos: "1",
    ninos: "0",
    source: "Walk-in",
    solicitudes_especiales: "",
  })

  useEffect(() => {
    Promise.all([
      api.huespedes.listar(),
      api.tiposHabitacion.listar(),
    ]).then(([g, rt]) => {
      setGuests(g)
      setRoomTypes(rt)
    })
  }, [])

  async function checkAvailability() {
    if (!form.fecha_entrada || !form.fecha_salida) return
    const rooms = await api.disponibilidad.verificar(form.fecha_entrada, form.fecha_salida, form.tipo_habitacion_id || undefined)
    setAvailableRooms(rooms.filter((r: Disponibilidad) => r.disponible))
  }

  useEffect(() => {
    if (form.fecha_entrada && form.fecha_salida) {
      checkAvailability()
    }
  }, [form.fecha_entrada, form.fecha_salida, form.tipo_habitacion_id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await api.reservas.crear({
        huesped_id: form.huesped_id,
        tipo_habitacion_id: form.tipo_habitacion_id || undefined,
        habitacion_id: form.habitacion_id || undefined,
        fecha_entrada: form.fecha_entrada,
        fecha_salida: form.fecha_salida,
        adultos: parseInt(form.adultos),
        ninos: parseInt(form.ninos),
        source: form.source,
        solicitudes_especiales: form.solicitudes_especiales || undefined,
      })
      router.push("/reservas")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Nueva Reserva</h1>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Huésped</label>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={form.huesped_id}
                onChange={(e) => setForm({ ...form, huesped_id: e.target.value })}
                required
              >
                <option value="">Seleccionar huésped...</option>
                {guests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nombres} {g.apellidos}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Entrada</label>
                <Input type="date" value={form.fecha_entrada} onChange={(e) => setForm({ ...form, fecha_entrada: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Salida</label>
                <Input type="date" value={form.fecha_salida} onChange={(e) => setForm({ ...form, fecha_salida: e.target.value })} required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Habitación</label>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={form.tipo_habitacion_id}
                onChange={(e) => setForm({ ...form, tipo_habitacion_id: e.target.value })}
              >
                <option value="">Cualquier tipo...</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.nombre} - {rt.precio_base} HNL/noche
                  </option>
                ))}
              </select>
            </div>

            {availableRooms.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Habitación Disponible</label>
                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={form.habitacion_id}
                  onChange={(e) => setForm({ ...form, habitacion_id: e.target.value })}
                >
                  <option value="">Seleccionar después...</option>
                  {availableRooms.map((r) => (
                    <option key={r.habitacion_id} value={r.habitacion_id}>
                      {r.numero} - {r.tipo_habitacion} (Piso {r.piso})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Adultos</label>
                <Input type="number" min="1" value={form.adultos} onChange={(e) => setForm({ ...form, adultos: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Niños</label>
                <Input type="number" min="0" value={form.ninos} onChange={(e) => setForm({ ...form, ninos: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Origen</label>
              <select
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                <option value="Walk-in">Walk-in</option>
                <option value="Teléfono">Teléfono</option>
                <option value="Correo">Correo</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Facebook">Facebook</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Solicitudes Especiales</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={form.solicitudes_especiales}
                onChange={(e) => setForm({ ...form, solicitudes_especiales: e.target.value })}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Creando..." : "Crear Reserva"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/reservas")}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
