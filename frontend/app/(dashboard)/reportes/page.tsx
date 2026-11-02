"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, statusBadge } from "@/components/ui/badge"
import { formatCurrency, formatDateShort } from "@/lib/utils"
import { FileSpreadsheet, FileText, CreditCard, Users, TrendingUp, Calendar, AlertCircle, BookOpen, Calculator, BarChart3, ShoppingCart } from "lucide-react"
import { ErrorToast } from "@/components/ui/error-toast"

type ReporteActivo = "ocupacion" | "ingresos" | "cuentas-cobrar" | "ingresos-detallado" | "libro-huespedes" | "conciliacion-caja" | "ventas"

const REPORTES: { key: ReporteActivo; label: string; icon: any; desc: string }[] = [
  { key: "ocupacion", label: "Ocupación", icon: Calendar, desc: "Ocupación diaria, % y habitaciones disponibles" },
  { key: "ingresos", label: "Ingresos", icon: CreditCard, desc: "Resumen de ingresos, cargos, pagos e impuestos" },
  { key: "cuentas-cobrar", label: "Ctas. por Cobrar", icon: AlertCircle, desc: "Aging de saldos pendientes por tramo de vencimiento" },
  { key: "ingresos-detallado", label: "Ingresos Detallado", icon: CreditCard, desc: "Ingresos por canal (Walk-in, OTA, etc.) y tipo habitación" },
  { key: "libro-huespedes", label: "Libro Huéspedes", icon: BookOpen, desc: "Registro legal numerado de huéspedes (cumplimiento)" },
  { key: "conciliacion-caja", label: "Conciliación Caja", icon: Calculator, desc: "Arqueos, diferencias y estado por sesión de caja" },
  { key: "ventas", label: "Ventas", icon: ShoppingCart, desc: "Ventas particulares y consumos cargados a habitaciones" },
]

export default function ReportesPage() {
  const today = new Date().toISOString().split("T")[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const [reporteActivo, setReporteActivo] = useState<ReporteActivo>("ocupacion")
  const [startDate, setStartDate] = useState(weekAgo)
  const [endDate, setEndDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")

  // Datos por reporte
  const [occupancy, setOccupancy] = useState<any[]>([])
  const [revenue, setRevenue] = useState<any | null>(null)
  const [cuentasCobrar, setCuentasCobrar] = useState<any | null>(null)
  const [ingresosDetallado, setIngresosDetallado] = useState<any | null>(null)
  const [libroHuespedes, setLibroHuespedes] = useState<any | null>(null)
  const [conciliacionCaja, setConciliacionCaja] = useState<any | null>(null)
  const [ventas, setVentas] = useState<any | null>(null)

  async function loadReports() {
    setLoading(true)
    setError("")
    try {
      switch (reporteActivo) {
        case "ocupacion": {
          const occ = await api.reportes.ocupacion(startDate, endDate)
          setOccupancy(occ)
          break
        }
        case "ingresos": {
          const rev = await api.reportes.ingresos(startDate, endDate)
          setRevenue(rev)
          break
        }
        case "cuentas-cobrar": {
          const cc = await api.reportes.cuentasPorCobrar(endDate)
          setCuentasCobrar(cc)
          break
        }
        case "ingresos-detallado": {
          const id = await api.reportes.ingresosDetallado(startDate, endDate)
          setIngresosDetallado(id)
          break
        }
        case "libro-huespedes": {
          const lh = await api.reportes.libroHuespedes(startDate, endDate)
          setLibroHuespedes(lh)
          break
        }
        case "conciliacion-caja": {
          const cc = await api.reportes.conciliacionCaja(startDate, endDate)
          setConciliacionCaja(cc)
          break
        }
        case "ventas": {
          const v = await api.reportes.ventas(startDate, endDate)
          setVentas(v)
          break
        }
      }
    } catch (err: any) {
      setError(err.message || "Error al cargar reportes")
    } finally {
      setLoading(false)
    }
  }

  async function exportar(tipo: string, formato: "xlsx" | "pdf") {
    setExporting(true)
    setError("")
    try {
      const blob = await api.reportes.exportar(tipo, formato, startDate, endDate)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${tipo}_${startDate}_a_${endDate}.${formato === "xlsx" ? "xlsx" : "pdf"}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message || "Error al exportar")
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => { loadReports() }, [reporteActivo, startDate, endDate])

  const exportTipos: Record<ReporteActivo, string> = {
    ocupacion: "ocupacion",
    ingresos: "ingresos",
    "cuentas-cobrar": "cuentas-por-cobrar",
    "ingresos-detallado": "ingresos-detallado",
    "libro-huespedes": "libro-huespedes",
    "conciliacion-caja": "conciliacion-caja",
    ventas: "ventas",
  }

  const necesitaRango = ["ocupacion", "ingresos", "ingresos-detallado", "libro-huespedes", "conciliacion-caja", "ventas"].includes(reporteActivo)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <div className="flex gap-2">
          {REPORTES.map((r) => (
            <Button
              key={r.key}
              variant={reporteActivo === r.key ? "default" : "outline"}
              className="flex-1 sm:flex-none gap-2"
              onClick={() => { setReporteActivo(r.key); setError("") }}
            >
              <r.icon className="h-4 w-4" /> {r.label}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500">{REPORTES.find(r => r.key === reporteActivo)?.desc}</p>

      <ErrorToast message={error} onClose={() => setError("")} />

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            {necesitaRango ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Desde</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hasta</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </>
            ) : reporteActivo === "cuentas-cobrar" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha / Al día</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            ) : null}
            <Button onClick={loadReports} disabled={loading} className="self-end">
              {loading ? "Cargando..." : "Actualizar"}
            </Button>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => exportar(exportTipos[reporteActivo], "xlsx")} disabled={exporting || loading}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" onClick={() => exportar(exportTipos[reporteActivo], "pdf")} disabled={exporting || loading}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {reporteActivo === "ocupacion" && <ReporteOcupacionView data={occupancy} loading={loading} />}
      {reporteActivo === "ingresos" && <ReporteIngresosView data={revenue} loading={loading} />}
      {reporteActivo === "cuentas-cobrar" && <ReporteCuentasCobrarView data={cuentasCobrar} loading={loading} />}
      {reporteActivo === "ingresos-detallado" && <ReporteIngresosDetalladoView data={ingresosDetallado} loading={loading} />}
      {reporteActivo === "libro-huespedes" && <ReporteLibroHuespedesView data={libroHuespedes} loading={loading} />}
      {reporteActivo === "conciliacion-caja" && <ReporteConciliacionCajaView data={conciliacionCaja} loading={loading} />}
      {reporteActivo === "ventas" && <ReporteVentasView data={ventas} loading={loading} />}
    </div>
  )
}

function ReporteOcupacionView({ data, loading }: { data: any[]; loading: boolean }) {
  const avgOccupancy = data.length > 0
    ? data.reduce((sum, o) => sum + o.porcentaje_ocupacion, 0) / data.length
    : 0

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-gray-500">Ocupación Promedio</p>
          <p className="text-2xl font-bold">{avgOccupancy.toFixed(1)}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Ocupación Diaria</CardTitle></CardHeader>
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
                  {data.map((o) => (
                    <tr key={o.fecha} className="border-b">
                      <td className="p-2">{formatDateShort(o.fecha)}</td>
                      <td className="text-right p-2">{o.total_habitaciones}</td>
                      <td className="text-right p-2">{o.habitaciones_ocupadas}</td>
                      <td className="text-right p-2">{o.habitaciones_disponibles}</td>
                      <td className="text-right p-2">{o.porcentaje_ocupacion}%</td>
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

function ReporteIngresosView({ data, loading }: { data: any | null; loading: boolean }) {
  const totalRevenue = data?.total_ingresos || 0
  const totalPayments = data?.total_pagos || 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Ingresos Totales</p><p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Cargos</p><p className="text-2xl font-bold">{formatCurrency(data?.total_cargos || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Pagos Recibidos</p><p className="text-2xl font-bold">{formatCurrency(totalPayments)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Resumen Ingresos</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Período</th>
                    <th className="text-right p-2">Ingresos</th>
                    <th className="text-right p-2">Cargos</th>
                    <th className="text-right p-2">Pagos</th>
                    <th className="text-right p-2">Descuentos</th>
                    <th className="text-right p-2">Impuestos</th>
                  </tr>
                </thead>
                <tbody>
                  {data && (
                    <tr className="border-b">
                      <td className="p-2">{formatDateShort(data.desde)} - {formatDateShort(data.hasta)}</td>
                      <td className="text-right p-2">{formatCurrency(data.total_ingresos)}</td>
                      <td className="text-right p-2">{formatCurrency(data.total_cargos)}</td>
                      <td className="text-right p-2">{formatCurrency(data.total_pagos)}</td>
                      <td className="text-right p-2">{formatCurrency(data.descuentos_aplicados)}</td>
                      <td className="text-right p-2">{formatCurrency(data.impuestos_recaudados)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReporteCuentasCobrarView({ data, loading }: { data: any | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Saldo Total Pendiente</p><p className="text-2xl font-bold text-red-600">{formatCurrency(data.total_saldo)}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">0-30 días</p><p className="text-2xl font-bold">{formatCurrency(data.por_tramo["0-30"] || 0)}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">31-60 días</p><p className="text-2xl font-bold">{formatCurrency(data.por_tramo["31-60"] || 0)}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">61-90 / 90+</p><p className="text-2xl font-bold">{formatCurrency((data.por_tramo["61-90"] || 0) + (data.por_tramo["90+"] || 0))}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Detalle Cuentas por Cobrar</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Confirmación</th>
                    <th className="text-left p-2">Huésped</th>
                    <th className="text-right p-2">Entrada</th>
                    <th className="text-right p-2">Salida</th>
                    <th className="text-right p-2">Total Reserva</th>
                    <th className="text-right p-2">Pagado</th>
                    <th className="text-right p-2">Saldo</th>
                    <th className="text-right p-2">Días Venc.</th>
                    <th className="text-right p-2">Tramo</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.items || []).map((item: any) => (
                    <tr key={item.reserva_id} className={`border-b ${item.tramo === "90+" ? "bg-red-50" : item.tramo === "61-90" ? "bg-orange-50" : ""}`}>
                      <td className="p-2">{item.codigo_confirmacion}</td>
                      <td className="p-2">{item.huesped}</td>
                      <td className="p-2">{formatDateShort(item.fecha_entrada)}</td>
                      <td className="p-2">{formatDateShort(item.fecha_salida)}</td>
                      <td className="text-right p-2">{formatCurrency(item.total_reserva)}</td>
                      <td className="text-right p-2">{formatCurrency(item.pagado)}</td>
                      <td className="text-right p-2 font-medium text-red-600">{formatCurrency(item.saldo)}</td>
                      <td className="text-right p-2">{item.dias_vencido}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.tramo === "90+" ? "bg-red-100 text-red-700" :
                          item.tramo === "61-90" ? "bg-orange-100 text-orange-700" :
                          item.tramo === "31-60" ? "bg-yellow-100 text-yellow-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {item.tramo}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">Sin saldos pendientes</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReporteHousekeepingView({ data, loading }: { data: any | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Total Tareas</p><p className="text-2xl font-bold">{data.total_tareas}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Completadas</p><p className="text-2xl font-bold text-green-600">{data.completadas}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">En Progreso</p><p className="text-2xl font-bold text-blue-600">{data.en_progreso}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Pendientes</p><p className="text-2xl font-bold text-yellow-600">{data.pendientes}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Inspecciones Fallidas</p><p className="text-2xl font-bold text-red-600">{data.inspecciones_fallidas}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Productividad por Camarera</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Camarera</th>
                    <th className="text-right p-2">Asignadas</th>
                    <th className="text-right p-2">Completadas</th>
                    <th className="text-right p-2">Pendientes</th>
                    <th className="text-right p-2">En Progreso</th>
                    <th className="text-right p-2">% Completado</th>
                    <th className="text-right p-2">Tiempo Prom. (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.productividad_por_camarera || []).map((c: any) => (
                    <tr key={c.camarera_id} className="border-b">
                      <td className="p-2">{c.camarera_nombre}</td>
                      <td className="text-right p-2">{c.tareas_asignadas}</td>
                      <td className="text-right p-2">{c.tareas_completadas}</td>
                      <td className="text-right p-2">{c.tareas_pendientes}</td>
                      <td className="text-right p-2">{c.tareas_en_progreso}</td>
                      <td className="text-right p-2">{c.porcentaje_completado}%</td>
                      <td className="text-right p-2">{c.tiempo_promedio_minutos ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">Sin datos para esta fecha</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReporteIngresosDetalladoView({ data, loading }: { data: any | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      {data && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Ingresos por Canal</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Canal</th>
                    <th className="text-right p-2">Reservas</th>
                    <th className="text-right p-2">Ingresos</th>
                    <th className="text-right p-2">ADR</th>
                    <th className="text-right p-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.por_canal || []).map((c: any) => (
                    <tr key={c.canal} className="border-b">
                      <td className="p-2">{c.canal}</td>
                      <td className="text-right p-2">{c.reservas}</td>
                      <td className="text-right p-2">{formatCurrency(c.ingresos)}</td>
                      <td className="text-right p-2">{formatCurrency(c.adr)}</td>
                      <td className="text-right p-2">{c.porcentaje}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Ingresos por Tipo de Habitación</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Tipo Habitación</th>
                    <th className="text-right p-2">Reservas</th>
                    <th className="text-right p-2">Ingresos</th>
                    <th className="text-right p-2">ADR</th>
                    <th className="text-right p-2">% Ocup.</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.por_tipo_habitacion || []).map((t: any) => (
                    <tr key={t.tipo_habitacion} className="border-b">
                      <td className="p-2">{t.tipo_habitacion}</td>
                      <td className="text-right p-2">{t.reservas}</td>
                      <td className="text-right p-2">{formatCurrency(t.ingresos)}</td>
                      <td className="text-right p-2">{formatCurrency(t.adr)}</td>
                      <td className="text-right p-2">{t.ocupacion_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ReporteForecastView({ data, loading }: { data: any | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Forecast Ocupación e Ingresos</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-right p-2">% Ocup. Est.</th>
                    <th className="text-right p-2">Ing. Est.</th>
                    <th className="text-right p-2">Hab. Est.</th>
                  </tr>
                </thead>
<tbody>
                    {(data.items || []).map((f: any) => (
                      <tr key={f.fecha} className="border-b">
                        <td className="p-2">{formatDateShort(f.fecha)}</td>
                        <td className="text-right p-2">{f.ocupacion_estimada_pct}%</td>
                        <td className="text-right p-2">{formatCurrency(f.ingresos_estimados)}</td>
                        <td className="text-right p-2">{f.habitaciones_ocupadas_estimadas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">Sin datos</p>
            )}
          </CardContent>
        </Card>
      </div>
  )
}

function ReporteLibroHuespedesView({ data, loading }: { data: any | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      {data && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Libro de Huéspedes</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Nº Reg.</th>
                    <th className="text-left p-2">Fecha Reg.</th>
                    <th className="text-left p-2">Confirmación</th>
                    <th className="text-left p-2">Huésped</th>
                    <th className="text-left p-2">Documento</th>
                    <th className="text-left p-2">Nacionalidad</th>
                    <th className="text-left p-2">Entrada</th>
                    <th className="text-left p-2">Salida</th>
                    <th className="text-left p-2">Hab.</th>
                    <th className="text-right p-2">Ad.</th>
                    <th className="text-right p-2">Niños</th>
                    <th className="text-left p-2">Estado</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.items || []).map((item: any) => (
                    <tr key={item.numero_registro} className="border-b">
                      <td className="p-2">{item.numero_registro}</td>
                      <td className="p-2">{formatDateShort(item.fecha_registro)}</td>
                      <td className="p-2">{item.codigo_confirmacion}</td>
                      <td className="p-2">{item.huesped_nombre}</td>
                      <td className="p-2">{item.huesped_documento || "-"}</td>
                      <td className="p-2">{item.huesped_nacionalidad || "-"}</td>
                      <td className="p-2">{formatDateShort(item.fecha_entrada)}</td>
                      <td className="p-2">{formatDateShort(item.fecha_salida)}</td>
                      <td className="p-2">{item.habitacion}</td>
                      <td className="text-right p-2">{item.adultos}</td>
                      <td className="text-right p-2">{item.ninos}</td>
                      <td className="p-2">{item.estado}</td>
                      <td className="text-right p-2">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ReporteVentasView({ data, loading }: { data: any | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      {loading && <p className="text-gray-500">Cargando reporte...</p>}
      {data && <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Ventas totales</p><p className="text-2xl font-bold">{formatCurrency(data.total_ventas)}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Clientes particulares</p><p className="text-2xl font-bold text-blue-700">{formatCurrency(data.total_particulares)}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Consumos habitación</p><p className="text-2xl font-bold text-green-700">{formatCurrency(data.total_consumos)}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Movimientos</p><p className="text-2xl font-bold">{data.items?.length || 0}</p></CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle className="text-lg">Detalle de ventas</CardTitle></CardHeader><CardContent>
          {(data.items || []).length === 0 ? <p className="text-gray-500">No hay ventas en el período.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b bg-gray-50"><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Tipo</th><th className="p-3 text-left">Cliente</th><th className="p-3 text-left">Habitación</th><th className="p-3 text-left">Producto</th><th className="p-3 text-right">Cant.</th><th className="p-3 text-left">Pago</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{data.items.map((item: any, index: number) => <tr key={`${item.fecha}-${item.producto}-${index}`} className="border-b"><td className="p-3">{formatDateShort(item.fecha)}</td><td className="p-3">{item.tipo}</td><td className="p-3">{item.cliente}</td><td className="p-3">{item.habitacion}</td><td className="p-3">{item.producto}</td><td className="p-3 text-right">{item.cantidad}</td><td className="p-3">{item.metodo_pago}</td><td className="p-3 text-right font-medium">{formatCurrency(item.total)}</td></tr>)}</tbody></table></div>}
        </CardContent></Card>
      </>}
    </div>
  )
}

function ReporteConciliacionCajaView({ data, loading }: { data: any | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Total Sesiones</p><p className="text-2xl font-bold">{data.total_sesiones}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Cuadradas</p><p className="text-2xl font-bold text-green-600">{data.sesiones_cuadradas}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Con Diferencia</p><p className="text-2xl font-bold text-red-600">{data.sesiones_con_diferencia}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Total Diferencias</p><p className="text-2xl font-bold">{formatCurrency(data.total_diferencias)}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Detalle Sesiones</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-left p-2">Cajero</th>
                    <th className="text-right p-2">Apertura</th>
                    <th className="text-right p-2">Esperado</th>
                    <th className="text-right p-2">Declarado</th>
                    <th className="text-right p-2">Diferencia</th>
                    <th className="text-left p-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.items || []).map((item: any) => (
                    <tr key={item.sesion_id} className={`border-b ${Math.abs(item.diferencia) < 0.01 ? "" : "bg-red-50"}`}>
                      <td className="p-2">{formatDateShort(item.fecha)}</td>
                      <td className="p-2">{item.cajero}</td>
                      <td className="text-right p-2">{formatCurrency(item.monto_apertura)}</td>
                      <td className="text-right p-2">{formatCurrency(item.monto_esperado)}</td>
                      <td className="text-right p-2">{formatCurrency(item.monto_declarado)}</td>
                      <td className={`text-right p-2 font-medium ${Math.abs(item.diferencia) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(item.diferencia)}
                      </td>
                      <td className="p-2">
                        <Badge {...statusBadge(item.estado === "ABIERTA" ? "ABIERTA" : "CERRADA")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">Sin sesiones en el período</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReporteEjecutivoView({ data, loading }: { data: any | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">RevPAR</p><p className="text-2xl font-bold">{formatCurrency(data.resumen.revpar)}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">ADR</p><p className="text-2xl font-bold">{formatCurrency(data.resumen.adr)}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Ocupación</p><p className="text-2xl font-bold">{data.resumen.ocupacion_pct}%</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">GOPPAR (est.)</p><p className="text-2xl font-bold">{formatCurrency(data.resumen.goppar || 0)}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Ingresos Totales</p><p className="text-2xl font-bold">{formatCurrency(data.resumen.ingresos_totales)}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Hab. Vendidas</p><p className="text-2xl font-bold">{data.resumen.habitaciones_vendidas}</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Est. Media</p><p className="text-2xl font-bold">{data.resumen.estancia_media} noches</p></CardContent></Card>
          <Card><CardContent className="p-6"><p className="text-sm text-gray-500">Ing./Huésped</p><p className="text-2xl font-bold">{formatCurrency(data.resumen.ingresos_por_huesped)}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">KPIs por Período</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Período</th>
                    <th className="text-right p-2">RevPAR</th>
                    <th className="text-right p-2">ADR</th>
                    <th className="text-right p-2">% Ocup.</th>
                    <th className="text-right p-2">GOPPAR</th>
                    <th className="text-right p-2">Ing. Totales</th>
                    <th className="text-right p-2">Hab. Vendidas</th>
                    <th className="text-right p-2">Huéspedes</th>
                    <th className="text-right p-2">Est. Media</th>
                    <th className="text-right p-2">Ing./Huésped</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.kpis || []).map((kpi: any) => (
                    <tr key={kpi.periodo} className="border-b">
                      <td className="p-2">{kpi.periodo}</td>
                      <td className="text-right p-2">{formatCurrency(kpi.revpar)}</td>
                      <td className="text-right p-2">{formatCurrency(kpi.adr)}</td>
                      <td className="text-right p-2">{kpi.ocupacion_pct}%</td>
                      <td className="text-right p-2">{formatCurrency(kpi.goppar || 0)}</td>
                      <td className="text-right p-2">{formatCurrency(kpi.ingresos_totales)}</td>
                      <td className="text-right p-2">{kpi.habitaciones_vendidas}</td>
                      <td className="text-right p-2">{kpi.total_huespedes}</td>
                      <td className="text-right p-2">{kpi.estancia_media} noches</td>
                      <td className="text-right p-2">{formatCurrency(kpi.ingresos_por_huesped)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">Sin datos</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}