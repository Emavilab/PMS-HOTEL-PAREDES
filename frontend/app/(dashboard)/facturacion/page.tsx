"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"
import { Receipt } from "lucide-react"

export default function FacturacionPage() {
  const [reservations, setReservations] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [folio, setFolio] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.reservas.listar({ status: "CHECKED_IN" }).then((r) => {
      setReservations(r)
      setLoading(false)
    })
  }, [])

  async function loadFolio() {
    if (!selectedId) return
    const f = await api.facturacion.obtenerFolio(selectedId)
    setFolio(f)
  }

  useEffect(() => { if (selectedId) loadFolio() }, [selectedId])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Facturación</h1>

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
                            <td className="p-2">{p.payment_method}</td>
                            <td className="p-2">{p.reference || "-"}</td>
                            <td className="text-right p-2">{formatCurrency(p.amount)}</td>
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
    </div>
  )
}
