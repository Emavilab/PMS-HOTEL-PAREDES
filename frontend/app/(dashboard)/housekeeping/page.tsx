"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge, statusBadge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, Clock, PlayCircle, Sparkles } from "lucide-react"
import type { Habitacion, TareaLimpieza } from "@/types"

export default function HousekeepingPage() {
  const [tasks, setTasks] = useState<TareaLimpieza[]>([])
  const [rooms, setRooms] = useState<Habitacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  function loadData() {
    setLoading(true)
    setError("")
    Promise.all([api.limpieza.listar(), api.habitaciones.listar()])
      .then(([tareas, habitaciones]) => {
        setTasks(tareas)
        setRooms(habitaciones)
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  async function createTask(room: Habitacion) {
    const today = new Date().toISOString().split("T")[0]
    await api.limpieza.crear({
      habitacion_id: room.id,
      fecha_tarea: today,
      prioridad: room.estado_limpieza === "SUCIA" ? "alta" : "normal",
      notas: room.estado_limpieza === "SUCIA" ? "Limpieza posterior a salida" : "Limpieza general",
    })
    loadData()
  }

  async function updateStatus(taskId: string, estado: string) {
    await api.limpieza.actualizar(taskId, { estado })
    loadData()
  }

  async function markRoom(room: Habitacion, estado_limpieza: string) {
    await api.habitaciones.actualizarEstado(room.id, { estado_limpieza })
    loadData()
  }

  const activeTaskRoomIds = new Set(tasks.filter((t) => t.estado !== "COMPLETADA").map((t) => t.habitacion_id))
  const dirtyWithoutTask = rooms.filter((r) => r.estado_limpieza === "SUCIA" && !activeTaskRoomIds.has(r.id))
  const pendingTasks = tasks.filter((t) => t.estado === "PENDIENTE")
  const inProgressTasks = tasks.filter((t) => t.estado === "EN_PROGRESO")
  const completedTasks = tasks.filter((t) => t.estado === "COMPLETADA").slice(0, 12)
  const cleanRooms = rooms.filter((r) => r.estado_limpieza === "LIMPIA")
  const inCleaningRooms = rooms.filter((r) => r.estado_limpieza === "EN_PROGRESO")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Housekeeping</h1>
        <p className="mt-1 text-sm text-gray-500">Controla limpieza y disponibilidad real para recepción.</p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Sucias sin tarea" value={dirtyWithoutTask.length} className="border-red-200 bg-red-50 text-red-900" />
        <Metric label="Pendientes" value={pendingTasks.length} className="border-yellow-200 bg-yellow-50 text-yellow-900" />
        <Metric label="En limpieza" value={inProgressTasks.length + inCleaningRooms.length} className="border-blue-200 bg-blue-50 text-blue-900" />
        <Metric label="Limpias" value={cleanRooms.length} className="border-green-200 bg-green-50 text-green-900" />
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-red-50">
              <CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-red-600" /> Sucias sin tarea ({dirtyWithoutTask.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {dirtyWithoutTask.map((room) => (
                <RoomCard key={room.id} room={room}>
                  <Button size="sm" onClick={() => createTask(room)}>Crear tarea</Button>
                </RoomCard>
              ))}
              {dirtyWithoutTask.length === 0 && <Empty text="No hay habitaciones sucias sin tarea" />}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-yellow-50">
              <CardTitle className="flex items-center gap-2 text-lg"><Clock className="h-5 w-5 text-yellow-600" /> Pendientes ({pendingTasks.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {pendingTasks.map((task) => (
                <TaskCard key={task.id} task={task}>
                  <Button size="sm" onClick={() => updateStatus(task.id, "EN_PROGRESO")}><PlayCircle className="mr-1 h-4 w-4" /> Iniciar</Button>
                </TaskCard>
              ))}
              {pendingTasks.length === 0 && <Empty text="No hay tareas pendientes" />}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-blue-600" /> En limpieza ({inProgressTasks.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {inProgressTasks.map((task) => (
                <TaskCard key={task.id} task={task}>
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(task.id, "COMPLETADA")}><CheckCircle className="mr-1 h-4 w-4" /> Completar</Button>
                </TaskCard>
              ))}
              {inProgressTasks.length === 0 && <Empty text="No hay tareas en progreso" />}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-green-50">
              <CardTitle className="flex items-center gap-2 text-lg"><CheckCircle className="h-5 w-5 text-green-600" /> Completadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {completedTasks.map((task) => <TaskCard key={task.id} task={task} />)}
              {completedTasks.length === 0 && <Empty text="No hay tareas completadas" />}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ajuste rápido de estado de habitaciones</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room}>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => markRoom(room, "SUCIA")} disabled={room.estado_operativo === "OCUPADA"}>Sucia</Button>
                <Button size="sm" variant="outline" onClick={() => markRoom(room, "EN_PROGRESO")} disabled={room.estado_operativo === "OCUPADA"}>En limpieza</Button>
                <Button size="sm" onClick={() => markRoom(room, "LIMPIA")} disabled={room.estado_operativo === "OCUPADA"}>Limpia</Button>
              </div>
            </RoomCard>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function TaskCard({ task, children }: { task: TareaLimpieza; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Habitación {task.numero_habitacion || task.habitacion_id}</p>
          <p className="text-xs text-gray-500">{task.notas || "Limpieza general"}</p>
          {task.completada_en && <p className="mt-1 text-xs text-gray-400">{new Date(task.completada_en).toLocaleString("es-HN")}</p>}
        </div>
        <Badge {...statusBadge(task.estado)} />
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

function RoomCard({ room, children }: { room: Habitacion; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Habitación {room.numero}</p>
          <p className="text-xs text-gray-500">{room.tipo_habitacion?.nombre || "Sin tipo"} · Piso {room.piso || "-"}</p>
        </div>
        <Badge {...statusBadge(room.estado_limpieza)} />
      </div>
      {children}
    </div>
  )
}

function Metric({ label, value, className }: { label: string; value: number; className: string }) {
  return <div className={`rounded-xl border p-4 ${className}`}><p className="text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-500">{text}</p>
}
