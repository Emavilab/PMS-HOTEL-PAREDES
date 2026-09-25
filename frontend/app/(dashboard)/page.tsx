"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, statusBadge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { api } from "@/lib/api"
import { Calendar, Users, BedDouble, DollarSign, ArrowRight, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"

type OperacionDia = {
  id: string
  huesped: string
  codigo_confirmacion: string
  fecha_entrada: string
  fecha_salida: string
  habitacion: string | null
  estado: string
  adultos?: number
  ninos?: number
  total?: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [arrivals, setArrivals] = useState<OperacionDia[]>([])
  const [departures, setDepartures] = useState<OperacionDia[]>([])
  const [availableRooms, setAvailableRooms] = useState(0)
  const [todayIncome, setTodayIncome] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const today = new Date().toLocaleDateString("es-HN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })

  useEffect(() => {
    const date = new Date().toISOString().slice(0, 10)
    Promise.all([
      api.reportes.llegadas(),
      api.reportes.salidas(),
      api.habitaciones.listar(),
      api.reportes.ingresos(date, date),
    ]).then(([arr, dep, rooms, income]) => {
      setArrivals(arr)
      setDepartures(dep)
      setAvailableRooms(rooms.filter((room: any) => room.estado_operativo === "DISPONIBLE").length)
      setTodayIncome(Number(income.total_pagos || 0))
    }).catch((err: Error) => setError(err.message || "No se pudo cargar el dashboard")).finally(() => setLoading(false))
  }, [])

  const stats = [
    { label: "Llegadas hoy", value: arrivals.length, icon: Calendar, color: "text-blue-600 bg-blue-100" },
    { label: "Salidas hoy", value: departures.length, icon: Users, color: "text-orange-600 bg-orange-100" },
    { label: "Habitaciones disponibles", value: availableRooms, icon: BedDouble, color: "text-green-600 bg-green-100" },
    { label: "Cobros de hoy", value: formatCurrency(todayIncome), icon: DollarSign, color: "text-purple-600 bg-purple-100" },
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

      {error && <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded border border-red-200 bg-white px-3 py-1.5 hover:bg-red-100"><RefreshCw className="h-4 w-4" /> Reintentar</button></div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/recepcion" className="flex items-center justify-between rounded-md border bg-white p-4 text-sm font-medium hover:border-blue-300 hover:bg-blue-50"><span>Ir a recepción</span><ArrowRight className="h-4 w-4" /></Link>
        <Link href="/housekeeping" className="flex items-center justify-between rounded-md border bg-white p-4 text-sm font-medium hover:border-blue-300 hover:bg-blue-50"><span>Revisar limpieza</span><ArrowRight className="h-4 w-4" /></Link>
        {(user?.rol === "admin" || user?.rol === "gerente") && <Link href="/caja" className="flex items-center justify-between rounded-md border bg-white p-4 text-sm font-medium hover:border-blue-300 hover:bg-blue-50"><span>Gestionar caja</span><ArrowRight className="h-4 w-4" /></Link>}
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
                      <p className="font-medium">{arr.huesped}</p>
                      <p className="text-sm text-gray-500">
                        Habitación {arr.habitacion || "sin asignar"} · Entrada {arr.fecha_entrada}
                      </p>
                    </div>
                    <Badge {...statusBadge(arr.estado)} />
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
                      <p className="font-medium">{dep.huesped}</p>
                      <p className="text-sm text-gray-500">Total: {formatCurrency(dep.total ?? 0)}</p>
                    </div>
                    <Badge {...statusBadge(dep.estado)} />
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
