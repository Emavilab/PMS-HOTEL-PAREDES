"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge, statusBadge } from "@/components/ui/badge"
import { CheckCircle, Clock } from "lucide-react"
import type { TareaLimpieza } from "@/types"

export default function HousekeepingPage() {
  const [tasks, setTasks] = useState<TareaLimpieza[]>([])
  const [loading, setLoading] = useState(true)

  function loadTasks() {
    setLoading(true)
    api.limpieza.listar().then(setTasks).finally(() => setLoading(false))
  }

  useEffect(() => { loadTasks() }, [])

  async function updateStatus(taskId: string, status: string) {
    await api.limpieza.actualizar(taskId, { status })
    loadTasks()
  }

  const pendingTasks = tasks.filter((t) => t.estado === "PENDIENTE")
  const inProgressTasks = tasks.filter((t) => t.estado === "EN_PROGRESO")
  const completedTasks = tasks.filter((t) => t.estado === "COMPLETADA")

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Housekeeping</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" /> Pendientes ({pendingTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingTasks.map((task) => (
              <div key={task.id} className="p-3 bg-gray-50 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Habitación {task.numero_habitacion}</p>
                    <p className="text-xs text-gray-500">{task.notas || "Limpieza general"}</p>
                  </div>
                  <Button size="sm" onClick={() => updateStatus(task.id, "EN_PROGRESO")}>
                    Iniciar
                  </Button>
                </div>
              </div>
            ))}
            {pendingTasks.length === 0 && <p className="text-gray-500 text-sm">No hay tareas pendientes</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" /> En Progreso ({inProgressTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inProgressTasks.map((task) => (
              <div key={task.id} className="p-3 bg-blue-50 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Habitación {task.numero_habitacion}</p>
                    <p className="text-xs text-gray-500">{task.notas || "Limpieza general"}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(task.id, "COMPLETADA")}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Completar
                  </Button>
                </div>
              </div>
            ))}
            {inProgressTasks.length === 0 && <p className="text-gray-500 text-sm">No hay tareas en progreso</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" /> Completadas ({completedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedTasks.map((task) => (
              <div key={task.id} className="p-3 bg-green-50 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Habitación {task.numero_habitacion}</p>
                    <p className="text-xs text-gray-500">
                      {task.completada_en ? new Date(task.completada_en).toLocaleString("es-HN") : ""}
                    </p>
                  </div>
                  <Badge {...statusBadge("COMPLETADA")} />
                </div>
              </div>
            ))}
            {completedTasks.length === 0 && <p className="text-gray-500 text-sm">No hay tareas completadas</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
