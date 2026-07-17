"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge, statusBadge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"

export default function VerificarSalidaPage() {
  const [ocupadas, setOcupadas] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [verificacion, setVerificacion] = useState<any | null>(null)
  const [metodoPago, setMetodoPago] = useState("Efectivo")
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

  async function selectReserva(reserva: any) {
    setSelected(reserva)
    setError("")
    setSuccess("")
    setLoadingDetalle(true)
    try {
      const data = await api.ventas.verificarSalida(reserva.reserva_id)
      setVerificacion(data)
      setMetodoPago("Efectivo")
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
      await api.ventas.culminarSalida(selected.reserva_id, metodoPago)
      setSuccess("Salida culminada exitosamente")
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
                  <div className="flex justify-between p-2"><span>Impuesto (15%)</span><span>{formatCurrency(verificacion.impuesto)}</span></div>
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
                        <option value="Efectivo">Efectivo</option>
                        <option value="Tarjeta">Tarjeta</option>
                        <option value="Transferencia">Transferencia</option>
                      </select>
                    </div>
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
    </div>
  )
}
