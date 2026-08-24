"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { FileText, Printer, Receipt } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function FacturacionPage() {
  const [vista, setVista] = useState<"folio" | "facturas">("folio")
  const [reservations, setReservations] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [folio, setFolio] = useState<any>(null)
  const [facturas, setFacturas] = useState<any[]>([])
  const [facturaSel, setFacturaSel] = useState<any | null>(null)
  const [hotelConfig, setHotelConfig] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.configuracion.obtener().then(setHotelConfig).catch(() => {})
    api.reservas.listar({ estado: "CHECKED_IN", per_page: "200" }).then((data) => {
      setReservations(data.items || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function loadFacturas() {
    api.facturas.listar().then(setFacturas).catch(() => {})
  }

  useEffect(() => {
    if (vista === "facturas") {
      setFacturaSel(null)
      loadFacturas()
    }
  }, [vista])

  async function loadFolio() {
    if (!selectedId) return
    const f = await api.facturacion.obtenerFolio(selectedId)
    setFolio(f)
  }

  useEffect(() => { if (selectedId) loadFolio() }, [selectedId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Facturación</h1>
        <div className="flex gap-2 rounded-md bg-gray-100 p-1 text-sm font-medium">
          <button
            className={`rounded-md px-4 py-2 ${vista === "folio" ? "bg-white text-blue-700 shadow" : "text-gray-600"}`}
            onClick={() => setVista("folio")}
          >Folio de reservas</button>
          <button
            className={`flex items-center gap-2 rounded-md px-4 py-2 ${vista === "facturas" ? "bg-white text-blue-700 shadow" : "text-gray-600"}`}
            onClick={() => setVista("facturas")}
          ><FileText className="h-4 w-4" /> Facturas emitidas</button>
        </div>
      </div>

      {vista === "facturas" && facturaSel ? (
        <Card className="print-invoice overflow-hidden bg-white">
          <CardHeader className="border-b">
            <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={() => setFacturaSel(null)}>Volver</Button>
              <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir factura
              </Button>
            </div>
            <div className="hidden print:block">
              <FacturaEncabezado config={hotelConfig} factura={facturaSel} apiUrl={API_URL} />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <FacturaCuerpo factura={facturaSel} />
          </CardContent>
        </Card>
      ) : vista === "facturas" ? (
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" /> Facturas emitidas</CardTitle></CardHeader>
          <CardContent>
            {facturas.length === 0 ? (
              <p className="text-sm text-gray-500">No hay facturas emitidas. Se generan automaticamente al culminar una salida.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-3 text-left text-sm font-medium text-gray-500">Numero</th>
                      <th className="p-3 text-left text-sm font-medium text-gray-500">Huesped</th>
                      <th className="p-3 text-left text-sm font-medium text-gray-500">Habitacion</th>
                      <th className="p-3 text-left text-sm font-medium text-gray-500">Fecha</th>
                      <th className="p-3 text-right text-sm font-medium text-gray-500">Total</th>
                      <th className="p-3 text-right text-sm font-medium text-gray-500">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((f) => (
                      <tr key={f.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{f.numero}</td>
                        <td className="p-3">{f.datos?.huesped_nombre || "-"}</td>
                        <td className="p-3">{f.datos?.habitacion_numero || "-"}</td>
                        <td className="p-3">{f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString("es-HN") : "-"}</td>
                        <td className="p-3 text-right">{formatCurrency(f.datos?.resumen?.total_factura || 0)}</td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => setFacturaSel(f.datos)}>Ver</Button>
                            <Button size="sm" variant="outline" onClick={() => { setFacturaSel(f.datos); setTimeout(() => window.print(), 300) }}>
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-lg">Reservas Activas</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-gray-500">Cargando...</p>
              ) : reservations.length === 0 ? (
                <p className="text-gray-500">No hay reservas activas</p>
              ) : (
                <div className="space-y-2">
                  {reservations.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        selectedId === r.id ? "bg-blue-50 text-blue-700" : "bg-gray-50 hover:bg-gray-100"
                      }`}
                    >
                      <p className="font-medium">{r.huesped_nombre}</p>
                      <p className="text-sm text-gray-500">{r.codigo_confirmacion}</p>
                      <p className="text-sm font-medium">{formatCurrency(r.total)}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5" /> Folio
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedId ? (
                <p className="text-gray-500">Seleccione una reserva para ver su folio</p>
              ) : !folio ? (
                <p className="text-gray-500">Cargando...</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Código</p>
                      <p className="font-medium">{folio.codigo_confirmacion}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Huésped</p>
                      <p className="font-medium">{folio.huesped_nombre}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Entrada</p>
                      <p className="font-medium">{folio.fecha_entrada}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Salida</p>
                      <p className="font-medium">{folio.fecha_salida}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Cargos</h3>
                    {folio.cargos.length === 0 ? (
                      <p className="text-sm text-gray-500">Sin cargos adicionales</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Descripción</th>
                            <th className="text-right p-2">Cant.</th>
                            <th className="text-right p-2">P/U</th>
                            <th className="text-right p-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {folio.cargos.map((c: any) => (
                            <tr key={c.id} className="border-b">
                              <td className="p-2">{c.descripcion}</td>
                              <td className="text-right p-2">{c.cantidad}</td>
                              <td className="text-right p-2">{formatCurrency(c.precio_unitario)}</td>
                              <td className="text-right p-2">{formatCurrency(c.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Pagos</h3>
                    {folio.pagos.length === 0 ? (
                      <p className="text-sm text-gray-500">Sin pagos registrados</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Método</th>
                            <th className="text-left p-2">Referencia</th>
                            <th className="text-right p-2">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {folio.pagos.map((p: any) => (
                            <tr key={p.id} className="border-b">
                              <td className="p-2">{p.metodo_pago}</td>
                              <td className="p-2">{p.referencia || "-"}</td>
                              <td className="text-right p-2">{formatCurrency(p.monto)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(folio.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Descuento</span>
                      <span>{formatCurrency(folio.descuento)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Impuesto</span>
                      <span>{formatCurrency(folio.impuesto)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{formatCurrency(folio.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Pagado</span>
                      <span>{formatCurrency(folio.pagado)}</span>
                    </div>
                    <div className="flex justify-between font-medium text-red-600">
                      <span>Saldo Pendiente</span>
                      <span>{formatCurrency(folio.saldo)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function FacturaEncabezado({ config, factura, apiUrl }: { config: any | null; factura: any; apiUrl: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          {config?.logo_url && <img src={`${apiUrl}${config.logo_url}`} alt={config?.nombre || "Hotel"} className="h-16 w-16 object-contain" />}
          <div>
            <h2 className="text-xl font-bold uppercase">{config?.nombre || "Hotel Paredes"}</h2>
            {config?.rtn && <p className="text-sm">RTN: {config.rtn}</p>}
            {config?.direccion && <p className="text-sm">{config.direccion}</p>}
            <p className="text-sm">{[config?.telefono, config?.email].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">FACTURA</p>
          <p className="text-sm">No. {factura.numero}</p>
          <p className="text-sm">Fecha: {new Date(factura.fecha).toLocaleDateString("es-HN")}</p>
        </div>
      </div>
    </div>
  )
}

function FacturaCuerpo({ factura }: { factura: any }) {
  const resumen = factura.resumen || {}
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-md bg-gray-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-2 print:bg-white print:p-0">
        <div><p className="text-gray-500 print:text-gray-700">Huesped</p><p className="font-medium">{factura.huesped_nombre}</p></div>
        <div><p className="text-gray-500 print:text-gray-700">Documento</p><p className="font-medium">{factura.huesped_documento || "-"}</p></div>
        <div><p className="text-gray-500 print:text-gray-700">Habitacion</p><p className="font-medium">{factura.habitacion_numero} · {factura.habitacion_tipo || "Sin tipo"}</p></div>
        <div><p className="text-gray-500 print:text-gray-700">Estadia</p><p className="font-medium">{factura.fecha_entrada} a {factura.fecha_salida}</p></div>
      </div>

      <div className="overflow-x-auto rounded-md border print:overflow-visible">
        <table className="w-full min-w-[680px] text-sm print:min-w-0 print:text-[11px]">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-3 text-left font-medium text-gray-500">Descripcion</th>
              <th className="p-3 text-right font-medium text-gray-500">Cant.</th>
              <th className="p-3 text-right font-medium text-gray-500">P. Unitario</th>
              <th className="p-3 text-right font-medium text-gray-500">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(factura.items || []).map((item: any, index: number) => (
              <tr key={`${item.descripcion}-${index}`} className="border-b last:border-0">
                <td className="p-3">{item.descripcion}</td>
                <td className="p-3 text-right">{item.cantidad}</td>
                <td className="p-3 text-right">{formatCurrency(item.precio_unitario)}</td>
                <td className="p-3 text-right font-medium">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 print:block">
        <div className="no-print rounded-md border p-4 text-sm">
          <p className="mb-2 font-medium">Pagos registrados</p>
          {(factura.pagos || []).length === 0 ? (
            <p className="text-gray-500">Sin pagos registrados.</p>
          ) : (
            <div className="space-y-2">
              {factura.pagos.map((pago: any) => (
                <div key={pago.id} className="flex justify-between gap-3">
                  <span>{pago.metodo_pago} · {pago.referencia || "Sin referencia"}</span>
                  <span className="font-medium">{formatCurrency(pago.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-md border p-4 text-sm print:ml-auto print:mt-4 print:w-72">
          <div className="flex justify-between"><span>Subtotal hospedaje</span><span>{formatCurrency(resumen.subtotal_habitacion)}</span></div>
          {resumen.descuento > 0 && <div className="flex justify-between"><span>Descuento</span><span>-{formatCurrency(resumen.descuento)}</span></div>}
          <div className="flex justify-between"><span>Impuesto</span><span>{formatCurrency(resumen.impuesto)}</span></div>
          {resumen.total_consumos > 0 && <div className="flex justify-between"><span>Consumos</span><span>{formatCurrency(resumen.total_consumos)}</span></div>}
          {resumen.mora_penalidad > 0 && <div className="flex justify-between text-red-600"><span>Mora/Penalidad</span><span>{formatCurrency(resumen.mora_penalidad)}</span></div>}
          <div className="mt-3 border-t pt-3 flex justify-between text-base font-bold"><span>Total factura</span><span>{formatCurrency(resumen.total_factura)}</span></div>
          <div className="no-print flex justify-between font-medium text-blue-700"><span>Cobrado al culminar salida</span><span>{formatCurrency(resumen.total_cobrado_checkout)}</span></div>
        </div>
      </div>

      <div className="hidden pt-10 text-center text-xs text-gray-500 print:block">
        <p>Gracias por su preferencia.</p>
        <p>Factura generada por el sistema de gestion hotelera.</p>
      </div>
    </div>
  )
}
