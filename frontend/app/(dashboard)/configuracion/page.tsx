"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import type { Piso } from "@/types"
import { Settings, Upload, Trash2, Save, CreditCard, Pencil, Plus, Layers3, Tags } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function ConfiguracionPage() {
  const { user: currentUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [form, setForm] = useState({
    nombre: "Hotel Paredes",
    direccion: "",
    telefono: "",
    email: "",
    rtn: "",
    impuesto: 15,
    moneda: "HNL",
  })
  const [logoUrl, setLogoUrl] = useState("")
  const [fondoUrl, setFondoUrl] = useState("")
  const [metodosPago, setMetodosPago] = useState<any[]>([])
  const [metodosLoading, setMetodosLoading] = useState(true)
  const [metodoDialogOpen, setMetodoDialogOpen] = useState(false)
  const [metodoEditando, setMetodoEditando] = useState<any | null>(null)
  const [metodoForm, setMetodoForm] = useState({ nombre: "", descripcion: "", activo: true })
  const [pisos, setPisos] = useState<Piso[]>([])
  const [pisosLoading, setPisosLoading] = useState(true)
  const [pisoDialogOpen, setPisoDialogOpen] = useState(false)
  const [pisoEditando, setPisoEditando] = useState<Piso | null>(null)
  const [pisoForm, setPisoForm] = useState({ nombre: "", descripcion: "", estado: "ACTIVO" })
  const [categorias, setCategorias] = useState<any[]>([])
  const [categoriasLoading, setCategoriasLoading] = useState(true)
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false)
  const [categoriaEditando, setCategoriaEditando] = useState<any | null>(null)
  const [categoriaForm, setCategoriaForm] = useState({ nombre: "", descripcion: "", activo: true })
  const [seccionActiva, setSeccionActiva] = useState<"hotel" | "pagos" | "pisos" | "categorias">("hotel")

  useEffect(() => {
    api.configuracion.obtener()
      .then((cfg) => {
        setForm({ nombre: cfg.nombre, direccion: cfg.direccion || "", telefono: cfg.telefono || "", email: cfg.email || "", rtn: cfg.rtn || "", impuesto: cfg.impuesto, moneda: cfg.moneda || "HNL" })
        setLogoUrl(cfg.logo_url || "")
        setFondoUrl(cfg.login_fondo_url || "")
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (currentUser?.rol !== "admin") return
    api.metodosPago.listar()
      .then(setMetodosPago)
      .catch((err) => setError(err.message))
      .finally(() => setMetodosLoading(false))
  }, [currentUser?.rol])

  useEffect(() => {
    if (currentUser?.rol !== "admin") return
    api.ventas.listarTodasCategorias()
      .then(setCategorias)
      .catch((err) => setError(err.message))
      .finally(() => setCategoriasLoading(false))
  }, [currentUser?.rol])

  useEffect(() => {
    if (currentUser?.rol !== "admin") return
    api.habitaciones.listarPisos()
      .then(setPisos)
      .catch((err) => setError(err.message))
      .finally(() => setPisosLoading(false))
  }, [currentUser?.rol])

  function abrirMetodoDialog(metodo?: any) {
    setMetodoEditando(metodo || null)
    setMetodoForm({
      nombre: metodo?.nombre || "",
      descripcion: metodo?.descripcion || "",
      activo: metodo?.activo ?? true,
    })
    setMetodoDialogOpen(true)
  }

  async function handleGuardarMetodo(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      if (metodoEditando) {
        const actualizado = await api.metodosPago.actualizar(metodoEditando.id, metodoForm)
        setMetodosPago((actuales) => actuales.map((metodo) => metodo.id === actualizado.id ? actualizado : metodo))
        setSuccess("Método de pago actualizado")
      } else {
        const creado = await api.metodosPago.crear(metodoForm)
        setMetodosPago((actuales) => [...actuales, creado])
        setSuccess("Método de pago creado")
      }
      setMetodoDialogOpen(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminarMetodo(metodo: any) {
    if (!window.confirm(`¿Eliminar el método de pago "${metodo.nombre}"?`)) return
    setError("")
    try {
      await api.metodosPago.eliminar(metodo.id)
      setMetodosPago((actuales) => actuales.filter((item) => item.id !== metodo.id))
      setSuccess("Método de pago eliminado")
    } catch (err: any) {
      setError(err.message)
    }
  }

  function abrirPisoDialog(piso?: Piso) {
    setPisoEditando(piso || null)
    setPisoForm({
      nombre: piso?.nombre || "",
      descripcion: piso?.descripcion || "",
      estado: piso?.estado || "ACTIVO",
    })
    setPisoDialogOpen(true)
  }

  async function handleGuardarPiso(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      if (pisoEditando) {
        const actualizado = await api.habitaciones.actualizarPiso(pisoEditando.id, {
          nombre: pisoForm.nombre,
          descripcion: pisoForm.descripcion || null,
          estado: pisoForm.estado,
        })
        setPisos((actuales) => actuales.map((piso) => piso.id === actualizado.id ? actualizado : piso))
        setSuccess("Piso actualizado")
      } else {
        const creado = await api.habitaciones.crearPiso({
          nombre: pisoForm.nombre,
          descripcion: pisoForm.descripcion || null,
          estado: pisoForm.estado,
        })
        setPisos((actuales) => [...actuales, creado].sort((a, b) => a.nombre.localeCompare(b.nombre)))
        setSuccess("Piso creado")
      }
      setPisoDialogOpen(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminarPiso(piso: Piso) {
    if (!window.confirm(`¿Eliminar el piso "${piso.nombre}"?`)) return
    setError("")
    try {
      await api.habitaciones.eliminarPiso(piso.id)
      setPisos((actuales) => actuales.filter((item) => item.id !== piso.id))
      setSuccess("Piso eliminado")
    } catch (err: any) {
      setError(err.message)
    }
  }

  function abrirCategoriaDialog(categoria?: any) {
    setCategoriaEditando(categoria || null)
    setCategoriaForm({ nombre: categoria?.nombre || "", descripcion: categoria?.descripcion || "", activo: categoria?.activo ?? true })
    setCategoriaDialogOpen(true)
  }

  async function handleGuardarCategoria(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const datos = { ...categoriaForm, descripcion: categoriaForm.descripcion || null }
      if (categoriaEditando) {
        const actualizado = await api.ventas.actualizarCategoria(categoriaEditando.id, datos)
        setCategorias((actuales) => actuales.map((item) => item.id === actualizado.id ? actualizado : item))
        setSuccess("Categoría actualizada")
      } else {
        const creada = await api.ventas.crearCategoria(datos)
        setCategorias((actuales) => [...actuales, creada].sort((a, b) => a.nombre.localeCompare(b.nombre)))
        setSuccess("Categoría creada")
      }
      setCategoriaDialogOpen(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminarCategoria(categoria: any) {
    if (!window.confirm(`¿Desactivar la categoría "${categoria.nombre}"?`)) return
    setError("")
    try {
      await api.ventas.eliminarCategoria(categoria.id)
      setCategorias((actuales) => actuales.map((item) => item.id === categoria.id ? { ...item, activo: false } : item))
      setSuccess("Categoría desactivada")
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleGuardar() {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      await api.configuracion.actualizar(form)
      setSuccess("Configuración guardada correctamente")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSubirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendo(true)
    setError("")
    try {
      const cfg = await api.configuracion.subirLogo(archivo)
      setLogoUrl(cfg.logo_url)
      setSuccess("Logo actualizado")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  async function handleEliminarLogo() {
    setSubiendo(true)
    setError("")
    try {
      const cfg = await api.configuracion.eliminarLogo()
      setLogoUrl(cfg.logo_url)
      setSuccess("Logo eliminado")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  async function handleSubirFondo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendo(true)
    setError("")
    try {
      const cfg = await api.configuracion.subirFondoLogin(archivo)
      setFondoUrl(cfg.login_fondo_url)
      setSuccess("Fondo de login actualizado")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  async function handleEliminarFondo() {
    setSubiendo(true)
    setError("")
    try {
      const cfg = await api.configuracion.eliminarFondoLogin()
      setFondoUrl(cfg.login_fondo_url)
      setSuccess("Fondo de login eliminado")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubiendo(false)
    }
  }

  if (currentUser?.rol !== "admin") {
    return <p className="text-gray-500">No tienes permisos para ver esta página.</p>
  }

  if (loading) return <p className="text-gray-500">Cargando configuración...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Settings className="h-6 w-6" /> Configuración del Hotel
      </h1>

      {error && <div className="p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">{error}</div>}
      {success && <div className="p-3 text-sm bg-green-50 text-green-600 rounded-md border border-green-200">{success}</div>}

      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setSeccionActiva("hotel")}
          className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${seccionActiva === "hotel" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
        >
          Configuración del hotel
        </button>
        <button
          type="button"
          onClick={() => setSeccionActiva("pagos")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${seccionActiva === "pagos" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
        >
          <CreditCard className="h-4 w-4" /> Métodos de pago
        </button>
        <button
          type="button"
          onClick={() => setSeccionActiva("pisos")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${seccionActiva === "pisos" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
        >
          <Layers3 className="h-4 w-4" /> Pisos
        </button>
        <button
          type="button"
          onClick={() => setSeccionActiva("categorias")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${seccionActiva === "categorias" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
        >
          <Tags className="h-4 w-4" /> Categorías
        </button>
      </div>

      {seccionActiva === "hotel" && <>
      <Card>
        <CardHeader><CardTitle className="text-lg">Información General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre del Hotel</label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">RTN / RUC</label>
              <Input value={form.rtn} onChange={(e) => setForm({ ...form, rtn: e.target.value })} placeholder="Número de identificación fiscal" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Teléfono</label>
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Teléfono del hotel" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Correo electrónico</label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@hotel.com" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Impuesto (%)</label>
              <Input type="number" value={form.impuesto} onChange={(e) => setForm({ ...form, impuesto: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Moneda</label>
              <select
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm bg-white"
                value={form.moneda}
                onChange={(e) => setForm({ ...form, moneda: e.target.value })}
              >
                <option value="HNL">HNL (Lempira)</option>
                <option value="USD">USD (Dólar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="MXN">MXN (Peso Mexicano)</option>
                <option value="GTQ">GTQ (Quetzal)</option>
                <option value="NIO">NIO (Córdoba)</option>
                <option value="CRC">CRC (Colón)</option>
                <option value="COP">COP (Peso Colombiano)</option>
                <option value="PEN">PEN (Sol)</option>
                <option value="ARS">ARS (Peso Argentino)</option>
                <option value="CLP">CLP (Peso Chileno)</option>
                <option value="BRL">BRL (Real)</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Dirección</label>
            <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Dirección del hotel" />
          </div>
          <Button onClick={handleGuardar} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Logo del Hotel</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {logoUrl ? (
            <div className="flex items-center gap-4">
              <img src={`${API_URL}${logoUrl}`} alt="Logo" className="h-20 w-auto object-contain border rounded-md" />
              <Button variant="outline" onClick={handleEliminarLogo} disabled={subiendo}>
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No hay logo configurado</p>
          )}
          <div>
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
              <Upload className="h-4 w-4" /> {subiendo ? "Subiendo..." : "Subir Logo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSubirLogo} disabled={subiendo} />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Fondo de Pantalla - Inicio de Sesión</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">Esta imagen se mostrará como fondo en la pantalla de inicio de sesión con opacidad reducida.</p>
          {fondoUrl ? (
            <div className="space-y-3">
              <div className="relative h-40 w-full rounded-md overflow-hidden border">
                <img src={`${API_URL}${fondoUrl}`} alt="Fondo login" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">Vista previa con opacidad</span>
                </div>
              </div>
              <Button variant="outline" onClick={handleEliminarFondo} disabled={subiendo}>
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar Fondo
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No hay fondo configurado</p>
          )}
          <div>
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
              <Upload className="h-4 w-4" /> {subiendo ? "Subiendo..." : "Subir Fondo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSubirFondo} disabled={subiendo} />
            </label>
          </div>
        </CardContent>
      </Card>
      </>}

      {seccionActiva === "pagos" && <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><CreditCard className="h-5 w-5" /> Métodos de pago</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Administra las formas de pago disponibles en el hotel.</p>
          </div>
          <Button size="sm" onClick={() => abrirMetodoDialog()}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo método
          </Button>
        </CardHeader>
        <CardContent>
          {metodosLoading ? (
            <p className="text-sm text-gray-500">Cargando métodos de pago...</p>
          ) : metodosPago.length === 0 ? (
            <p className="text-sm text-gray-500">No hay métodos de pago configurados.</p>
          ) : (
            <div className="divide-y border rounded-md">
              {metodosPago.map((metodo) => (
                <div key={metodo.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{metodo.nombre}</p>
                    <p className="text-sm text-gray-500 truncate">{metodo.descripcion || "Sin descripción"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-1">Activo</span>
                    <Button variant="outline" size="icon" onClick={() => abrirMetodoDialog(metodo)} title="Editar método">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleEliminarMetodo(metodo)} title="Eliminar método">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </>}

      {seccionActiva === "pisos" && <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><Layers3 className="h-5 w-5" /> Configuración de pisos</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Administra los pisos disponibles para asignar habitaciones.</p>
          </div>
          <Button size="sm" onClick={() => abrirPisoDialog()}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo piso
          </Button>
        </CardHeader>
        <CardContent>
          {pisosLoading ? (
            <p className="text-sm text-gray-500">Cargando pisos...</p>
          ) : pisos.length === 0 ? (
            <p className="text-sm text-gray-500">No hay pisos configurados.</p>
          ) : (
            <div className="divide-y border rounded-md">
              {pisos.map((piso) => (
                <div key={piso.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{piso.nombre}</p>
                    <p className="text-sm text-gray-500 truncate">{piso.descripcion || "Sin descripción"}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs rounded-full px-2 py-1 ${piso.estado === "ACTIVO" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {piso.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => abrirPisoDialog(piso)} title="Editar piso">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleEliminarPiso(piso)} title="Eliminar piso">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>}

      {seccionActiva === "categorias" && <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><Tags className="h-5 w-5" /> Categorías de productos</CardTitle>
            <p className="text-sm text-gray-500 mt-1">Administra las categorías disponibles para tus productos y ventas.</p>
          </div>
          <Button size="sm" onClick={() => abrirCategoriaDialog()}><Plus className="h-4 w-4 mr-2" /> Nueva categoría</Button>
        </CardHeader>
        <CardContent>
          {categoriasLoading ? <p className="text-sm text-gray-500">Cargando categorías...</p> : categorias.length === 0 ? <p className="text-sm text-gray-500">No hay categorías configuradas.</p> : (
            <div className="divide-y rounded-md border">
              {categorias.map((categoria) => <div key={categoria.id} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="font-medium">{categoria.nombre}</p><p className="truncate text-sm text-gray-500">{categoria.descripcion || "Sin descripción"}</p></div><div className="flex shrink-0 items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs ${categoria.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{categoria.activo ? "Activa" : "Inactiva"}</span><Button variant="outline" size="icon" onClick={() => abrirCategoriaDialog(categoria)} title="Editar categoría"><Pencil className="h-4 w-4" /></Button><Button variant="destructive" size="icon" onClick={() => handleEliminarCategoria(categoria)} disabled={!categoria.activo} title="Desactivar categoría"><Trash2 className="h-4 w-4" /></Button></div></div>)}
            </div>
          )}
        </CardContent>
      </Card>}

      <Dialog
        open={metodoDialogOpen}
        onClose={() => setMetodoDialogOpen(false)}
        title={metodoEditando ? "Editar método de pago" : "Nuevo método de pago"}
      >
        <form onSubmit={handleGuardarMetodo} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre</label>
            <Input required maxLength={50} value={metodoForm.nombre} onChange={(e) => setMetodoForm({ ...metodoForm, nombre: e.target.value })} placeholder="Ej. Tarjeta de crédito" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción</label>
            <Input value={metodoForm.descripcion} onChange={(e) => setMetodoForm({ ...metodoForm, descripcion: e.target.value })} placeholder="Información adicional" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={metodoForm.activo} onChange={(e) => setMetodoForm({ ...metodoForm, activo: e.target.checked })} />
            Método activo
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setMetodoDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={pisoDialogOpen}
        onClose={() => setPisoDialogOpen(false)}
        title={pisoEditando ? "Editar piso" : "Nuevo piso"}
      >
        <form onSubmit={handleGuardarPiso} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre</label>
            <Input required maxLength={50} value={pisoForm.nombre} onChange={(e) => setPisoForm({ ...pisoForm, nombre: e.target.value })} placeholder="Ej. Primer piso" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción</label>
            <Input value={pisoForm.descripcion} onChange={(e) => setPisoForm({ ...pisoForm, descripcion: e.target.value })} placeholder="Información adicional" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Estado</label>
            <select className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={pisoForm.estado} onChange={(e) => setPisoForm({ ...pisoForm, estado: e.target.value })}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPisoDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={categoriaDialogOpen} onClose={() => setCategoriaDialogOpen(false)} title={categoriaEditando ? "Editar categoría" : "Nueva categoría"}>
        <form onSubmit={handleGuardarCategoria} className="space-y-4">
          <div className="space-y-2"><label className="text-sm font-medium">Nombre</label><Input required maxLength={100} value={categoriaForm.nombre} onChange={(e) => setCategoriaForm({ ...categoriaForm, nombre: e.target.value })} placeholder="Ej. Bebidas" /></div>
          <div className="space-y-2"><label className="text-sm font-medium">Descripción</label><Input value={categoriaForm.descripcion} onChange={(e) => setCategoriaForm({ ...categoriaForm, descripcion: e.target.value })} placeholder="Información adicional" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categoriaForm.activo} onChange={(e) => setCategoriaForm({ ...categoriaForm, activo: e.target.checked })} /> Categoría activa</label>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setCategoriaDialogOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button></div>
        </form>
      </Dialog>
    </div>
  )
}
