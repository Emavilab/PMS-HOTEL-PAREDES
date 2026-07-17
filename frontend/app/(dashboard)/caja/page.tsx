"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, statusBadge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import { DollarSign } from "lucide-react"

export default function CajaPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [openingAmount, setOpeningAmount] = useState("0")
  const [declaredAmount, setDeclaredAmount] = useState("0")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function loadData() {
    setLoading(true)
    try {
      const [sess] = await Promise.all([
        api.caja.listar(),
      ])
      setSessions(sess)
      try {
        const active = await api.caja.activa()
        setActiveSession(active)
      } catch { setActiveSession(null) }
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  async function handleOpen() {
    setError("")
    try {
      await api.caja.abrir(parseFloat(openingAmount) || 0)
      loadData()
    } catch (err: any) { setError(err.message) }
  }

  async function handleClose() {
    if (!activeSession) return
    setError("")
    try {
      await api.caja.cerrar(activeSession.id, parseFloat(declaredAmount) || 0)
      loadData()
    } catch (err: any) { setError(err.message) }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Caja</h1>

      {error && <div className="p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              {activeSession ? "Sesión Activa" : "Abrir Caja"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSession ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Apertura</p>
                    <p className="font-medium">{formatDate(activeSession.abierta_en)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Monto Apertura</p>
                    <p className="font-medium">{formatCurrency(activeSession.monto_apertura)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Monto Declarado para Cierre</label>
                  <Input type="number" step="0.01" value={declaredAmount} onChange={(e) => setDeclaredAmount(e.target.value)} />
                </div>
                <Button onClick={handleClose}>Cerrar Caja</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Monto de Apertura</label>
                  <Input type="number" step="0.01" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} />
                </div>
                <Button onClick={handleOpen}>Abrir Caja</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Historial de Sesiones</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : sessions.length === 0 ? (
              <p className="text-gray-500">No hay sesiones registradas</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div>
                      <p className="text-sm">{formatDate(s.abierta_en)}</p>
                      <p className="text-xs text-gray-500">
                        Apertura: {formatCurrency(s.monto_apertura)}
                        {s.diferencia !== null && ` | Diferencia: ${formatCurrency(s.diferencia)}`}
                      </p>
                    </div>
                    <Badge {...statusBadge(s.status)} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
