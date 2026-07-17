"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, statusBadge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { api } from "@/lib/api"
import { Calendar, Users, BedDouble, DollarSign } from "lucide-react"
import type { ReservaLista } from "@/types"
import Link from "next/link"

export default function DashboardPage() {
  const [arrivals, setArrivals] = useState<any[]>([])
  const [departures, setDepartures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toLocaleDateString("es-HN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })

  useEffect(() => {
    Promise.all([
      api.reportes.llegadas(),
      api.reportes.salidas(),
    ]).then(([arr, dep]) => {
      setArrivals(arr)
      setDepartures(dep)
    }).finally(() => setLoading(false))
  }, [])

  const stats = [
    { label: "Llegadas hoy", value: arrivals.length, icon: Calendar, color: "text-blue-600 bg-blue-100" },
    { label: "Salidas hoy", value: departures.length, icon: Users, color: "text-orange-600 bg-orange-100" },
    { label: "Disponibles", value: "-", icon: BedDouble, color: "text-green-600 bg-green-100" },
    { label: "Ingresos hoy", value: formatCurrency(0), icon: DollarSign, color: "text-purple-600 bg-purple-100" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500">{today}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Llegadas del Día</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : arrivals.length === 0 ? (
              <p className="text-gray-500">No hay llegadas programadas</p>
            ) : (
              <div className="space-y-3">
                {arrivals.map((arr) => (
                  <Link
                    key={arr.id}
                    href={`/reservas`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{arr.huesped_nombre}</p>
                      <p className="text-sm text-gray-500">
                        {arr.adultos} adultos{arr.ninos > 0 ? `, ${arr.ninos} niños` : ""}
                      </p>
                    </div>
                    <Badge {...statusBadge(arr.status)} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Salidas del Día</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : departures.length === 0 ? (
              <p className="text-gray-500">No hay salidas programadas</p>
            ) : (
              <div className="space-y-3">
                {departures.map((dep) => (
                  <Link
                    key={dep.id}
                    href={`/reservas`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{dep.huesped_nombre}</p>
                      <p className="text-sm text-gray-500">Total: {formatCurrency(dep.total)}</p>
                    </div>
                    <Badge {...statusBadge(dep.status)} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
