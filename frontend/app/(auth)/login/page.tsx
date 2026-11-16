"use client"

/**
 * Pantalla de autenticación del PMS.
 *
 * Conserva únicamente el identificador cuando el usuario activa
 * "Recordarme"; la contraseña se entrega al hook de autenticación y no se
 * persiste en el navegador.
 */
import { useState, FormEvent, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Eye, EyeOff, LockKeyhole, LogIn, UserRound } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function LoginPage() {
  const [identificador, setIdentificador] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [recordar, setRecordar] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [logoUrl, setLogoUrl] = useState("")
  const [fondoUrl, setFondoUrl] = useState("")
  const [hotelName, setHotelName] = useState("Hotel Paredes")
  const [erroresCampo, setErroresCampo] = useState({ identificador: "", password: "" })
  const { login } = useAuth()
  const router = useRouter()

  // Inactividad redirige al login con un motivo para explicar la expulsión.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("motivo") === "inactividad") {
      setError("Tu sesión se cerró por inactividad. Inicia sesión nuevamente.")
    }
  }, [])

  // Carga preferencias no sensibles del dispositivo y la identidad visual del hotel.
  useEffect(() => {
    const savedIdentifier = localStorage.getItem("rememberedIdentifier")
    if (savedIdentifier) {
      setIdentificador(savedIdentifier)
      setRecordar(true)
    }
    api.configuracion.obtener().then((cfg) => {
      if (cfg.logo_url) setLogoUrl(cfg.logo_url)
      if (cfg.login_fondo_url) setFondoUrl(cfg.login_fondo_url)
      if (cfg.nombre) setHotelName(cfg.nombre)
    }).catch(() => {})
  }, [])

  /** Valida los campos antes de realizar una petición al backend. */
  function validar(): boolean {
    const errs = { identificador: "", password: "" }
    if (!identificador.trim()) {
      errs.identificador = "El correo o usuario es requerido"
    }
    if (!password) {
      errs.password = "La contraseña es requerida"
    } else if (password.length < 4) {
      errs.password = "La contraseña debe tener al menos 4 caracteres"
    }
    setErroresCampo(errs)
    return !errs.identificador && !errs.password
  }

  /**
   * Ejecuta el login y dirige cada rol a su pantalla inicial.
   *
   * El personal de limpieza comienza en Housekeeping; los demás roles llegan
   * al dashboard general y reciben sus permisos desde el backend.
   */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    setErroresCampo({ identificador: "", password: "" })

    if (!validar()) return

    setLoading(true)
    try {
      const usuario = await login(identificador, password, recordar)
      if (recordar) localStorage.setItem("rememberedIdentifier", identificador.trim())
      else localStorage.removeItem("rememberedIdentifier")
      setSuccess("Inicio de sesión exitoso. Redirigiendo...")
      setTimeout(() => router.push(usuario.rol === "limpieza" ? "/housekeeping" : "/"), 800)
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.22),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(37,99,235,0.18),_transparent_35%)]" />
      {fondoUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${API_URL}${fondoUrl})` }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      <Card className="relative z-10 w-full max-w-md border-white/20 bg-white/95 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          {logoUrl && (
            <div className="flex justify-center">
              <img src={`${API_URL}${logoUrl}`} alt={hotelName} className="h-24 w-auto object-contain" />
            </div>
          )}
          <CardTitle className="text-2xl font-semibold tracking-tight text-slate-900">{hotelName}</CardTitle>
          <CardDescription>Ingresa a tu espacio de trabajo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="instant-error flex items-center gap-2 p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 text-sm bg-green-50 text-green-600 rounded-md border border-green-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {success}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Correo o usuario</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="admin@hotel.com o admin"
                  value={identificador}
                  onChange={(e) => { setIdentificador(e.target.value); setErroresCampo({ ...erroresCampo, identificador: "" }) }}
                  className={`pl-10 ${erroresCampo.identificador ? "border-red-400" : ""}`}
                  autoComplete="username"
                  required
                />
              </div>
              {erroresCampo.identificador && <p className="text-xs text-red-500">{erroresCampo.identificador}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Contraseña</label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErroresCampo({ ...erroresCampo, password: "" }) }}
                  className={`pl-10 pr-11 ${erroresCampo.password ? "border-red-400" : ""}`}
                  autoComplete="current-password"
                  required
                />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-slate-400 hover:text-slate-700" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {erroresCampo.password && <p className="text-xs text-red-500">{erroresCampo.password}</p>}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Recordarme en este dispositivo
            </label>
            <Button type="submit" className="w-full bg-blue-600 shadow-lg shadow-blue-600/20 hover:bg-blue-700" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
