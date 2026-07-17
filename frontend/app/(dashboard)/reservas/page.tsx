"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, statusBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { Plus, Search } from "lucide-react"
import Link from "next/link"
import type { ReservaLista } from "@/types"

export default function ReservasPage() {
  const [reservations, setReservations] = useState<ReservaLista[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    api.reservas.listar().then(setReservations).finally(() => setLoading(false))
  }, [])

  const filtered = reservations.filter(
    (r) =>
      r.huesped_nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.codigo_confirmacion.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reservas</h1>
        <Link href="/reservas/nueva">
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Nueva Reserva
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Buscar por huésped o código..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-gray-500">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-gray-500">No se encontraron reservas</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Código</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Huésped</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Habitación</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Entrada</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Salida</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Total</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium">{r.codigo_confirmacion}</td>
                      <td className="p-4">{r.huesped_nombre}</td>
                      <td className="p-4">{r.numero_habitacion || "-"}</td>
                      <td className="p-4">{formatDateShort(r.fecha_entrada)}</td>
                      <td className="p-4">{formatDateShort(r.fecha_salida)}</td>
                      <td className="p-4">{formatCurrency(r.total)}</td>
                      <td className="p-4"><Badge {...statusBadge(r.estado)} /></td>
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
