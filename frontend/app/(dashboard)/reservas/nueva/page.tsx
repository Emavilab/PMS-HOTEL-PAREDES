"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { getHotelDateKey } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { ArrowLeft, Plus, Search } from "lucide-react"
import type { Huesped, TipoHabitacion } from "@/types"
import { ErrorToast } from "@/components/ui/error-toast"

export default function NuevaReservaPage() {
  const router = useRouter()
  const [step, setStep] = useState<"buscar" | "nuevo">("buscar")
  const [searchTerm, setSearchTerm] = useState("")
  const [guestResults, setGuestResults] = useState<Huesped[]>([])
  const [selectedGuest, setSelectedGuest] = useState<any | null>(null)
  const [roomTypes, setRoomTypes] = useState<TipoHabitacion[]>([])
  const [metodosPago, setMetodosPago] = useState<any[]>([])
  const [taxRate, setTaxRate] = useState(15)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [extraDesc, setExtraDesc] = useState("")
  const [extraMonto, setExtraMonto] = useState(0)

  const [form, setForm] = useState({
    nombres: "", apellidos: "", tipo_documento: "DNI", numero_documento: "",
    telefono: "", email: "",
    tipo_habitacion_id: "",
    fecha_entrada: "",
    fecha_salida: "",
    adultos: 1,
    ninos: 0,
    origen: "Walk-in",
    descuento: 0,
    adelanto: 0,
    metodo_pago: "",
    tiene_vehiculo: false,
    detalle_vehiculo: "",
    solicitudes_especiales: "",
  })

  useEffect(() => {
    Promise.all([api.tiposHabitacion.listar(), api.configuracion.obtener(), api.metodosPago.listar()])
      .then(([types, config, metodos]) => {
        setRoomTypes(types)
        const activos = metodos.filter((metodo: any) => metodo.activo)
        setMetodosPago(activos)
        setTaxRate(Number(config.impuesto) || 0)
        setForm((f) => ({ ...f, metodo_pago: activos[0]?.nombre || "" }))
      })
      .catch((err: any) => setError(err.message))
    const hoy = getHotelDateKey()
    const maniana = getHotelDateKey(new Date(Date.now() + 86400000))
    setForm((f) => ({ ...f, fecha_entrada: hoy, fecha_salida: maniana }))
  }, [])

  useEffect(() => {
    if (step !== "buscar") return

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
        .then((results) => { if (active) setGuestResults(results) })
        .catch((err: any) => { if (active) setError(err.message) })
        .finally(() => { if (active) setSearching(false) })
    }, 350)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchTerm, step])

  const selectedRoomType = roomTypes.find((t) => t.id === form.tipo_habitacion_id)
  const precioNoche = selectedRoomType?.precio_base || 0
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

  async function handleSubmit() {
    setError("")

    if (step === "buscar" && !selectedGuest) {
      setError("Selecciona un huésped o crea uno nuevo")
      return
    }
    if (!form.tipo_habitacion_id || !form.fecha_entrada || !form.fecha_salida) {
      setError("Selecciona tipo de habitación y fechas")
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
    setSaving(true)
    try {
      if (step === "nuevo") {
        if (!form.nombres || !form.apellidos) throw new Error("Completa nombre y apellidos del huésped")
        guest = await api.huespedes.crear({
          nombres: form.nombres,
          apellidos: form.apellidos,
          tipo_documento: form.tipo_documento,
          numero_documento: form.numero_documento || undefined,
          telefono: form.telefono || undefined,
          email: form.email || undefined,
        })
      } else if (selectedGuest) {
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
        tipo_habitacion_id: form.tipo_habitacion_id,
        fecha_entrada: form.fecha_entrada,
        fecha_salida: form.fecha_salida,
        adultos: form.adultos,
        ninos: form.ninos,
        descuento,
        origen: form.origen,
        tiene_vehiculo: form.tiene_vehiculo,
        detalle_vehiculo: form.tiene_vehiculo ? form.detalle_vehiculo : undefined,
        solicitudes_especiales: form.solicitudes_especiales || undefined,
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
          referencia: `Adelanto de reserva - ${form.fecha_entrada}`,
        })
      }

      router.push("/reservas")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nueva Reserva</h1>
          <p className="mt-1 text-sm text-gray-500">Registra huésped, fechas, descuento, adelanto y cargos desde una sola pantalla.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/reservas")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>

      <ErrorToast message={error} onClose={() => setError("")} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base">Huésped</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">
              <div className="flex gap-2 rounded-md bg-gray-100 p-1">
                <button className={`flex-1 rounded-md py-2 text-sm font-medium ${step === "buscar" ? "bg-white text-blue-700 shadow" : "text-gray-600"}`} onClick={() => setStep("buscar")}>Buscar existente</button>
                <button className={`flex-1 rounded-md py-2 text-sm font-medium ${step === "nuevo" ? "bg-white text-blue-700 shadow" : "text-gray-600"}`} onClick={() => { setStep("nuevo"); setSelectedGuest(null) }}>Nuevo huésped</button>
              </div>

              {step === "buscar" ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input className="pl-9" placeholder="Buscar por nombre, documento o email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  {searching && <p className="text-xs text-gray-500">Buscando...</p>}
                  {guestResults.length > 0 && (
                    <div className="max-h-40 overflow-auto rounded-md border p-1">
                      {guestResults.map((g) => (
                        <button key={g.id} className={`w-full rounded-md p-2 text-left text-sm ${selectedGuest?.id === g.id ? "border border-blue-300 bg-blue-100" : "hover:bg-gray-50"}`} onClick={() => setSelectedGuest(g)}>
                          <p className="font-medium">{g.nombres} {g.apellidos}</p>
                          <p className="text-xs text-gray-500">{g.tipo_documento}: {g.numero_documento}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedGuest && <EditableGuest guest={selectedGuest} setGuest={setSelectedGuest} inputCls={inputCls} />}
                </div>
              ) : (
                <GuestForm form={form} setForm={setForm} inputCls={inputCls} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base">Datos de la reserva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Entrada"><Input type="date" value={form.fecha_entrada} onChange={(e) => setForm({ ...form, fecha_entrada: e.target.value })} /></Field>
                <Field label="Salida"><Input type="date" value={form.fecha_salida} onChange={(e) => setForm({ ...form, fecha_salida: e.target.value })} /></Field>
                <Field label="Tipo de habitación">
                  <select className={inputCls} value={form.tipo_habitacion_id} onChange={(e) => setForm({ ...form, tipo_habitacion_id: e.target.value })}>
                    <option value="">Seleccionar...</option>
                    {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.nombre} - {formatCurrency(rt.precio_base)}/noche</option>)}
                  </select>
                </Field>
                <Field label="Origen">
                  <select className={inputCls} value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Teléfono">Teléfono</option>
                    <option value="Correo">Correo</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Otro">Otro</option>
                  </select>
                </Field>
                <Field label="Adultos"><Input type="number" min={1} value={form.adultos} onChange={(e) => setForm({ ...form, adultos: parseInt(e.target.value) || 1 })} /></Field>
                <Field label="Niños"><Input type="number" min={0} value={form.ninos} onChange={(e) => setForm({ ...form, ninos: parseInt(e.target.value) || 0 })} /></Field>
              </div>

              <VehicleBlock form={form} setForm={setForm} />

              <Field label="Solicitudes especiales">
                <textarea className="min-h-16 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={form.solicitudes_especiales} onChange={(e) => setForm({ ...form, solicitudes_especiales: e.target.value })} />
              </Field>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base">Cobros y adelanto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Descuento"><Input type="number" min={0} step={0.01} value={form.descuento} onChange={(e) => setForm({ ...form, descuento: parseFloat(e.target.value) || 0 })} /></Field>
                <Field label="Adelanto pagado"><Input type="number" min={0} step={0.01} value={form.adelanto} onChange={(e) => setForm({ ...form, adelanto: parseFloat(e.target.value) || 0 })} /></Field>
                <Field label="Método de pago">
                  <select className={inputCls} value={form.metodo_pago} onChange={(e) => setForm({ ...form, metodo_pago: e.target.value })}>
                    {form.metodo_pago === "" && <option value="">Configura un método de pago</option>}
                    {metodosPago.map((metodo) => <option key={metodo.id} value={metodo.nombre}>{metodo.nombre}</option>)}
                  </select>
                </Field>
                <Field label="Cargo extra"><Input placeholder="Descripción" value={extraDesc} onChange={(e) => setExtraDesc(e.target.value)} /></Field>
                <Field label="Monto extra"><Input type="number" min={0} step={0.01} value={extraMonto} onChange={(e) => setExtraMonto(parseFloat(e.target.value) || 0)} /></Field>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Line label={`Habitación (${noches} noche${noches !== 1 ? "s" : ""})`} value={formatCurrency(subtotal)} />
              <Line label={`Impuesto (${taxRate}%)`} value={formatCurrency(impuesto)} />
              {descuento > 0 && <Line label="Descuento" value={`-${formatCurrency(descuento)}`} className="text-red-600" />}
              {extra > 0 && <Line label={`Extra: ${extraDesc || "sin descripción"}`} value={`+${formatCurrency(extra)}`} />}
              <div className="border-t pt-2">
                <Line label="Total" value={formatCurrency(totalFinal)} className="text-base font-bold" />
                {adelanto > 0 && <Line label="Adelanto" value={`-${formatCurrency(adelanto)}`} className="text-green-600" />}
                {adelanto > 0 && <Line label="Saldo pendiente" value={formatCurrency(saldo)} className="font-semibold text-blue-700" />}
              </div>
              <Button className="mt-4 w-full" onClick={handleSubmit} disabled={saving}>
                {saving ? "Creando..." : "Crear reserva"}
              </Button>
              <Button className="w-full" variant="outline" onClick={() => router.push("/reservas")} disabled={saving}>Cancelar</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function EditableGuest({ guest, setGuest, inputCls }: { guest: any; setGuest: (guest: any) => void; inputCls: string }) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
      <p className="mb-3 font-semibold text-green-900">Cliente seleccionado, puedes corregir sus datos</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nombres *"><Input value={guest.nombres || ""} onChange={(e) => setGuest({ ...guest, nombres: e.target.value })} /></Field>
        <Field label="Apellidos *"><Input value={guest.apellidos || ""} onChange={(e) => setGuest({ ...guest, apellidos: e.target.value })} /></Field>
        <Field label="Tipo Doc."><select className={inputCls} value={guest.tipo_documento || ""} onChange={(e) => setGuest({ ...guest, tipo_documento: e.target.value })}><option value="">Sin especificar</option><option value="DNI">DNI</option><option value="Pasaporte">Pasaporte</option><option value="Cédula">Cédula</option></select></Field>
        <Field label="N° Documento"><Input value={guest.numero_documento || ""} onChange={(e) => setGuest({ ...guest, numero_documento: e.target.value })} /></Field>
        <Field label="Teléfono"><Input value={guest.telefono || ""} onChange={(e) => setGuest({ ...guest, telefono: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={guest.email || ""} onChange={(e) => setGuest({ ...guest, email: e.target.value })} /></Field>
      </div>
    </div>
  )
}

function GuestForm({ form, setForm, inputCls }: { form: any; setForm: (form: any) => void; inputCls: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Nombres *"><Input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} /></Field>
      <Field label="Apellidos *"><Input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} /></Field>
      <Field label="Tipo Doc."><select className={inputCls} value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}><option value="DNI">DNI</option><option value="Pasaporte">Pasaporte</option><option value="Cédula">Cédula</option></select></Field>
      <Field label="N° Documento"><Input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} /></Field>
      <Field label="Teléfono"><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
      <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
    </div>
  )
}

function VehicleBlock({ form, setForm }: { form: any; setForm: (form: any) => void }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-2.5 space-y-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium">¿El huésped anda vehículo?</p>
          <p className="text-xs text-gray-500">Opcional para control de parqueo.</p>
        </div>
        <div className="flex rounded-md bg-white p-1 text-sm ring-1 ring-gray-200">
          <button type="button" className={`rounded px-4 py-1.5 font-medium ${!form.tiene_vehiculo ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`} onClick={() => setForm({ ...form, tiene_vehiculo: false, detalle_vehiculo: "" })}>No</button>
          <button type="button" className={`rounded px-4 py-1.5 font-medium ${form.tiene_vehiculo ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`} onClick={() => setForm({ ...form, tiene_vehiculo: true })}>Sí</button>
        </div>
      </div>
      {form.tiene_vehiculo && <Field label="Detalle del vehículo *"><Input placeholder="Ej: Toyota Corolla blanco, placa ABC-123" value={form.detalle_vehiculo} onChange={(e) => setForm({ ...form, detalle_vehiculo: e.target.value })} /></Field>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-sm font-medium">{label}</label>{children}</div>
}

function Line({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className={`flex justify-between gap-3 ${className}`}><span>{label}</span><span className="text-right">{value}</span></div>
}
