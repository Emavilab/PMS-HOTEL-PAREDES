"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/utils"
import { Shield } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import type { RegistroAuditoria } from "@/types"

export default function AuditoriaPage() {
  const { user: currentUser } = useAuth()
  const [logs, setLogs] = useState<RegistroAuditoria[]>([])
  const [loading, setLoading] = useState(true)
  const [entityFilter, setEntityFilter] = useState("")

  useEffect(() => {
    api.auditoria.listar({ limit: "200" }).then(setLogs).finally(() => setLoading(false))
  }, [])

  const filtered = entityFilter
    ? logs.filter((l) => l.tipo_entidad.includes(entityFilter))
    : logs

  if (currentUser?.rol !== "admin" && currentUser?.rol !== "gerente") {
    return <p className="text-gray-500">No tienes permisos para ver esta página.</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Shield className="h-6 w-6" /> Auditoría
      </h1>

      <div className="flex gap-4">
        <Input
          placeholder="Filtrar por entidad (reserva, huesped, habitacion...)"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-gray-500">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-gray-500">No hay registros de auditoría</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3">Fecha</th>
                    <th className="text-left p-3">Usuario</th>
                    <th className="text-left p-3">Acción</th>
                    <th className="text-left p-3">Entidad</th>
                    <th className="text-left p-3">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{formatDate(log.creado_en)}</td>
                      <td className="p-3">{log.nombre_usuario || "-"}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{log.accion}</span>
                      </td>
                      <td className="p-3">{log.tipo_entidad}</td>
                      <td className="p-3 text-gray-500">{log.entidad_id ? log.entidad_id.substring(0, 8) + "..." : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
