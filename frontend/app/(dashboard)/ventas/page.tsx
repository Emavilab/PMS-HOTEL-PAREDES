"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, statusBadge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { ErrorToast } from "@/components/ui/error-toast"
import { SuccessToast } from "@/components/ui/success-toast"
import { ShoppingCart, Package, Plus, Minus, Trash2, Check, UserRound, BedDouble, Banknote, CreditCard, Wallet, Search } from "lucide-react"

type Tab = "vender" | "productos"

export default function VentasPage() {
  const [tab, setTab] = useState<Tab>("vender")

  const tabs = [
    { id: "vender" as Tab, label: "Vender", icon: ShoppingCart },
    { id: "productos" as Tab, label: "Productos", icon: Package },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ventas</h1>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-md w-fit">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === t.id ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-800"
              }`}
              onClick={() => setTab(t.id)}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === "vender" && <VenderTab />}
      {tab === "productos" && <ProductosTab />}
    </div>
  )
}

function VenderTab() {
  const [destino, setDestino] = useState<"particular" | "habitacion">("particular")
  const [ocupadas, setOcupadas] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [productos, setProductos] = useState<any[]>([])
  const [carrito, setCarrito] = useState<{ producto: any; cantidad: number; pagado: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [clienteNombre, setClienteNombre] = useState("")
  const [metodoPago, setMetodoPago] = useState("Efectivo")
  const [efectivoRecibido, setEfectivoRecibido] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [busquedaHabitacion, setBusquedaHabitacion] = useState("")
  const [pagarAhora, setPagarAhora] = useState(false)
  const [ventaHabitacionAbierta, setVentaHabitacionAbierta] = useState(false)

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(""), 3200)
    return () => window.clearTimeout(timer)
  }, [success])

  const loadData = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.ventas.ocupadas(),
      api.ventas.listarProductos(),
    ]).then(([o, p]) => {
      setOcupadas(o)
      setProductos(p)
    }).catch((err) => setError(err.message))
    .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function addToCart(producto: any, pagado: boolean) {
    setCarrito((prev) => {
      const exist = prev.find((c) => c.producto.id === producto.id && c.pagado === pagado)
      if (exist) {
        return prev.map((c) =>
          c.producto.id === producto.id && c.pagado === pagado
            ? { ...c, cantidad: c.cantidad + 1 }
            : c
        )
      }
      return [...prev, { producto, cantidad: 1, pagado }]
    })
  }

  function removeFromCart(productoId: string, pagado: boolean) {
    setCarrito((prev) => {
      const exist = prev.find((c) => c.producto.id === productoId && c.pagado === pagado)
      if (exist && exist.cantidad > 1) {
        return prev.map((c) =>
          c.producto.id === productoId && c.pagado === pagado
            ? { ...c, cantidad: c.cantidad - 1 }
            : c
        )
      }
      return prev.filter((c) => !(c.producto.id === productoId && c.pagado === pagado))
    })
  }

  function abrirVentaHabitacion(habitacion: any) {
    setDestino("habitacion")
    setSelected(habitacion)
    setCarrito([])
    setPagarAhora(false)
    setEfectivoRecibido("")
    setBusqueda("")
    setError("")
    setSuccess("")
    setVentaHabitacionAbierta(true)
  }

  async function handleVender() {
    if (destino === "habitacion" && !selected) {
      setError("Selecciona una habitación antes de registrar el consumo")
      return
    }
    if (carrito.length === 0) {
      setError("Agrega al menos un producto al carrito")
      return
    }
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const recibido = mostrarPago && esEfectivo && efectivoRecibido ? Number(efectivoRecibido) : undefined
      if (mostrarPago && esEfectivo && (recibido === undefined || !Number.isFinite(recibido) || recibido < totalCarrito)) {
        throw new Error("El dinero recibido debe cubrir el total")
      }
      if (destino === "particular") {
        await api.ventas.crearVentaParticular({
          cliente_nombre: clienteNombre || "Cliente particular",
          metodo_pago: metodoPago,
          efectivo_recibido: recibido,
          items: carrito.map((c) => ({ producto_id: c.producto.id, cantidad: c.cantidad })),
        })
        setSuccess("Venta cobrada y guardada correctamente")
      } else {
        await api.ventas.agregarConsumos(selected.reserva_id, carrito.map((c, index) => ({
          producto_id: c.producto.id,
          cantidad: c.cantidad,
          pagado: pagarAhora,
          ...(index === 0 && pagarAhora ? { metodo_pago: metodoPago, efectivo_recibido: recibido } : {}),
        })))
        setSuccess(pagarAhora ? "Consumo cobrado y registrado en Caja" : "Consumo cargado a la habitación")
      }
      setCarrito([])
      setEfectivoRecibido("")
      setClienteNombre("")
      if (destino === "habitacion") setVentaHabitacionAbierta(false)
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalCarrito = carrito.reduce((sum, c) => sum + c.producto.precio_unitario * c.cantidad, 0)
  const productosFiltrados = productos.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.categoria || "").toLowerCase().includes(busqueda.toLowerCase()))
  const esEfectivo = metodoPago.toLowerCase() === "efectivo"
  const habitacionesFiltradas = ocupadas.filter((h) => `${h.habitacion_numero} ${h.piso || ""} ${h.huesped}`.toLowerCase().includes(busquedaHabitacion.toLowerCase()))
  const mostrarPago = destino === "particular" || pagarAhora

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button onClick={() => { setDestino("particular"); setSelected(null); setCarrito([]); setVentaHabitacionAbierta(false); setError("") }} className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition ${destino === "particular" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-gray-200 bg-white hover:border-blue-300"}`}>
          <UserRound className="h-6 w-6" />
          <span><strong className="block">Cliente particular</strong><small className="text-gray-500">Venta directa y cobro inmediato</small></span>
        </button>
        <button onClick={() => { setDestino("habitacion"); setSelected(null); setCarrito([]); setVentaHabitacionAbierta(false); setError("") }} className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition ${destino === "habitacion" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-gray-200 bg-white hover:border-blue-300"}`}>
          <BedDouble className="h-6 w-6" />
          <span><strong className="block">Cargar a habitación</strong><small className="text-gray-500">Añadir consumo a un huésped alojado</small></span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">{destino === "particular" ? "Selecciona productos" : "Selecciona una habitación para vender"}</CardTitle>
        </CardHeader>
        <CardContent>
          {destino === "habitacion" && <>
            <div className="mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-gray-400" /><Input value={busquedaHabitacion} onChange={(e) => setBusquedaHabitacion(e.target.value)} placeholder="Buscar por número, piso o huésped..." /></div>
            {loading ? <p className="text-gray-500">Cargando...</p> : habitacionesFiltradas.length === 0 ? <p className="text-gray-500">No hay habitaciones que coincidan</p> : (
            <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {habitacionesFiltradas.map((h) => (
                <button
                  key={h.reserva_id}
                  className={`p-3 rounded-md cursor-pointer ${
                    selected?.reserva_id === h.reserva_id
                      ? "bg-blue-100 border border-blue-300"
                      : "bg-gray-50 hover:bg-gray-100 border border-transparent"
                  }`}
                  onClick={() => abrirVentaHabitacion(h)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Hab. {h.habitacion_numero} - {h.habitacion_tipo}</p>
                      <p className="text-xs text-gray-500">Piso: {h.piso || "Sin piso"}</p>
                      <p className="text-sm text-gray-500">{h.huesped}</p>
                    </div>
                    <span className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white">Abrir venta</span>
                  </div>
                </button>
              ))}
            </div>)}</>}
          {destino === "particular" && <><div className="mb-4 flex items-center gap-2"><Search className="h-4 w-4 text-gray-400" /><Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto por nombre o categoría..." /></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {productosFiltrados.map((p) => <button key={p.id} onClick={() => addToCart(p, destino === "particular")} className="flex min-h-28 flex-col items-start justify-between rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 active:scale-[.98]"><span><span className="block font-medium">{p.nombre}</span><span className="text-xs text-gray-500">{p.categoria || "Producto"}</span></span><span className="flex w-full items-center justify-between font-semibold text-blue-700">{formatCurrency(p.precio_unitario)}<Plus className="h-5 w-5" /></span></button>)}
          </div></>}
        </CardContent>
      </Card>

      {destino === "particular" && <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen de venta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Nombre del cliente (opcional)" />

              {carrito.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Carrito</p>
                  {carrito.map((c) => (
                    <div key={`${c.producto.id}-${c.pagado}`} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded-md">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.producto.nombre}</p>
                        <p className="text-xs">
                          {c.cantidad} x {formatCurrency(c.producto.precio_unitario)}
                          <span className={`ml-1 ${c.pagado ? "text-green-600" : "text-blue-600"}`}>
                            ({c.pagado ? "Pagado" : "P. luego"})
                          </span>
                        </p>
                      </div>
                      <button onClick={() => removeFromCart(c.producto.id, c.pagado)} className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0">
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <div className="border-t pt-2 text-right text-base font-bold">Total: {formatCurrency(totalCarrito)}</div>
                </div>
              )}

              {carrito.length > 0 && <div className="space-y-2 border-t pt-3"><p className="text-sm font-medium">Forma de pago</p><div className="grid grid-cols-3 gap-2">{["Efectivo", "Tarjeta", "Transferencia"].map((metodo) => <button key={metodo} onClick={() => setMetodoPago(metodo)} className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs ${metodoPago === metodo ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200"}`}>{metodo === "Efectivo" ? <Banknote className="h-5 w-5" /> : metodo === "Tarjeta" ? <CreditCard className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}{metodo}</button>)}</div>{esEfectivo && <><Input type="number" min={totalCarrito} step="0.01" value={efectivoRecibido} onChange={(e) => setEfectivoRecibido(e.target.value)} placeholder="Dinero recibido" />{efectivoRecibido && Number(efectivoRecibido) >= totalCarrito && <p className="text-sm font-medium text-green-700">Cambio: {formatCurrency(Number(efectivoRecibido) - totalCarrito)}</p>}</>}</div>}

              {error && <p className="instant-error text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}

              <Button className="w-full" onClick={handleVender} disabled={carrito.length === 0 || saving}>
                {saving ? "Procesando..." : destino === "particular" ? "Cobrar venta" : "Cargar a habitación"}
              </Button>
        </CardContent>
      </Card>}
    </div>
    <Dialog open={ventaHabitacionAbierta} onClose={() => setVentaHabitacionAbierta(false)} title={`Venta para Hab. ${selected?.habitacion_numero || ""}`} className="max-w-4xl">
      {selected && <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-md bg-blue-50 p-3 text-sm"><p className="font-semibold">{selected.huesped}</p><p>Habitación {selected.habitacion_numero} · Piso {selected.piso || "Sin piso"}</p></div>
          <div className="flex items-center gap-2"><Search className="h-4 w-4 text-gray-400" /><Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar producto por nombre o categoría..." /></div>
          <div className="grid max-h-[45vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {productosFiltrados.map((p) => <button key={p.id} onClick={() => addToCart(p, false)} className="flex min-h-24 flex-col items-start justify-between rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 active:scale-[.98]"><span><span className="block font-medium">{p.nombre}</span><span className="text-xs text-gray-500">{p.categoria || "Producto"}</span></span><span className="flex w-full items-center justify-between font-semibold text-blue-700">{formatCurrency(p.precio_unitario)}<Plus className="h-5 w-5" /></span></button>)}
          </div>
        </div>
        <div className="space-y-4 rounded-md border p-4">
          <div className="grid grid-cols-2 gap-2"><button onClick={() => setPagarAhora(false)} className={`rounded-md border p-2 text-sm ${!pagarAhora ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200"}`}>Cargar a cuenta</button><button onClick={() => setPagarAhora(true)} className={`rounded-md border p-2 text-sm ${pagarAhora ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200"}`}>Pagar al momento</button></div>
          {carrito.length === 0 ? <p className="text-sm text-gray-500">Selecciona productos para agregarlos al consumo.</p> : <div className="space-y-2">{carrito.map((c) => <div key={c.producto.id} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 p-2 text-sm"><span className="min-w-0 truncate">{c.cantidad} x {c.producto.nombre}</span><span className="flex items-center gap-2"><strong>{formatCurrency(c.producto.precio_unitario * c.cantidad)}</strong><button onClick={() => removeFromCart(c.producto.id, false)} className="text-red-500" title="Quitar producto"><Minus className="h-4 w-4" /></button></span></div>)}<div className="border-t pt-2 text-right text-lg font-bold">{formatCurrency(totalCarrito)}</div></div>}
          {pagarAhora && carrito.length > 0 && <div className="space-y-2"><p className="text-sm font-medium">Forma de pago</p><div className="grid grid-cols-3 gap-2">{["Efectivo", "Tarjeta", "Transferencia"].map((metodo) => <button key={metodo} onClick={() => setMetodoPago(metodo)} className={`rounded-md border p-2 text-xs ${metodoPago === metodo ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200"}`}>{metodo}</button>)}</div>{esEfectivo && <Input type="number" min={totalCarrito} step="0.01" value={efectivoRecibido} onChange={(e) => setEfectivoRecibido(e.target.value)} placeholder="Dinero recibido" />}</div>}
          {error && <p className="instant-error text-sm text-red-600">{error}</p>}
          <Button className="w-full" onClick={handleVender} disabled={carrito.length === 0 || saving}>{saving ? "Procesando..." : pagarAhora ? "Cobrar y registrar consumo" : "Registrar consumo"}</Button>
        </div>
      </div>}
    </Dialog>
    </div>
  )
}

function ProductosTab() {
  const [productos, setProductos] = useState<any[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: "", descripcion: "", precio_unitario: 0, categoria: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const loadData = useCallback(() => {
    setLoading(true)
    api.ventas.listarProductos().then(setProductos).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { api.ventas.listarCategorias().then(setCategorias).catch((err) => setError(err.message)) }, [])

  function openNew() {
    setEditId(null)
    setForm({ nombre: "", descripcion: "", precio_unitario: 0, categoria: "" })
    setShowForm(true)
  }

  function openEdit(p: any) {
    setEditId(p.id)
    setForm({ nombre: p.nombre, descripcion: p.descripcion || "", precio_unitario: p.precio_unitario, categoria: p.categoria || "" })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.nombre.trim()) {
      setError("El nombre del producto es obligatorio")
      return
    }
    if (!Number.isFinite(form.precio_unitario) || form.precio_unitario <= 0) {
      setError("El precio debe ser mayor que cero")
      return
    }
    setSaving(true)
    setError("")
    try {
      if (editId) {
        await api.ventas.actualizarProducto(editId, form)
        setSuccess("Producto actualizado correctamente")
      } else {
        await api.ventas.crearProducto(form)
        setSuccess("Producto creado correctamente")
      }
      setShowForm(false)
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este producto?")) return
    try {
      await api.ventas.eliminarProducto(id)
      setSuccess("Producto eliminado correctamente")
      loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{productos.length} producto(s)</p>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo Producto</Button>
      </div>

      <ErrorToast message={error} onClose={() => setError("")} />
      <SuccessToast message={success} onClose={() => setSuccess("")} />

      <Dialog open={showForm} onClose={() => setShowForm(false)} title={editId ? "Editar Producto" : "Nuevo Producto"}>
        <div className="space-y-3">
          {error && <div className="instant-error p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}
          <div className="space-y-1">
            <label className="text-sm font-medium">Nombre *</label>
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Descripción</label>
            <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Precio Unitario *</label>
              <Input type="number" min={0} step={0.01} value={form.precio_unitario}
                onChange={(e) => setForm({ ...form, precio_unitario: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Categoría</label>
              <select className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm" value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                <option value="">Sin categoría</option>
                {categorias.map((categoria) => <option key={categoria.id} value={categoria.nombre}>{categoria.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </div>
      </Dialog>

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : productos.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-gray-500">No hay productos registrados</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {productos.map((p) => (
            <div key={p.id} className="bg-white border rounded-md p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{p.nombre}</p>
                  {p.categoria && <p className="text-xs text-gray-500">{p.categoria}</p>}
                </div>
                <button onClick={() => handleDelete(p.id)} className="p-1 text-gray-300 hover:text-red-500 rounded">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {p.descripcion && <p className="text-xs text-gray-400">{p.descripcion}</p>}
              <div className="flex items-center justify-between pt-1">
                <span className="font-bold text-blue-700">{formatCurrency(p.precio_unitario)}</span>
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Editar</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
