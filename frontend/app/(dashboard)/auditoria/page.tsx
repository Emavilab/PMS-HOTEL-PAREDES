"use client"

import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { formatDateTimeMinute } from "@/lib/utils"
import { Eye, RefreshCw, Search, Shield, X } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import type { RegistroAuditoria } from "@/types"
import { ErrorToast } from "@/components/ui/error-toast"

export default function AuditoriaPage() {
  const { user: currentUser } = useAuth()
  const [logs, setLogs] = useState<RegistroAuditoria[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [action, setAction] = useState("")
  const [entity, setEntity] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [selected, setSelected] = useState<RegistroAuditoria | null>(null)
  const [page, setPage] = useState(1)

  const loadLogs = () => {
    setLoading(true)
    setError("")
    const params: Record<string, string> = { tamano: "50", pagina: String(page) }
    if (search.trim()) params.buscar = search.trim()
    if (action) params.accion = action
    if (entity) params.tipo_entidad = entity
    if (from) params.desde = from
    if (to) params.hasta = to
    api.auditoria.listar(params).then((data) => { setLogs(data.items); setTotal(data.total) }).catch((err: Error) => setError(err.message)).finally(() => setLoading(false))
  }

  const exportLogs = (format: "xlsx" | "pdf") => {
    const params: Record<string, string> = {}
    if (search.trim()) params.buscar = search.trim()
    if (action) params.accion = action
    if (entity) params.tipo_entidad = entity
    if (from) params.desde = from
    if (to) params.hasta = to
    api.auditoria.exportar(params, format).then((blob) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      const fecha = new Date().toISOString().slice(0, 10)
      anchor.download = `auditoria_${fecha}.${format}`
      anchor.click()
      URL.revokeObjectURL(url)
    }).catch((err: Error) => setError(err.message))
  }

  useEffect(() => {
    loadLogs()
  }, [action, entity, from, to, page])

  const actions = useMemo(() => Array.from(new Set(logs.map((log) => log.accion))).sort(), [logs])
  const entities = useMemo(() => Array.from(new Set(logs.map((log) => log.tipo_entidad))).sort(), [logs])

  if (currentUser?.rol !== "admin" && currentUser?.rol !== "gerente") {
    return <p className="text-gray-500">No tienes permisos para ver esta página.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" /> Auditoría</h1>
        <div className="flex gap-2"><button type="button" onClick={() => exportLogs("xlsx")} className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">Excel</button><button type="button" onClick={() => exportLogs("pdf")} className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">PDF</button><button type="button" onClick={loadLogs} disabled={loading} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50" title="Actualizar registros"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button></div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[240px] flex-1"><label className="mb-1 block text-xs font-medium text-gray-500">Buscar</label><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><Input className="pl-9" placeholder="Usuario, acción, entidad o ID" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadLogs()} /></div></div>
          <label className="text-sm text-gray-600">Acción<select value={action} onChange={(e) => setAction(e.target.value)} className="mt-1 block h-10 rounded-md border px-3 text-sm"><option value="">Todas</option>{actions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm text-gray-600">Entidad<select value={entity} onChange={(e) => setEntity(e.target.value)} className="mt-1 block h-10 rounded-md border px-3 text-sm"><option value="">Todas</option>{entities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-sm text-gray-600">Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block h-10 rounded-md border px-3 text-sm" /></label>
          <label className="text-sm text-gray-600">Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block h-10 rounded-md border px-3 text-sm" /></label>
          <button type="button" onClick={() => { setSearch(""); setAction(""); setEntity(""); setFrom(""); setTo(""); setPage(1) }} className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm text-gray-600 hover:bg-gray-100" title="Limpiar filtros"><X className="h-4 w-4" /> Limpiar</button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500"><span>{loading ? "Cargando registros..." : `${total} registros encontrados`}</span>{!loading && total > 50 && <div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Anterior</button><span>Página {page} de {Math.ceil(total / 50)}</span><button type="button" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage((current) => current + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Siguiente</button></div>}</div>
      <ErrorToast message={error} onClose={() => setError("")} />
      <Card>
        <CardContent className="p-0">
              {!loading && !error && logs.length === 0 ? <p className="p-6 text-gray-500">No hay acciones registradas</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-gray-50"><th className="p-3 text-left">Fecha y hora</th><th className="p-3 text-left">Realizada por</th><th className="p-3 text-left">Acción</th><th className="p-3 text-right">Detalles</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id} className="border-b hover:bg-gray-50"><td className="p-3 whitespace-nowrap">{formatDateTimeMinute(log.creado_en)}</td><td className="p-3"><span className="font-medium">{log.nombre_usuario || "Sistema"}</span></td><td className="p-3">{log.descripcion || `${log.nombre_usuario || "Un usuario"} realizó una acción en el sistema`}</td><td className="p-3 text-right">{Object.keys(log.detalles || {}).length > 0 && <button type="button" onClick={() => setSelected(log)} className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Ver detalles"><Eye className="h-4 w-4" /></button>}</td></tr>)}</tbody></table></div>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} title="Detalle de auditoría" className="max-w-2xl">
        {selected && <div className="space-y-4 text-sm"><div><span className="text-gray-500">Acción realizada</span><p className="font-medium">{selected.descripcion}</p></div><div className="grid grid-cols-2 gap-3"><div><span className="text-gray-500">Usuario</span><p>{selected.nombre_usuario || "Sistema"}</p></div><div><span className="text-gray-500">Fecha y hora</span><p>{formatDateTimeMinute(selected.creado_en)}</p></div>{selected.rol_usuario && <div><span className="text-gray-500">Cargo en el sistema</span><p>{selected.rol_usuario}</p></div>}{selected.direccion_ip && <div><span className="text-gray-500">Ubicación de conexión (IP)</span><p>{selected.direccion_ip}</p></div>}</div>{Object.keys(selected.detalles || {}).length > 0 && <div><h3 className="mb-2 font-medium">Cambios realizados</h3><dl className="divide-y rounded-md border px-3">{Object.entries(selected.detalles || {}).map(([etiqueta, valor]) => <div key={etiqueta} className="flex justify-between gap-4 py-2"><dt className="text-gray-500">{etiqueta}</dt><dd className="text-right font-medium">{typeof valor === "object" ? JSON.stringify(valor) : String(valor)}</dd></div>)}</dl></div>}</div>}
      </Dialog>
    </div>
  )
}
