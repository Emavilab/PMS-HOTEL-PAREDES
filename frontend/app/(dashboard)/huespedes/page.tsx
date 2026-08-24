"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog } from "@/components/ui/dialog"
import { AlertTriangle, CheckCircle2, Edit, Eye, History, Mail, Phone, Plus, Search, Trash2, User } from "lucide-react"
import type { Huesped } from "@/types"
import { formatCurrency, formatDateShort } from "@/lib/utils"

const initialForm = {
  nombres: "",
  apellidos: "",
  tipo_documento: "DNI",
  numero_documento: "",
  telefono: "",
  email: "",
  nacionalidad: "",
  direccion: "",
  fecha_nacimiento: "",
  notas: "",
}

type ConfirmConfig = {
  title: string
  message: string
  confirmLabel: string
  variant: "default" | "destructive"
  action: () => Promise<void>
}

type SuccessConfig = {
  title: string
  message: string
}

export default function HuespedesPage() {
  const [guests, setGuests] = useState<Huesped[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Huesped | null>(null)
  const [selectedGuest, setSelectedGuest] = useState<Huesped | null>(null)
  const [form, setForm] = useState(initialForm)
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null)
  const [success, setSuccess] = useState<SuccessConfig | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState<any[]>([])

  function loadGuests(term = search) {
    setLoading(true)
    setError("")
    api.huespedes.listar(term || undefined)
      .then(setGuests)
      .catch((err: any) => setError(err.message || "No se pudieron cargar los huespedes"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadGuests("")
  }, [])

  useEffect(() => {
    if (!search.trim()) loadGuests("")
  }, [search])

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(null), 3200)
    return () => window.clearTimeout(timer)
  }, [success])

  const totalWithContact = useMemo(() => guests.filter((guest) => guest.telefono || guest.email).length, [guests])

  function openCreate() {
    setEditingGuest(null)
    setForm(initialForm)
    setError("")
    setFormOpen(true)
  }

  function openEdit(guest: Huesped) {
    setEditingGuest(guest)
    setForm({
      nombres: guest.nombres,
      apellidos: guest.apellidos,
      tipo_documento: guest.tipo_documento || "DNI",
      numero_documento: guest.numero_documento || "",
      telefono: guest.telefono || "",
      email: guest.email || "",
      nacionalidad: guest.nacionalidad || "",
      direccion: guest.direccion || "",
      fecha_nacimiento: guest.fecha_nacimiento || "",
      notas: guest.notas || "",
    })
    setError("")
    setFormOpen(true)
  }

  async function openDetail(guest: Huesped) {
    setSelectedGuest(guest)
    setDetailOpen(true)
    setHistory([])
    setHistoryLoading(true)
    try {
      const result = await api.huespedes.historial(guest.id)
      setHistory(result.reservas || [])
    } catch (err: any) {
      setError(err.message || "No se pudo cargar el historial")
    } finally {
      setHistoryLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.nombres.trim() || !form.apellidos.trim()) {
      setError("Nombre y apellido son obligatorios")
      return
    }

    const fullName = `${form.nombres} ${form.apellidos}`.trim()
    setConfirm({
      title: editingGuest ? "Confirmar cambios" : "Crear huesped",
      message: editingGuest ? `Se actualizaran los datos de ${fullName}.` : `Se registrara a ${fullName} como nuevo huesped.`,
      confirmLabel: editingGuest ? "Guardar cambios" : "Crear huesped",
      variant: "default",
      action: persistGuest,
    })
  }

  async function persistGuest() {
    setSaving(true)
    setError("")
    try {
      const payload = normalizePayload(form)
      if (editingGuest) await api.huespedes.actualizar(editingGuest.id, payload)
      else await api.huespedes.crear(payload)
      setFormOpen(false)
      setSuccess({
        title: editingGuest ? "Huesped actualizado" : "Huesped registrado",
        message: editingGuest
          ? `Los datos de ${payload.nombres} ${payload.apellidos} se actualizaron correctamente.`
          : `${payload.nombres} ${payload.apellidos} fue registrado correctamente.`,
      })
      loadGuests()
    } catch (err: any) {
      setError(err.message || "No se pudo guardar el huesped")
    } finally {
      setSaving(false)
    }
  }

  function requestDelete(guest: Huesped) {
    setConfirm({
      title: "Eliminar huesped",
      message: `Se intentara eliminar a ${guest.nombres} ${guest.apellidos}. Si tiene reservas asociadas, el sistema no permitira eliminarlo.`,
      confirmLabel: "Eliminar huesped",
      variant: "destructive",
      action: async () => {
        setSaving(true)
        setError("")
        try {
          await api.huespedes.eliminar(guest.id)
          setSuccess({
            title: "Huesped eliminado",
            message: `${guest.nombres} ${guest.apellidos} fue eliminado correctamente.`,
          })
          loadGuests()
        } catch (err: any) {
          setError(err.message || "No se pudo eliminar el huesped")
        } finally {
          setSaving(false)
        }
      },
    })
  }

  async function confirmAction() {
    if (!confirm) return
    await confirm.action()
    setConfirm(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Huespedes</h1>
          <p className="text-sm text-gray-500">Administra datos, contacto e historial de cada huesped.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Nuevo huesped</Button>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Registrados" value={guests.length} text="Huespedes en la lista actual" />
        <SummaryCard title="Con contacto" value={totalWithContact} text="Telefono o correo registrado" />
        <SummaryCard title="Busqueda" value={search.trim() ? "Activa" : "General"} text="Filtra por nombre, documento o telefono" />
      </div>

      <Card>
        <CardHeader className="border-b bg-gray-50">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-lg">Listado de huespedes</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <div className="relative sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, documento, correo..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadGuests()}
                />
              </div>
              <Button variant="outline" onClick={() => loadGuests()}>Buscar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Cargando huespedes...</p>
          ) : guests.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No se encontraron huespedes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-4 text-left text-sm font-medium text-gray-500">Huesped</th>
                    <th className="p-4 text-left text-sm font-medium text-gray-500">Documento</th>
                    <th className="p-4 text-left text-sm font-medium text-gray-500">Contacto</th>
                    <th className="p-4 text-left text-sm font-medium text-gray-500">Nacionalidad</th>
                    <th className="p-4 text-left text-sm font-medium text-gray-500">Registro</th>
                    <th className="p-4 text-right text-sm font-medium text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((guest) => (
                    <tr key={guest.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700"><User className="h-4 w-4" /></div>
                          <div>
                            <p className="font-medium">{guest.nombres} {guest.apellidos}</p>
                            <p className="text-xs text-gray-500">{guest.email || "Sin correo"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm">{guest.tipo_documento || "-"} {guest.numero_documento || ""}</td>
                      <td className="p-4 text-sm">
                        <div className="space-y-1">
                          <ContactLine icon={<Phone className="h-3.5 w-3.5" />} text={guest.telefono || "Sin telefono"} />
                          <ContactLine icon={<Mail className="h-3.5 w-3.5" />} text={guest.email || "Sin correo"} />
                        </div>
                      </td>
                      <td className="p-4 text-sm">{guest.nacionalidad || "-"}</td>
                      <td className="p-4 text-sm">{formatDateShort(guest.creado_en)}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openDetail(guest)} title="Ver detalle"><Eye className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(guest)} title="Editar"><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => requestDelete(guest)} title="Eliminar"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editingGuest ? "Editar huesped" : "Nuevo huesped"} className="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nombres"><Input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} required /></Field>
            <Field label="Apellidos"><Input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} required /></Field>
            <Field label="Tipo de documento">
              <select className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm" value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}>
                <option value="DNI">DNI</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Carnet de extranjeria">Carnet de extranjeria</option>
                <option value="Otro">Otro</option>
              </select>
            </Field>
            <Field label="Numero de documento"><Input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} /></Field>
            <Field label="Telefono"><Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
            <Field label="Correo"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Nacionalidad"><Input value={form.nacionalidad} onChange={(e) => setForm({ ...form, nacionalidad: e.target.value })} /></Field>
            <Field label="Fecha de nacimiento"><Input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} /></Field>
          </div>
          <Field label="Direccion"><Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></Field>
          <Field label="Notas"><Input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button type="submit">{editingGuest ? "Actualizar" : "Guardar"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} title="Detalle del huesped" className="max-w-3xl">
        {selectedGuest && (
          <div className="space-y-5">
            <div className="rounded-xl border bg-gray-50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xl font-semibold">{selectedGuest.nombres} {selectedGuest.apellidos}</p>
                  <p className="text-sm text-gray-500">{selectedGuest.tipo_documento || "Documento"} {selectedGuest.numero_documento || "sin numero"}</p>
                </div>
                <Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(selectedGuest) }}><Edit className="mr-2 h-4 w-4" /> Editar</Button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <Info label="Telefono" value={selectedGuest.telefono || "-"} />
                <Info label="Correo" value={selectedGuest.email || "-"} />
                <Info label="Nacionalidad" value={selectedGuest.nacionalidad || "-"} />
                <Info label="Nacimiento" value={selectedGuest.fecha_nacimiento ? formatDateShort(selectedGuest.fecha_nacimiento) : "-"} />
                <Info label="Direccion" value={selectedGuest.direccion || "-"} />
                <Info label="Registro" value={formatDateShort(selectedGuest.creado_en)} />
              </div>
              {selectedGuest.notas && <p className="mt-4 rounded-md bg-white p-3 text-sm text-gray-600"><span className="font-medium">Notas:</span> {selectedGuest.notas}</p>}
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold">Historial de reservas</h3>
              </div>
              {historyLoading ? (
                <p className="rounded-md border p-4 text-sm text-gray-500">Cargando historial...</p>
              ) : history.length === 0 ? (
                <p className="rounded-md border p-4 text-sm text-gray-500">Este huesped no tiene reservas registradas.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div key={item.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">Reserva {item.codigo_confirmacion}</p>
                        <p className="text-xs text-gray-500">{formatDateShort(item.fecha_entrada)} - {formatDateShort(item.fecha_salida)}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span>{item.estado}</span>
                        <span className="font-semibold">{formatCurrency(item.total || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmModal config={confirm} loading={saving} onCancel={() => setConfirm(null)} onConfirm={confirmAction} />
      <SuccessToast config={success} onClose={() => setSuccess(null)} />
    </div>
  )
}

function normalizePayload(form: typeof initialForm) {
  return {
    nombres: form.nombres.trim(),
    apellidos: form.apellidos.trim(),
    tipo_documento: form.tipo_documento || null,
    numero_documento: form.numero_documento.trim() || null,
    telefono: form.telefono.trim() || null,
    email: form.email.trim() || null,
    nacionalidad: form.nacionalidad.trim() || null,
    direccion: form.direccion.trim() || null,
    fecha_nacimiento: form.fecha_nacimiento || null,
    notas: form.notas.trim() || null,
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-sm font-medium text-gray-700"><span>{label}</span>{children}</label>
}

function SummaryCard({ title, value, text }: { title: string; value: string | number; text: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-gray-500">{text}</p>
      </CardContent>
    </Card>
  )
}

function ContactLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <p className="flex items-center gap-1.5 text-gray-600">{icon}<span>{text}</span></p>
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium text-gray-700">{label}:</span> <span className="text-gray-600">{value}</span></p>
}

function ConfirmModal({
  config,
  loading,
  onCancel,
  onConfirm,
}: {
  config: ConfirmConfig | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const destructive = config?.variant === "destructive"

  return (
    <Dialog open={!!config} onClose={onCancel} title={config?.title || "Confirmar accion"} className="max-w-md">
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${destructive ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
            {destructive ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-sm leading-6 text-gray-600">{config?.message}</p>
            <p className="mt-2 text-xs text-gray-500">Confirma para continuar con esta accion.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button type="button" variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={loading}>
            {loading ? "Procesando..." : config?.confirmLabel || "Confirmar"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function SuccessToast({ config, onClose }: { config: SuccessConfig | null; onClose: () => void }) {
  if (!config) return null

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[calc(100%-2.5rem)] max-w-md">
      <div className="flex items-start gap-3 rounded-md border border-green-200 bg-white p-4 shadow-2xl ring-1 ring-black/5">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-green-100 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">{config.title}</p>
          <p className="mt-1 text-sm leading-5 text-gray-600">{config.message}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700">
          Cerrar
        </button>
      </div>
    </div>
  )
}
