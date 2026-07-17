"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, statusBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { Habitacion, TipoHabitacion } from "@/types"
import { formatCurrency } from "@/lib/utils"

export default function HabitacionesPage() {
  const [rooms, setRooms] = useState<Habitacion[]>([])
  const [roomTypes, setRoomTypes] = useState<TipoHabitacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.habitaciones.listar(),
      api.tiposHabitacion.listar(),
    ]).then(([r, rt]) => {
      setRooms(r)
      setRoomTypes(rt)
    }).finally(() => setLoading(false))
  }, [])

  const roomsByFloor = rooms.reduce<Record<string, Habitacion[]>>((acc, room) => {
    const floor = room.piso || "0"
    if (!acc[floor]) acc[floor] = []
    acc[floor].push(room)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Habitaciones</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(roomsByFloor).sort().map(([floor, floorRooms]) => (
          <Card key={floor}>
            <CardHeader>
              <CardTitle className="text-lg">Piso {floor}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {floorRooms.map((room) => (
                <div key={room.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <p className="font-medium">#{room.numero}</p>
                    <p className="text-xs text-gray-500">{room.tipo_habitacion?.nombre}</p>
                  </div>
                  <div className="flex gap-1">
                    <Badge {...statusBadge(room.estado_operativo)} />
                    <Badge {...statusBadge(room.estado_limpieza)} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tipos de Habitación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-4 text-sm font-medium text-gray-500">Código</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500">Nombre</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500">Capacidad</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500">Precio</th>
                  <th className="text-left p-4 text-sm font-medium text-gray-500">Estado</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
