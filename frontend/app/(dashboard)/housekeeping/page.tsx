"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge, statusBadge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  User,
  XCircle,
} from "lucide-react"
import type { Habitacion, TareaLimpieza } from "@/types"

type PersonalItem = { id: string; nombre_completo: string }

const TIPO_LIMPIEZA_CONFIG: Record<string, { label: string; color: string }> = {
  SALIDA: { label: "Salida", color: "bg-red-100 text-red-700" },
  ESTADIA: { label: "Estadía", color: "bg-orange-100 text-orange-700" },
  GENERAL: { label: "General", color: "bg-gray-100 text-gray-700" },
  INSPECCION: { label: "Inspección", color: "bg-purple-100 text-purple-700" },
}

export default function HousekeepingPage() {
  const [tasks, setTasks] = useState<TareaLimpieza[]>([])
  const [rooms, setRooms] = useState<Habitacion[]>([])
  const [personal, setPersonal] = useState<PersonalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [assignModal, setAssignModal] = useState<{ taskId: string; then: string } | null>(null)
  const [filterPiso, setFilterPiso] = useState<string>("todos")

  const loadData = useCallback(() => {
    setLoading(true)
    setError("")
    Promise.all([api.limpieza.listar(), api.habitaciones.listar(), api.limpieza.personal()])
      .then(([tareas, habitaciones, staff]) => {
        setTasks(tareas)
        setRooms(habitaciones)
        setPersonal(staff)
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([api.limpieza.listar(), api.habitaciones.listar()])
        .then(([tareas, habitaciones]) => {
          setTasks(tareas)
          setRooms(habitaciones)
        })
        .catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  async function updateStatus(taskId: string, estado: string) {
    try {
      await api.limpieza.actualizar(taskId, { estado })
      loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function assignAndStart(taskId: string, userId: string, nextState: string) {
    try {
      await api.limpieza.actualizar(taskId, { asignada_a: userId, estado: nextState })
      loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  function handleStartTask(task: TareaLimpieza) {
    if (!task.asignada_a && personal.length > 0) {
      setAssignModal({ taskId: task.id, then: "EN_PROGRESO" })
    } else {
      updateStatus(task.id, "EN_PROGRESO")
    }
  }

  // Derived state
  const pendingTasks = tasks.filter((t) => t.estado === "PENDIENTE")
  const inProgressTasks = tasks.filter((t) => t.estado === "EN_PROGRESO")
  const inspectionTasks = tasks.filter((t) => t.estado === "INSPECCION")
  const completedTasks = tasks.filter((t) => t.estado === "COMPLETADA").slice(0, 12)

  const roomsByLimpieza = {
    sucias: rooms.filter((r) => r.estado_limpieza === "SUCIA"),
    enProgreso: rooms.filter((r) => r.estado_limpieza === "EN_PROGRESO"),
    inspeccion: rooms.filter((r) => r.estado_limpieza === "INSPECCION"),
    limpias: rooms.filter((r) => r.estado_limpieza === "LIMPIA"),
  }

  const pisos = Array.from(new Set(rooms.map((r) => r.piso || "N/A"))).sort()
  const filteredRooms = filterPiso === "todos" ? rooms : rooms.filter((r) => (r.piso || "N/A") === filterPiso)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Housekeeping</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestión de limpieza y estado de habitaciones · Auto-refresh cada 30s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Crear Tarea
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="instant-error rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <Metric label="Pendientes" value={pendingTasks.length} icon={<AlertTriangle className="h-5 w-5" />} className="border-amber-200 bg-amber-50 text-amber-900" />
        <Metric label="En Progreso" value={inProgressTasks.length} icon={<Sparkles className="h-5 w-5" />} className="border-blue-200 bg-blue-50 text-blue-900" />
        <Metric label="En Inspección" value={inspectionTasks.length} icon={<Eye className="h-5 w-5" />} className="border-purple-200 bg-purple-50 text-purple-900" />
        <Metric label="Completadas hoy" value={completedTasks.length} icon={<CheckCircle className="h-5 w-5" />} className="border-green-200 bg-green-50 text-green-900" />
        <Metric label="Hab. Sucias" value={roomsByLimpieza.sucias.length} icon={<AlertTriangle className="h-5 w-5" />} className="border-red-200 bg-red-50 text-red-900" />
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Cargando...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          {/* Column: Pendientes */}
          <KanbanColumn
            title="Pendientes"
            count={pendingTasks.length}
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            headerBg="bg-amber-50 border-amber-200"
            emptyText="No hay tareas pendientes"
          >
            {pendingTasks.map((task) => (
              <TaskCard key={task.id} task={task}>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => handleStartTask(task)}>
                    <PlayCircle className="mr-1 h-4 w-4" />
                    Iniciar
                  </Button>
                </div>
              </TaskCard>
            ))}
          </KanbanColumn>

          {/* Column: En Progreso */}
          <KanbanColumn
            title="En Progreso"
            count={inProgressTasks.length}
            icon={<Sparkles className="h-5 w-5 text-blue-600" />}
            headerBg="bg-blue-50 border-blue-200"
            emptyText="No hay tareas en progreso"
          >
            {inProgressTasks.map((task) => (
              <TaskCard key={task.id} task={task} showTimer>
                <Button size="sm" className="w-full" variant="secondary" onClick={() => updateStatus(task.id, "INSPECCION")}>
                  <Eye className="mr-1 h-4 w-4" />
                  Lista para inspección
                </Button>
              </TaskCard>
            ))}
          </KanbanColumn>

          {/* Column: En Inspección */}
          <KanbanColumn
            title="En Inspección"
            count={inspectionTasks.length}
            icon={<Eye className="h-5 w-5 text-purple-600" />}
            headerBg="bg-purple-50 border-purple-200"
            emptyText="No hay tareas en inspección"
          >
            {inspectionTasks.map((task) => (
              <TaskCard key={task.id} task={task}>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStatus(task.id, "EN_PROGRESO")}>
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Rechazar
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => updateStatus(task.id, "COMPLETADA")}>
                    <CheckCircle className="mr-1 h-4 w-4" />
                    Aprobar
                  </Button>
                </div>
              </TaskCard>
            ))}
          </KanbanColumn>

          {/* Column: Completadas */}
          <KanbanColumn
            title="Completadas"
            count={completedTasks.length}
            icon={<CheckCircle className="h-5 w-5 text-green-600" />}
            headerBg="bg-green-50 border-green-200"
            emptyText="No hay tareas completadas"
          >
            {completedTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </KanbanColumn>
        </div>
      )}

      {/* Floor View */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Vista por Pisos</CardTitle>
            <div className="flex items-center gap-2">
              <select
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={filterPiso}
                onChange={(e) => setFilterPiso(e.target.value)}
              >
                <option value="todos">Todos los pisos</option>
                {pisos.map((p) => (
                  <option key={p} value={p}>Piso {p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-400" /> Limpia</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-400" /> Sucia</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-blue-400" /> En Progreso</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-purple-400" /> Inspección</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-gray-400" /> Ocupada</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {filteredRooms.map((room) => (
              <FloorRoomTile key={room.id} room={room} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          rooms={rooms}
          personal={personal}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadData}
        />
      )}

      {/* Assign Modal */}
      {assignModal && (
        <AssignModal
          personal={personal}
          onClose={() => setAssignModal(null)}
          onAssign={(userId) => {
            assignAndStart(assignModal.taskId, userId, assignModal.then)
            setAssignModal(null)
          }}
        />
      )}
    </div>
  )
}

/* ─── Kanban Column ─── */
function KanbanColumn({
  title,
  count,
  icon,
  headerBg,
  emptyText,
  children,
}: {
  title: string
  count: number
  icon: React.ReactNode
  headerBg: string
  emptyText: string
  children: React.ReactNode
}) {
  const items = Array.isArray(children) ? children : children ? [children] : []
  return (
    <Card className="overflow-hidden flex flex-col">
      <CardHeader className={`border-b ${headerBg} py-3 px-4`}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-sm font-bold">{count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 p-3 max-h-[500px] overflow-y-auto">
        {items.length === 0 || count === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-400">{emptyText}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Task Card ─── */
function TaskCard({
  task,
  children,
  showTimer,
}: {
  task: TareaLimpieza
  children?: React.ReactNode
  showTimer?: boolean
}) {
  const tipoConfig = TIPO_LIMPIEZA_CONFIG[task.tipo_limpieza] || TIPO_LIMPIEZA_CONFIG.GENERAL
  const isHighPriority = task.prioridad === "alta"

  const elapsed = showTimer && task.iniciada_en ? getElapsed(task.iniciada_en) : null

  return (
    <div
      className={`rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${
        isHighPriority ? "border-l-4 border-l-red-400" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">
              Hab. {task.numero_habitacion || task.habitacion_id.slice(0, 6)}
            </p>
            {task.piso && (
              <span className="text-xs text-gray-400">Piso {task.piso}</span>
            )}
          </div>
          {task.tipo_habitacion_nombre && (
            <p className="text-xs text-gray-500 mt-0.5">{task.tipo_habitacion_nombre}</p>
          )}
        </div>
        <Badge {...statusBadge(task.estado)} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tipoConfig.color}`}>
          {tipoConfig.label}
        </span>
        {isHighPriority && (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            Alta prioridad
          </span>
        )}
      </div>

      {task.nombre_asignada && (
        <p className="flex items-center gap-1 text-xs text-gray-500 mb-1">
          <User className="h-3 w-3" />
          {task.nombre_asignada}
        </p>
      )}

      {task.notas && (
        <p className="text-xs text-gray-400 mb-1 truncate" title={task.notas}>
          {task.notas}
        </p>
      )}

      {elapsed && (
        <p className="flex items-center gap-1 text-xs text-blue-500 mb-2">
          <Clock className="h-3 w-3" />
          {elapsed}
        </p>
      )}

      {task.completada_en && (
        <p className="text-xs text-gray-400 mb-1">
          ✓ {new Date(task.completada_en).toLocaleString("es-HN", { hour: "2-digit", minute: "2-digit", hour12: true })}
        </p>
      )}

      {children && <div className="mt-2 pt-2 border-t">{children}</div>}
    </div>
  )
}

/* ─── Floor Room Tile ─── */
function FloorRoomTile({ room }: { room: Habitacion }) {
  const colorMap: Record<string, string> = {
    LIMPIA: "bg-green-100 border-green-300 text-green-800",
    SUCIA: "bg-amber-100 border-amber-300 text-amber-800",
    EN_PROGRESO: "bg-blue-100 border-blue-300 text-blue-800",
    INSPECCION: "bg-purple-100 border-purple-300 text-purple-800",
  }
  const isOccupied = room.estado_operativo === "OCUPADA"
  const tileColor = isOccupied ? "bg-gray-100 border-gray-300 text-gray-500" : colorMap[room.estado_limpieza] || "bg-gray-50 border-gray-200 text-gray-600"

  return (
    <div
      className={`relative rounded-lg border-2 p-2 text-center transition-transform hover:scale-105 ${tileColor}`}
      title={`Hab ${room.numero} · ${room.estado_limpieza} · ${room.estado_operativo}`}
    >
      <p className="font-bold text-sm">{room.numero}</p>
      <p className="text-[10px] leading-tight mt-0.5">
        {isOccupied ? "Ocupada" : room.estado_limpieza === "LIMPIA" ? "Limpia" : room.estado_limpieza === "SUCIA" ? "Sucia" : room.estado_limpieza === "EN_PROGRESO" ? "Limpiando" : room.estado_limpieza === "INSPECCION" ? "Inspección" : room.estado_limpieza}
      </p>
    </div>
  )
}

/* ─── Create Task Modal ─── */
function CreateTaskModal({
  rooms,
  personal,
  onClose,
  onCreated,
}: {
  rooms: Habitacion[]
  personal: PersonalItem[]
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    habitacion_id: "",
    asignada_a: "",
    tipo_limpieza: "GENERAL",
    prioridad: "normal",
    notas: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [searchRoom, setSearchRoom] = useState("")

  const availableRooms = rooms.filter(
    (r) =>
      r.estado_operativo !== "OCUPADA" &&
      (searchRoom === "" || r.numero.includes(searchRoom))
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.habitacion_id) {
      setError("Seleccione una habitación")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const today = new Date().toISOString().split("T")[0]
      await api.limpieza.crear({
        habitacion_id: form.habitacion_id,
        asignada_a: form.asignada_a || null,
        fecha_tarea: today,
        tipo_limpieza: form.tipo_limpieza,
        prioridad: form.prioridad,
        notas: form.notas || null,
      })
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Crear Tarea de Limpieza" className="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="instant-error rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-600">{error}</div>
        )}

        {/* Room Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Habitación *</label>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número..."
              className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={searchRoom}
              onChange={(e) => setSearchRoom(e.target.value)}
            />
          </div>
          <div className="max-h-32 overflow-y-auto rounded-md border border-gray-200">
            {availableRooms.length === 0 ? (
              <p className="p-3 text-center text-sm text-gray-400">No hay habitaciones disponibles</p>
            ) : (
              availableRooms.map((room) => (
                <button
                  type="button"
                  key={room.id}
                  onClick={() => setForm((f) => ({ ...f, habitacion_id: room.id }))}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-blue-50 transition-colors ${
                    form.habitacion_id === room.id ? "bg-blue-100 font-medium" : ""
                  }`}
                >
                  <span>
                    Hab. {room.numero}
                    <span className="text-gray-400 ml-1">· Piso {room.piso || "-"}</span>
                  </span>
                  <Badge {...statusBadge(room.estado_limpieza)} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Assigned To */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a</label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={form.asignada_a}
            onChange={(e) => setForm((f) => ({ ...f, asignada_a: e.target.value }))}
          >
            <option value="">Sin asignar</option>
            {personal.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre_completo}</option>
            ))}
          </select>
        </div>

        {/* Type & Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={form.tipo_limpieza}
              onChange={(e) => setForm((f) => ({ ...f, tipo_limpieza: e.target.value }))}
            >
              <option value="GENERAL">General</option>
              <option value="SALIDA">Salida</option>
              <option value="ESTADIA">Estadía</option>
              <option value="INSPECCION">Inspección</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={form.prioridad}
              onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))}
            >
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            rows={2}
            placeholder="Instrucciones adicionales..."
            value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? "Creando..." : "Crear Tarea"}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/* ─── Assign Modal ─── */
function AssignModal({
  personal,
  onClose,
  onAssign,
}: {
  personal: PersonalItem[]
  onClose: () => void
  onAssign: (userId: string) => void
}) {
  const [selected, setSelected] = useState("")

  return (
    <Dialog open onClose={onClose} title="Asignar Personal" className="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Seleccione al empleado de limpieza para esta tarea.
        </p>

        {personal.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-gray-400">
            No hay personal de limpieza registrado.
          </p>
        ) : (
          <div className="space-y-1">
            {personal.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-colors ${
                  selected === p.id
                    ? "bg-blue-100 border border-blue-300 font-medium"
                    : "hover:bg-gray-50 border border-transparent"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <User className="h-4 w-4" />
                </div>
                {p.nombre_completo}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!selected}
            onClick={() => onAssign(selected)}
          >
            Asignar e Iniciar
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/* ─── Helpers ─── */
function Metric({
  label,
  value,
  icon,
  className,
}: {
  label: string
  value: number
  icon: React.ReactNode
  className: string
}) {
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
        <span className="opacity-60">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  )
}

function getElapsed(since: string): string {
  const ms = Date.now() - new Date(since).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hours}h ${remainMins}m`
}
