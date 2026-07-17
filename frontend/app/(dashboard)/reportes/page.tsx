"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { BarChart3 } from "lucide-react"

export default function ReportesPage() {
  const today = new Date().toISOString().split("T")[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const [startDate, setStartDate] = useState(weekAgo)
  const [endDate, setEndDate] = useState(today)
  const [occupancy, setOccupancy] = useState<any[]>([])
  const [revenue, setRevenue] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function loadReports() {
    setLoading(true)
    const [occ, rev] = await Promise.all([
      api.reportes.ocupacion(startDate, endDate),
      api.reportes.ingresos(startDate, endDate),
    ])
    setOccupancy(occ)
    setRevenue(rev)
    setLoading(false)
  }

  useEffect(() => { loadReports() }, [])

  const totalRevenue = revenue.reduce((sum, r) => sum + r.ingresos_totales, 0)
  const totalPayments = revenue.reduce((sum, r) => sum + r.pagos, 0)
  const avgOccupancy = occupancy.length > 0
    ? occupancy.reduce((sum, o) => sum + o.tasa_ocupacion, 0) / occupancy.length
    : 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Desde</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Hasta</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button onClick={loadReports} disabled={loading}>
              {loading ? "Cargando..." : "Actualizar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Ocupación Promedio</p>
            <p className="text-2xl font-bold">{avgOccupancy.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Ingresos Totales</p>
            <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Pagos Recibidos</p>
            <p className="text-2xl font-bold">{formatCurrency(totalPayments)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Ocupación</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Fecha</th>
                      <th className="text-right p-2">Total</th>
                      <th className="text-right p-2">Ocupadas</th>
                      <th className="text-right p-2">Disponibles</th>
                      <th className="text-right p-2">% Ocup.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occupancy.map((o) => (
                      <tr key={o.date} className="border-b">
                        <td className="p-2">{formatDateShort(o.fecha)}</td>
                        <td className="text-right p-2">{o.total_habitaciones}</td>
                        <td className="text-right p-2">{o.habitaciones_ocupadas}</td>
                        <td className="text-right p-2">{o.habitaciones_disponibles}</td>
                        <td className="text-right p-2">{o.tasa_ocupacion}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Ingresos</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Fecha</th>
                      <th className="text-right p-2">Habitaciones</th>
                      <th className="text-right p-2">Extra</th>
                      <th className="text-right p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.map((r) => (
                      <tr key={r.date} className="border-b">
                        <td className="p-2">{formatDateShort(r.fecha)}</td>
                        <td className="text-right p-2">{formatCurrency(r.ingresos_habitaciones)}</td>
                        <td className="text-right p-2">{formatCurrency(r.cargos_extra)}</td>
                        <td className="text-right p-2">{formatCurrency(r.ingresos_totales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
