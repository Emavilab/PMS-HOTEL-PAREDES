"use client"

/** Gestión de apertura, movimientos y cierre de caja. */
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog } from "@/components/ui/dialog"
import { Badge, statusBadge } from "@/components/ui/badge"
import { formatCurrency, formatDate, formatDateTime, hotelDateTimeToISOString } from "@/lib/utils"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, DollarSign, Printer } from "lucide-react"
import { ErrorToast } from "@/components/ui/error-toast"

type CorteData = {
  sesion: any
  resumen: any
  tipo: "X" | "Z" | "vista"
}

export default function CajaPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [resumen, setResumen] = useState<any>(null)
  const [openingAmount, setOpeningAmount] = useState("0")
  const [declaredAmount, setDeclaredAmount] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [confirmar, setConfirmar] = useState<null | "abrir" | "cerrar">(null)
  const [exito, setExito] = useState("")
  const [corte, setCorte] = useState<CorteData | null>(null)
  const [metodosPago, setMetodosPago] = useState<any[]>([])

  useEffect(() => {
    if (!exito) return
    const timer = window.setTimeout(() => setExito(""), 3200)
    return () => window.clearTimeout(timer)
  }, [exito])

  const [filtroEstado, setFiltroEstado] = useState("")
  const [filtroDesde, setFiltroDesde] = useState("")
  const [filtroHasta, setFiltroHasta] = useState("")
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [totalSesiones, setTotalSesiones] = useState(0)

  async function loadData(opts?: { estado?: string; desde?: string; hasta?: string; page?: number }) {
    setLoading(true)
    setError("")
    try {
      const params: Record<string, string> = { page: String(opts?.page ?? page), per_page: "10" }
      const estado = opts?.estado ?? filtroEstado
      const desde = opts?.desde ?? filtroDesde
      const hasta = opts?.hasta ?? filtroHasta
      if (estado) params.estado = estado
      if (desde) params.desde = hotelDateTimeToISOString(desde, "00:00:00")
      if (hasta) params.hasta = hotelDateTimeToISOString(hasta, "23:59:59")

      const data = await api.caja.listar(params)
      const metodos = await api.metodosPago.listar()
      setMetodosPago(metodos)
      setSessions(data.items || [])
      setPages(data.pages || 1)
      setTotalSesiones(data.total || 0)

      try {
        const active = await api.caja.activa()
        setActiveSession(active)
        setResumen(active?.id ? await api.caja.resumen(active.id) : null)
      } catch {
        setActiveSession(null)
        setResumen(null)
      }
    } catch (err: any) {
      setError(err.message || "No se pudo cargar la caja")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [page])

  function aplicarFiltros() {
    loadData({ page: 1 })
  }

  function limpiarFiltros() {
    setFiltroEstado("")
    setFiltroDesde("")
    setFiltroHasta("")
    if (page === 1) loadData({ estado: "", desde: "", hasta: "", page: 1 })
    else setPage(1)
  }

  async function abrirCorte(sesion: any, tipo: CorteData["tipo"]) {
    setError("")
    try {
      const res = await api.caja.resumen(sesion.id)
      setCorte({ sesion, resumen: res, tipo })
    } catch (err: any) {
      setError(err.message || "No se pudo generar el corte")
    }
  }

  const aperturaNum = parseFloat(openingAmount) || 0
  const declaradoNum = parseFloat(declaredAmount) || 0
  const esperadoCaja = resumen?.esperado_caja ?? 0
  const diferenciaPreview = declaradoNum - esperadoCaja

  async function abrirCaja() {
    if (aperturaNum < 0) {
      setError("El monto de apertura no puede ser negativo")
      return
    }
    setSaving(true)
    setError("")
    try {
      await api.caja.abrir(aperturaNum)
      setConfirmar(null)
      setOpeningAmount("0")
      setExito("Caja abierta correctamente")
      loadData()
    } catch (err: any) {
      setError(err.message || "No se pudo abrir la caja")
    } finally {
      setSaving(false)
    }
  }

  async function cerrarCaja() {
    if (!activeSession) return
    if (declaradoNum < 0) {
      setError("El monto declarado no puede ser negativo")
      return
    }
    setSaving(true)
    setError("")
    try {
      await api.caja.cerrar(activeSession.id, declaradoNum)
      setConfirmar(null)
      setDeclaredAmount("")
      setExito(
        Math.abs(diferenciaPreview) < 0.01
          ? "Caja cerrada correctamente. Sin diferencias."
          : `Caja cerrada con diferencia de ${formatCurrency(diferenciaPreview)}`
      )
      loadData()
    } catch (err: any) {
      setError(err.message || "No se pudo cerrar la caja")
    } finally {
      setSaving(false)
    }
  }

  async function ejecutarConfirmacion() {
    if (confirmar === "abrir") await abrirCaja()
    if (confirmar === "cerrar") await cerrarCaja()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caja</h1>
          <p className="mt-1 text-sm text-gray-500">Caja general del hotel: todas las operaciones cobradas se concentran en una sola sesión.</p>
        </div>
        {activeSession && (
          <Button variant="outline" onClick={() => abrirCorte(activeSession, "X")}>
            <Printer className="mr-2 h-4 w-4" /> Corte X
          </Button>
        )}
      </div>

      <ErrorToast message={error} onClose={() => setError("")} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              {activeSession ? "Sesión Activa" : "Abrir Caja"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : activeSession ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Apertura</p>
                    <p className="font-medium">{formatDateTime(activeSession.abierta_en)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Monto Apertura</p>
                    <p className="font-medium">{formatCurrency(activeSession.monto_apertura)}</p>
                  </div>
                </div>

                <div className="rounded-md border p-3 space-y-2 text-sm">
                  <p className="font-medium">Desglose de pagos de esta sesión</p>
                  {resumen ? (
                    <>
                      {metodosPago.map((metodoItem) => {
                        const metodo = metodoItem.nombre
                        const monto = Object.entries(resumen.por_metodo || {}).find(([nombre]) => nombre.trim().toLowerCase() === metodo.trim().toLowerCase())?.[1] || 0
                        return (
                          <div key={metodo} className="flex justify-between">
                            <span>{metodo}</span>
                            <span className={metodo.trim().toLowerCase() === "efectivo" ? "font-medium" : "text-gray-500"}>{formatCurrency(Number(monto))}</span>
                          </div>
                        )
                      })}
                      <div className="flex justify-between border-t pt-2">
                        <span>Total cobrado</span>
                        <span>{formatCurrency(resumen.total_pagos)} ({resumen.cantidad_pagos} pagos)</span>
                      </div>
                      <div className="flex justify-between rounded-md bg-blue-50 p-2 font-bold text-blue-800">
                        <span>Esperado en cajón (efectivo)</span>
                        <span>{formatCurrency(resumen.esperado_caja)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-500">Calculando...</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Efectivo contado en cajón</label>
                  <Input type="number" min="0" step="0.01" value={declaredAmount} onChange={(e) => setDeclaredAmount(e.target.value)} placeholder="Conteo físico del cajón" />
                  {declaredAmount !== "" && (
                    <p className={`text-sm font-medium ${Math.abs(diferenciaPreview) < 0.01 ? "text-green-600" : diferenciaPreview > 0 ? "text-blue-700" : "text-red-600"}`}>
                      Diferencia: {formatCurrency(diferenciaPreview)} {diferenciaPreview > 0 ? "(sobra)" : diferenciaPreview < 0 ? "(falta)" : "(cuadra)"}
                    </p>
                  )}
                </div>

                <Button onClick={() => setConfirmar("cerrar")} disabled={saving || declaredAmount === ""}>
                  Cerrar Caja
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Monto de Apertura</label>
                  <Input type="number" min="0" step="0.01" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} />
                </div>
                <Button onClick={() => setConfirmar("abrir")} disabled={saving}>Abrir Caja</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Historial de Sesiones</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <select
                className="h-10 rounded-md border border-gray-300 px-3 text-sm"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="ABIERTA">Abiertas</option>
                <option value="CERRADA">Cerradas</option>
              </select>
              <Input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} title="Desde" />
              <Input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} title="Hasta" />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={aplicarFiltros} className="flex-1">Filtrar</Button>
                <Button size="sm" variant="ghost" onClick={limpiarFiltros}>Limpiar</Button>
              </div>
            </div>

            {loading ? (
              <p className="text-gray-500">Cargando...</p>
            ) : sessions.length === 0 ? (
              <p className="text-gray-500">No hay sesiones registradas</p>
            ) : (
              <>
                <div className="space-y-2 max-h-[400px] overflow-auto pr-1">
                  {sessions.map((s) => (
                    <div key={s.id} className="p-3 bg-gray-50 rounded-md space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            {formatDateTime(s.abierta_en)} · {s.nombre_usuario || "Usuario"}
                          </p>
                          {s.cerrada_en && (
                            <p className="text-xs text-gray-500">Cierre: {formatDateTime(s.cerrada_en)}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            Apertura: {formatCurrency(s.monto_apertura)}
                            {s.monto_esperado !== null && s.monto_esperado !== undefined && ` | Esperado: ${formatCurrency(s.monto_esperado)}`}
                            {s.monto_declarado !== null && s.monto_declarado !== undefined && ` | Declarado: ${formatCurrency(s.monto_declarado)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge {...statusBadge(s.estado === "ABIERTA" ? "ABIERTA" : "CERRADA")} />
                          <Button size="sm" variant="ghost" onClick={() => abrirCorte(s, s.estado === "ABIERTA" ? "X" : "Z")}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {s.diferencia !== null && s.diferencia !== undefined && (
                        <p className={`text-xs font-medium ${Math.abs(s.diferencia) < 0.01 ? "text-green-600" : s.diferencia > 0 ? "text-blue-700" : "text-red-600"}`}>
                          Diferencia: {formatCurrency(s.diferencia)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-gray-500">{totalSesiones} sesión{totalSesiones !== 1 ? "es" : ""} · Página {page} de {pages}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!corte} onClose={() => setCorte(null)} title={corte?.tipo === "Z" ? "Corte de cierre (Z)" : "Corte parcial (X)"} className="max-w-md">
        {corte && (
          <div className="print-invoice space-y-4 text-sm bg-white">
            <div className="no-print flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="mr-1 h-4 w-4" /> Imprimir
              </Button>
            </div>

            <div className="text-center border-b pb-3">
              <p className="font-bold uppercase">Hotel Paredes</p>
              <p className="text-xs text-gray-500">{corte.tipo === "Z" ? "CORTE DE CIERRE (Z)" : "CORTE PARCIAL (X)"}</p>
              <p className="text-xs text-gray-500">{new Date().toLocaleString("es-HN")}</p>
            </div>

<div className="space-y-1">
                <div className="flex justify-between"><span>Cajero:</span><span className="font-medium">{corte.sesion.nombre_usuario || "-"}</span></div>
                <div className="flex justify-between"><span>Apertura:</span><span>{formatDateTime(corte.sesion.abierta_en)}</span></div>
                {corte.resumen.cerrada_en && <div className="flex justify-between"><span>Cierre:</span><span>{formatDateTime(corte.resumen.cerrada_en)}</span></div>}
              </div>

            <div className="border-t pt-3 space-y-1">
              <div className="flex justify-between"><span>Fondo inicial:</span><span>{formatCurrency(corte.sesion.monto_apertura)}</span></div>
              {metodosPago.map((metodoItem) => {
                const metodo = metodoItem.nombre
                return (
                <div key={metodo} className="flex justify-between">
                  <span>Pagos {metodo}:</span>
                  <span className={metodo.trim().toLowerCase() === "efectivo" ? "font-medium" : ""}>{formatCurrency(Number(Object.entries(corte.resumen.por_metodo || {}).find(([nombre]) => nombre.trim().toLowerCase() === metodo.trim().toLowerCase())?.[1] || 0))}</span>
                </div>
                )
              })}
              <div className="flex justify-between border-t pt-2"><span>Total cobrado:</span><span className="font-medium">{formatCurrency(corte.resumen.total_pagos)} ({corte.resumen.cantidad_pagos})</span></div>
            </div>

            <div className="border-t pt-3 space-y-1">
              <div className="flex justify-between font-semibold"><span>Esperado en cajón:</span><span>{formatCurrency(corte.resumen.esperado_caja)}</span></div>
              {corte.sesion.monto_declarado !== null && corte.sesion.monto_declarado !== undefined && (
                <>
                  <div className="flex justify-between"><span>Efectivo declarado:</span><span>{formatCurrency(corte.sesion.monto_declarado)}</span></div>
                  <div className={`flex justify-between font-bold ${Math.abs(corte.sesion.diferencia) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                    <span>Diferencia:</span><span>{formatCurrency(corte.sesion.diferencia)}</span>
                  </div>
                </>
              )}
            </div>

            <p className="hidden pt-6 text-center text-xs text-gray-500 print:block">Gracias. Conserve este comprobante.</p>
          </div>
        )}
      </Dialog>

      <Dialog open={!!confirmar} onClose={() => setConfirmar(null)} title={confirmar === "abrir" ? "Abrir caja" : "Cerrar caja"} className="max-w-md">
        <div className="space-y-5">
          <div className="flex gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${confirmar === "abrir" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
              {confirmar === "abrir" ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <div className="text-sm leading-6 text-gray-600">
              {confirmar === "abrir" ? (
                <p>Se abrira la caja general del hotel con fondo inicial de <span className="font-semibold">{formatCurrency(aperturaNum)}</span>. Todas las operaciones cobradas se registraran en esta caja.</p>
              ) : (
                <>
                  <p>Se cerrara la caja general actual para todos los usuarios.</p>
                  <div className="mt-2 rounded-md bg-gray-50 p-3 space-y-1">
                    <div className="flex justify-between"><span>Esperado en cajón:</span><span className="font-medium">{formatCurrency(esperadoCaja)}</span></div>
                    <div className="flex justify-between"><span>Efectivo declarado:</span><span className="font-medium">{formatCurrency(declaradoNum)}</span></div>
                    <div className={`flex justify-between font-semibold ${Math.abs(diferenciaPreview) < 0.01 ? "text-green-600" : diferenciaPreview > 0 ? "text-blue-700" : "text-red-600"}`}>
                      <span>Diferencia:</span><span>{formatCurrency(diferenciaPreview)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setConfirmar(null)} disabled={saving}>Cancelar</Button>
            <Button type="button" variant={confirmar === "abrir" ? "default" : "destructive"} onClick={ejecutarConfirmacion} disabled={saving}>
              {saving ? "Procesando..." : confirmar === "abrir" ? "Abrir caja" : "Cerrar caja"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!exito} onClose={() => setExito("")} title="Operación exitosa" className="max-w-sm">
        <div className="space-y-5">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm leading-6 text-gray-600">{exito}</p>
          </div>
          <div className="flex justify-end border-t pt-4">
            <Button type="button" onClick={() => setExito("")}>Aceptar</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
