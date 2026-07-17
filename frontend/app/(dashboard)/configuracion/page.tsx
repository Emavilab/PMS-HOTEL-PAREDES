"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Settings, Upload, Trash2, Save } from "lucide-react"

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
    </div>
  )
}
