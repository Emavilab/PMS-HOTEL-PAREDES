"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge, statusBadge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function VerificarSalidaPage() {
  const [ocupadas, setOcupadas] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [verificacion, setVerificacion] = useState<any | null>(null)
  const [factura, setFactura] = useState<any | null>(null)
  const [hotelConfig, setHotelConfig] = useState<any | null>(null)
  const [metodosPago, setMetodosPago] = useState<any[]>([])
  const [metodoPago, setMetodoPago] = useState("")
  const [efectivoRecibido, setEfectivoRecibido] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [culminando, setCulminando] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const loadData = useCallback(() => {
    setLoading(true)
    api.ventas.ocupadas().then(setOcupadas).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    api.configuracion.obtener().then(setHotelConfig).catch(() => {})
    api.metodosPago.listar().then((metodos) => {
      const activos = metodos.filter((metodo: any) => metodo.activo)
      setMetodosPago(activos)
      setMetodoPago(activos[0]?.nombre || "")
    }).catch((err) => setError(err.message))
  }, [])

  async function selectReserva(reserva: any) {
    setSelected(reserva)
    setError("")
    setSuccess("")
    setFactura(null)
    setEfectivoRecibido("")
    setLoadingDetalle(true)
    try {
      const data = await api.ventas.verificarSalida(reserva.reserva_id)
      setVerificacion(data)
      setMetodoPago((actual) => metodosPago.some((metodo) => metodo.nombre === actual) ? actual : metodosPago[0]?.nombre || "")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingDetalle(false)
    }
  }

  async function handleCulminar() {
    if (!selected) return
    setCulminando(true)
    setError("")
    try {
      const esEfectivo = metodoPago.trim().toLowerCase() === "efectivo"
      const recibido = esEfectivo && efectivoRecibido ? Number(efectivoRecibido) : undefined
      if (esEfectivo && (recibido === undefined || !Number.isFinite(recibido) || recibido < verificacion.total_a_pagar)) {
        throw new Error("El dinero recibido debe cubrir el total a pagar")
      }
      const resultado = await api.ventas.culminarSalida(selected.reserva_id, metodoPago, recibido)
      setFactura(resultado.factura)
      setSuccess("Salida culminada exitosamente. Factura generada.")
      setSelected(null)
      setVerificacion(null)
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCulminando(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Verificar Salida</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Habitaciones Ocupadas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : ocupadas.length === 0 ? (
              <p className="text-gray-500">No hay huéspedes en checkout</p>
            ) : (
              <div className="space-y-2">
                {ocupadas.map((h) => (
                  <div
                    key={h.reserva_id}
                    className={`p-3 rounded-md cursor-pointer ${
                      selected?.reserva_id === h.reserva_id
                        ? "bg-blue-100 border border-blue-300"
                        : "bg-gray-50 hover:bg-gray-100 border border-transparent"
                    }`}
                    onClick={() => selectReserva(h)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Hab. {h.habitacion_numero}</p>
                        <p className="text-sm text-gray-500">{h.huesped}</p>
                      </div>
                      <Badge {...statusBadge("CHECKED_IN")} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalle de Salida</CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-gray-500">Selecciona una habitación ocupada</p>
            ) : loadingDetalle ? (
              <p className="text-gray-500">Cargando detalle...</p>
            ) : !verificacion ? (
              <p className="text-sm text-red-500">Error al cargar datos</p>
            ) : (
              <div className="space-y-4">
                {error && <div className="p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}
                {success && <div className="p-3 text-sm bg-green-50 text-green-600 rounded-md border border-green-200">{success}</div>}

                <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm">
                  <p className="font-semibold">Hab. {verificacion.habitacion_numero} - {verificacion.habitacion_tipo}</p>
                  <p><span className="font-medium">Huésped:</span> {verificacion.huesped_nombre}</p>
                  {verificacion.huesped_documento && <p><span className="font-medium">Doc:</span> {verificacion.huesped_documento}</p>}
                  <p><span className="font-medium">Código:</span> {verificacion.codigo_confirmacion}</p>
                  <p><span className="font-medium">Estadía:</span> {verificacion.fecha_entrada} → {verificacion.fecha_salida} ({verificacion.noches} noche{verificacion.noches !== 1 ? "s" : ""})</p>
                </div>

                <div className="border rounded-md divide-y text-sm">
                  <div className="flex justify-between p-2"><span>Subtotal ({verificacion.noches} noche{verificacion.noches !== 1 ? "s" : ""})</span><span>{formatCurrency(verificacion.subtotal)}</span></div>
                  <div className="flex justify-between p-2"><span>Impuesto ({Number(hotelConfig?.impuesto ?? 15)}%)</span><span>{formatCurrency(verificacion.impuesto)}</span></div>
                  {verificacion.descuento > 0 && <div className="flex justify-between p-2 text-red-600"><span>Descuento</span><span>-{formatCurrency(verificacion.descuento)}</span></div>}
                  <div className="flex justify-between p-2 font-medium"><span>Total habitación</span><span>{formatCurrency(verificacion.total_habitacion)}</span></div>
                </div>

                <div className="border rounded-md divide-y text-sm">
                  <p className="p-2 font-medium">Consumos</p>
                  {verificacion.consumos.length === 0 ? (
                    <p className="p-2 text-gray-500">Sin consumos</p>
                  ) : (
                    verificacion.consumos.map((c: any) => (
                      <div key={c.id} className="flex justify-between p-2">
                        <span>{c.producto_nombre} x{c.cantidad}</span>
                        <span className={c.pagado ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(c.total)} {c.pagado ? "(pagado)" : ""}
                        </span>
                      </div>
                    ))
                  )}
                  {verificacion.total_consumos_pendientes > 0 && (
                    <div className="flex justify-between p-2 font-medium text-red-600">
                      <span>Total pendiente</span><span>{formatCurrency(verificacion.total_consumos_pendientes)}</span>
                    </div>
                  )}
                </div>

                {verificacion.mora_penalidad > 0 && (
                  <div className="flex justify-between p-2 bg-red-50 rounded-md text-sm font-medium text-red-700">
                    <span>Mora/Penalidad</span><span>{formatCurrency(verificacion.mora_penalidad)}</span>
                  </div>
                )}

                {verificacion.total_pagado > 0 && (
                  <div className="flex justify-between p-2 bg-green-50 rounded-md text-sm font-medium text-green-700">
                    <span>Total pagado (adelantos)</span><span>-{formatCurrency(verificacion.total_pagado)}</span>
                  </div>
                )}

                <div className="flex justify-between p-3 bg-blue-50 rounded-md text-base font-bold text-blue-800">
                  <span>Total a pagar</span><span>{formatCurrency(verificacion.total_a_pagar)}</span>
                </div>

                {success ? (
                  <div className="text-center text-sm text-green-600 py-2">✓ Salida culminada exitosamente</div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Método de pago</label>
                      <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={metodoPago}
                        onChange={(e) => setMetodoPago(e.target.value)}>
                        {metodosPago.length === 0 && <option value="">Configura un método de pago</option>}
                        {metodosPago.map((metodo) => <option key={metodo.id} value={metodo.nombre}>{metodo.nombre}</option>)}
                      </select>
                    </div>
                    {metodoPago.trim().toLowerCase() === "efectivo" && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Dinero recibido</label>
                        <input
                          type="number"
                          min={verificacion.total_a_pagar}
                          step="0.01"
                          className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                          value={efectivoRecibido}
                          onChange={(e) => setEfectivoRecibido(e.target.value)}
                          placeholder={formatCurrency(verificacion.total_a_pagar)}
                        />
                        {efectivoRecibido && Number(efectivoRecibido) >= verificacion.total_a_pagar && (
                          <p className="text-sm font-medium text-green-700">
                            Cambio a devolver: {formatCurrency(Number(efectivoRecibido) - verificacion.total_a_pagar)}
                          </p>
                        )}
                      </div>
                    )}
                    <Button className="w-full" onClick={handleCulminar} disabled={culminando || verificacion.total_a_pagar < 0}>
                      {culminando ? "Procesando..." : "Culminar Salida"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {factura && (
        <Card id="factura-salida" className="print-invoice overflow-hidden bg-white">
          <CardHeader className="border-b">
            <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Factura de hospedaje</CardTitle>
                <p className="text-sm text-gray-500">{factura.numero} · Reserva {factura.codigo_confirmacion}</p>
              </div>
              <Button variant="outline" onClick={() => window.print()}>Imprimir factura</Button>
            </div>
            <div className="hidden print:block">
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  {hotelConfig?.logo_url && <img src={`${API_URL}${hotelConfig.logo_url}`} alt={hotelConfig?.nombre || "Hotel"} className="h-16 w-16 object-contain" />}
                  <div>
                    <h2 className="text-xl font-bold uppercase">{hotelConfig?.nombre || "Hotel Paredes"}</h2>
                    {hotelConfig?.rtn && <p className="text-sm">RTN: {hotelConfig.rtn}</p>}
                    {hotelConfig?.direccion && <p className="text-sm">{hotelConfig.direccion}</p>}
                    <p className="text-sm">{[hotelConfig?.telefono, hotelConfig?.email].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">FACTURA</p>
                  <p className="text-sm">No. {factura.numero}</p>
                  <p className="text-sm">Fecha: {new Date(factura.fecha).toLocaleDateString("es-HN")}</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
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
                  {factura.items.map((item: any, index: number) => (
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
                {factura.pagos.length === 0 ? (
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
                <div className="flex justify-between"><span>Subtotal hospedaje</span><span>{formatCurrency(factura.resumen.subtotal_habitacion)}</span></div>
                {factura.resumen.descuento > 0 && <div className="flex justify-between"><span>Descuento</span><span>-{formatCurrency(factura.resumen.descuento)}</span></div>}
                <div className="flex justify-between"><span>Impuesto</span><span>{formatCurrency(factura.resumen.impuesto)}</span></div>
                {factura.resumen.total_consumos > 0 && <div className="flex justify-between"><span>Consumos</span><span>{formatCurrency(factura.resumen.total_consumos)}</span></div>}
                {factura.resumen.mora_penalidad > 0 && <div className="flex justify-between text-red-600"><span>Mora/Penalidad</span><span>{formatCurrency(factura.resumen.mora_penalidad)}</span></div>}
                <div className="mt-3 border-t pt-3 flex justify-between text-base font-bold"><span>Total factura</span><span>{formatCurrency(factura.resumen.total_factura)}</span></div>
                <div className="no-print flex justify-between font-medium text-blue-700"><span>Cobrado al culminar salida</span><span>{formatCurrency(factura.resumen.total_cobrado_checkout)}</span></div>
                {factura.resumen.efectivo_recibido > 0 && <div className="flex justify-between"><span>Efectivo recibido</span><span>{formatCurrency(factura.resumen.efectivo_recibido)}</span></div>}
                {factura.resumen.cambio > 0 && <div className="flex justify-between font-medium text-green-700"><span>Cambio devuelto</span><span>{formatCurrency(factura.resumen.cambio)}</span></div>}
              </div>
            </div>

            <div className="hidden pt-10 text-center text-xs text-gray-500 print:block">
              <p>Gracias por su preferencia.</p>
              <p>Factura generada por el sistema de gestion hotelera.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
