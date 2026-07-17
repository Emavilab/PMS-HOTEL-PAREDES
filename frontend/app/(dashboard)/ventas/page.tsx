"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, statusBadge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { ShoppingCart, Package, Plus, Minus, Trash2, Check } from "lucide-react"

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
  const [ocupadas, setOcupadas] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [productos, setProductos] = useState<any[]>([])
  const [carrito, setCarrito] = useState<{ producto: any; cantidad: number; pagado: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

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

  async function handleVender() {
    if (!selected || carrito.length === 0) return
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const datos = carrito.map((c) => ({
        producto_id: c.producto.id,
        cantidad: c.cantidad,
        pagado: c.pagado,
      }))
      await api.ventas.agregarConsumos(selected.reserva_id, datos)
      setSuccess("Venta registrada exitosamente")
      setCarrito([])
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalCarrito = carrito.reduce((sum, c) => sum + c.producto.precio_unitario * c.cantidad, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Habitaciones Ocupadas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : ocupadas.length === 0 ? (
            <p className="text-gray-500">No hay habitaciones ocupadas</p>
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
                  onClick={() => { setSelected(h); setError(""); setSuccess("") }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Hab. {h.habitacion_numero} - {h.habitacion_tipo}</p>
                      <p className="text-sm text-gray-500">{h.huesped}</p>
                    </div>
                    <p className="text-xs text-gray-400">{h.codigo_confirmacion}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vender</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selected ? (
            <p className="text-sm text-gray-500">Selecciona una habitación</p>
          ) : (
            <>
              <div className="bg-blue-50 p-2 rounded-md text-sm">
                <p className="font-medium">Hab. {selected.habitacion_numero}</p>
                <p className="text-xs text-gray-600">{selected.huesped}</p>
              </div>

              {productos.length === 0 ? (
                <p className="text-sm text-gray-500">No hay productos. Ve a la pestaña Productos.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Productos</p>
                  <div className="max-h-60 overflow-auto space-y-1">
                    {productos.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.nombre}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(p.precio_unitario)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => addToCart(p, true)} className="p-1 text-green-600 hover:bg-green-100 rounded" title="Pagar ahora">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => addToCart(p, false)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Pagar luego">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  <div className="text-sm font-semibold text-right">Total: {formatCurrency(totalCarrito)}</div>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}

              <Button className="w-full" onClick={handleVender} disabled={carrito.length === 0 || saving}>
                {saving ? "Registrando..." : "Registrar Venta"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ProductosTab() {
  const [productos, setProductos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: "", descripcion: "", precio_unitario: 0, categoria: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const loadData = useCallback(() => {
    setLoading(true)
    api.ventas.listarProductos().then(setProductos).catch((err) => setError(err.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

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
    if (!form.nombre || form.precio_unitario <= 0) {
      setError("Nombre y precio requeridos")
      return
    }
    setSaving(true)
    setError("")
    try {
      if (editId) {
        await api.ventas.actualizarProducto(editId, form)
      } else {
        await api.ventas.crearProducto(form)
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
      loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const categorias = Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean)))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{productos.length} producto(s)</p>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo Producto</Button>
      </div>

      {error && <div className="p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}

      <Dialog open={showForm} onClose={() => setShowForm(false)} title={editId ? "Editar Producto" : "Nuevo Producto"}>
        <div className="space-y-3">
          {error && <div className="p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}
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
                <option value="Bebidas">Bebidas</option>
                <option value="Comida">Comida</option>
                <option value="Lavandería">Lavandería</option>
                <option value="Snacks">Snacks</option>
                <option value="Otros">Otros</option>
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


