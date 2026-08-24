"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, statusBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { AlertTriangle, CheckCircle2, Edit, Plus, Trash2 } from "lucide-react"
import type { Habitacion, TipoHabitacion } from "@/types"
import { formatCurrency } from "@/lib/utils"

const roomInitial = {
  tipo_habitacion_id: "",
  numero: "",
  piso: "",
  estado_operativo: "DISPONIBLE",
  estado_limpieza: "LIMPIA",
  notas: "",
}

const typeInitial = {
  codigo: "",
  nombre: "",
  descripcion: "",
  capacidad_base: 1,
  capacidad_maxima: 2,
  precio_base: 0,
  comodidades: "",
  estado: "activo",
}

type ConfirmConfig = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  variant: "default" | "destructive"
  action: () => Promise<void>
}

export default function HabitacionesPage() {
  const [rooms, setRooms] = useState<Habitacion[]>([])
  const [roomTypes, setRoomTypes] = useState<TipoHabitacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [roomDialog, setRoomDialog] = useState(false)
  const [typeDialog, setTypeDialog] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Habitacion | null>(null)
  const [editingType, setEditingType] = useState<TipoHabitacion | null>(null)
  const [roomForm, setRoomForm] = useState(roomInitial)
  const [typeForm, setTypeForm] = useState(typeInitial)
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null)

  function loadData() {
    setLoading(true)
    setError("")
    Promise.all([api.habitaciones.listar(), api.tiposHabitacion.listar()])
      .then(([r, rt]) => {
        setRooms(r)
        setRoomTypes(rt)
      })
      .catch((err) => setError(err.message || "No se pudo cargar habitaciones"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const floors = useMemo(
    () => Array.from(new Set(rooms.map((room) => room.piso).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [rooms]
  )

  const activeRoomTypes = useMemo(
    () => roomTypes.filter((type) => type.estado.toLowerCase() === "activo"),
    [roomTypes]
  )

  const selectableRoomTypes = useMemo(() => {
    if (!editingRoom || activeRoomTypes.some((type) => type.id === editingRoom.tipo_habitacion_id)) return activeRoomTypes
    const currentType = roomTypes.find((type) => type.id === editingRoom.tipo_habitacion_id)
    return currentType ? [currentType, ...activeRoomTypes] : activeRoomTypes
  }, [activeRoomTypes, editingRoom, roomTypes])

  const selectedRoomType = roomTypes.find((type) => type.id === roomForm.tipo_habitacion_id)
  const selectedTypeInactive = !!selectedRoomType && selectedRoomType.estado.toLowerCase() !== "activo"

  const roomsByFloor = rooms.reduce<Record<string, Habitacion[]>>((acc, room) => {
    const floor = room.piso || "Sin piso"
    if (!acc[floor]) acc[floor] = []
    acc[floor].push(room)
    return acc
  }, {})

  function openRoomForm(room?: Habitacion, floor?: string) {
    setEditingRoom(room || null)
    setRoomForm(room ? {
      tipo_habitacion_id: room.tipo_habitacion_id,
      numero: room.numero,
      piso: room.piso || "",
      estado_operativo: room.estado_operativo,
      estado_limpieza: room.estado_limpieza,
      notas: room.notas || "",
    } : { ...roomInitial, piso: floor && floor !== "Sin piso" ? floor : "" })
    setError("")
    setRoomDialog(true)
  }

  function openTypeForm(type?: TipoHabitacion) {
    setEditingType(type || null)
    setTypeForm(type ? {
      codigo: type.codigo,
      nombre: type.nombre,
      descripcion: type.descripcion || "",
      capacidad_base: type.capacidad_base,
      capacidad_maxima: type.capacidad_maxima,
      precio_base: type.precio_base,
      comodidades: type.comodidades || "",
      estado: type.estado,
    } : typeInitial)
    setError("")
    setTypeDialog(true)
  }

  function saveRoom(e: FormEvent) {
    e.preventDefault()
    if (!roomForm.numero || !roomForm.tipo_habitacion_id) {
      setError("Indica numero y tipo de habitacion")
      return
    }
    if (selectedTypeInactive && (!editingRoom || editingRoom.tipo_habitacion_id !== roomForm.tipo_habitacion_id)) {
      setError("Selecciona un tipo de habitacion activo")
      return
    }
    setConfirm({
      open: true,
      title: editingRoom ? "Confirmar cambios" : "Crear habitacion",
      message: editingRoom
        ? `Se actualizaran los datos de la habitacion ${roomForm.numero}.`
        : `Se creara la habitacion ${roomForm.numero} en el piso ${roomForm.piso || "sin piso"}.`,
      confirmLabel: editingRoom ? "Guardar cambios" : "Crear habitacion",
      variant: "default",
      action: persistRoom,
    })
  }

  async function persistRoom() {
    setSaving(true)
    setError("")
    try {
      const payload = { ...roomForm, piso: roomForm.piso || null, notas: roomForm.notas || null }
      if (editingRoom) await api.habitaciones.actualizar(editingRoom.id, payload)
      else await api.habitaciones.crear(payload)
      setRoomDialog(false)
      loadData()
    } catch (err: any) {
      setError(err.message || "No se pudo guardar la habitacion")
    } finally {
      setSaving(false)
    }
  }

  function saveType(e: FormEvent) {
    e.preventDefault()
    if (!typeForm.codigo || !typeForm.nombre) {
      setError("Indica codigo y nombre del tipo")
      return
    }
    setConfirm({
      open: true,
      title: editingType ? "Confirmar cambios" : "Crear tipo de habitacion",
      message: editingType
        ? `Se actualizara el tipo ${typeForm.nombre}.`
        : `Se creara el tipo de habitacion ${typeForm.nombre}.`,
      confirmLabel: editingType ? "Guardar cambios" : "Crear tipo",
      variant: "default",
      action: persistType,
    })
  }

  async function persistType() {
    setSaving(true)
    setError("")
    try {
      const payload = {
        ...typeForm,
        capacidad_base: Number(typeForm.capacidad_base),
        capacidad_maxima: Number(typeForm.capacidad_maxima),
        precio_base: Number(typeForm.precio_base),
        descripcion: typeForm.descripcion || null,
        comodidades: typeForm.comodidades || null,
      }
      if (editingType) await api.tiposHabitacion.actualizar(editingType.id, payload)
      else await api.tiposHabitacion.crear(payload)
      setTypeDialog(false)
      loadData()
    } catch (err: any) {
      setError(err.message || "No se pudo guardar el tipo de habitacion")
    } finally {
      setSaving(false)
    }
  }

  function deleteRoom(room: Habitacion) {
    setConfirm({
      open: true,
      title: "Eliminar habitacion",
      message: `Esta accion eliminara la habitacion ${room.numero}. Si tiene reservas, ventas o tareas asociadas, el sistema no permitira eliminarla.`,
      confirmLabel: "Eliminar habitacion",
      variant: "destructive",
      action: async () => {
        try {
          await api.habitaciones.eliminar(room.id)
          loadData()
        } catch (err: any) {
          setError(err.message || "No se pudo eliminar la habitacion")
        }
      },
    })
  }

  function deleteType(type: TipoHabitacion) {
    setConfirm({
      open: true,
      title: "Eliminar tipo de habitacion",
      message: `Esta accion eliminara el tipo ${type.nombre}. No se podra eliminar si tiene habitaciones asignadas.`,
      confirmLabel: "Eliminar tipo",
      variant: "destructive",
      action: async () => {
        try {
          await api.tiposHabitacion.eliminar(type.id)
          loadData()
        } catch (err: any) {
          setError(err.message || "No se pudo eliminar el tipo de habitacion")
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
          <h1 className="text-2xl font-bold">Habitaciones</h1>
          <p className="text-sm text-gray-500">Administra pisos, habitaciones y tipos desde un solo apartado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openTypeForm()}><Plus className="mr-2 h-4 w-4" /> Tipo</Button>
          <Button onClick={() => openRoomForm()}><Plus className="mr-2 h-4 w-4" /> Habitacion</Button>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading && <Card><CardContent className="p-6 text-sm text-gray-500">Cargando habitaciones...</CardContent></Card>}

      {!loading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Object.entries(roomsByFloor).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([floor, floorRooms]) => (
            <Card key={floor}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Piso {floor}</CardTitle>
                <Button size="sm" variant="outline" onClick={() => openRoomForm(undefined, floor)}>Agregar habitacion</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {floorRooms.map((room) => (
                  <div key={room.id} className="rounded-md bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">#{room.numero}</p>
                        <p className="text-xs text-gray-500">{room.tipo_habitacion?.nombre || "Sin tipo"}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openRoomForm(room)}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteRoom(room)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <Badge {...statusBadge(room.estado_operativo)} />
                      <Badge {...statusBadge(room.estado_limpieza)} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          {rooms.length === 0 && <Card><CardContent className="p-6 text-sm text-gray-500">No hay habitaciones registradas.</CardContent></Card>}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Tipos de Habitacion</CardTitle>
          <Button size="sm" onClick={() => openTypeForm()}><Plus className="mr-2 h-4 w-4" /> Nuevo tipo</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-4 text-left text-sm font-medium text-gray-500">Codigo</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-500">Nombre</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-500">Capacidad</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-500">Precio</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-500">Estado</th>
                  <th className="p-4 text-right text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {roomTypes.map((rt) => (
                  <tr key={rt.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">{rt.codigo}</td>
                    <td className="p-4">{rt.nombre}</td>
                    <td className="p-4">{rt.capacidad_base}-{rt.capacidad_maxima} pers.</td>
                    <td className="p-4">{formatCurrency(rt.precio_base)}</td>
                    <td className="p-4"><Badge {...statusBadge(rt.estado)} /></td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openTypeForm(rt)}><Edit className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteType(rt)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={roomDialog} onClose={() => setRoomDialog(false)} title={editingRoom ? "Editar habitacion" : "Nueva habitacion"}>
        <form className="space-y-4" onSubmit={saveRoom}>
          <Field label="Numero"><Input value={roomForm.numero} onChange={(e) => setRoomForm({ ...roomForm, numero: e.target.value })} /></Field>
          <Field label="Piso">
            <Input list="pisos" placeholder="Ej. 1, 2, Torre A" value={roomForm.piso} onChange={(e) => setRoomForm({ ...roomForm, piso: e.target.value })} />
            <datalist id="pisos">{floors.map((floor) => <option key={floor} value={floor} />)}</datalist>
            <p className="mt-1 text-xs text-gray-500">Escribe un piso nuevo para crearlo al guardar la habitacion.</p>
          </Field>
          <Field label="Tipo de habitacion">
            <select className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={roomForm.tipo_habitacion_id} onChange={(e) => setRoomForm({ ...roomForm, tipo_habitacion_id: e.target.value })}>
              <option value="">Seleccionar tipo</option>
              {selectableRoomTypes.map((type) => <option key={type.id} value={type.id}>{type.nombre}{type.estado.toLowerCase() !== "activo" ? " (inactivo)" : ""}</option>)}
            </select>
            {selectedTypeInactive && (
              <p className="mt-1 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                Este tipo esta inactivo. Puedes conservarlo en esta habitacion existente, pero no se recomienda asignarlo a nuevas habitaciones.
              </p>
            )}
            {activeRoomTypes.length === 0 && (
              <p className="mt-1 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                No hay tipos de habitacion activos. Activa o crea un tipo antes de agregar habitaciones.
              </p>
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Estado operativo">
              <select className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={roomForm.estado_operativo} onChange={(e) => setRoomForm({ ...roomForm, estado_operativo: e.target.value })}>
                <option value="DISPONIBLE">Disponible</option>
                <option value="OCUPADA">Ocupada</option>
                <option value="MANTENIMIENTO">Mantenimiento</option>
                <option value="BLOQUEADA">Bloqueada</option>
              </select>
            </Field>
            <Field label="Limpieza">
              <select className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={roomForm.estado_limpieza} onChange={(e) => setRoomForm({ ...roomForm, estado_limpieza: e.target.value })}>
                <option value="LIMPIA">Limpia</option>
                <option value="SUCIA">Sucia</option>
                <option value="EN_PROGRESO">En progreso</option>
                <option value="INSPECCIONADA">Inspeccionada</option>
              </select>
            </Field>
          </div>
          <Field label="Notas"><Input value={roomForm.notas} onChange={(e) => setRoomForm({ ...roomForm, notas: e.target.value })} /></Field>
          <DialogActions saving={saving} onCancel={() => setRoomDialog(false)} />
        </form>
      </Dialog>

      <Dialog open={typeDialog} onClose={() => setTypeDialog(false)} title={editingType ? "Editar tipo" : "Nuevo tipo de habitacion"}>
        <form className="space-y-4" onSubmit={saveType}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Codigo"><Input value={typeForm.codigo} onChange={(e) => setTypeForm({ ...typeForm, codigo: e.target.value })} /></Field>
            <Field label="Nombre"><Input value={typeForm.nombre} onChange={(e) => setTypeForm({ ...typeForm, nombre: e.target.value })} /></Field>
          </div>
          <Field label="Descripcion"><Input value={typeForm.descripcion} onChange={(e) => setTypeForm({ ...typeForm, descripcion: e.target.value })} /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Capacidad base"><Input type="number" min="1" value={typeForm.capacidad_base} onChange={(e) => setTypeForm({ ...typeForm, capacidad_base: Number(e.target.value) })} /></Field>
            <Field label="Capacidad maxima"><Input type="number" min="1" value={typeForm.capacidad_maxima} onChange={(e) => setTypeForm({ ...typeForm, capacidad_maxima: Number(e.target.value) })} /></Field>
            <Field label="Precio base"><Input type="number" min="0" step="0.01" value={typeForm.precio_base} onChange={(e) => setTypeForm({ ...typeForm, precio_base: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Comodidades"><Input value={typeForm.comodidades} onChange={(e) => setTypeForm({ ...typeForm, comodidades: e.target.value })} /></Field>
          <Field label="Estado">
            <select className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={typeForm.estado} onChange={(e) => setTypeForm({ ...typeForm, estado: e.target.value })}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </Field>
          <DialogActions saving={saving} onCancel={() => setTypeDialog(false)} />
        </form>
      </Dialog>

      <ConfirmModal
        config={confirm}
        loading={saving}
        onCancel={() => setConfirm(null)}
        onConfirm={confirmAction}
      />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-sm font-medium text-gray-700"><span>{label}</span>{children}</label>
}

function DialogActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
    </div>
  )
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
    <Dialog open={!!config?.open} onClose={onCancel} title={config?.title || "Confirmar accion"} className="max-w-md">
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${destructive ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
            {destructive ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-sm leading-6 text-gray-600">{config?.message}</p>
            <p className="mt-2 text-xs text-gray-500">Revisa la informacion antes de continuar.</p>
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
