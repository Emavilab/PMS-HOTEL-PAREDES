"use client"

import { useState, FormEvent, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2 } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [logoUrl, setLogoUrl] = useState("")
  const [fondoUrl, setFondoUrl] = useState("")
  const [hotelName, setHotelName] = useState("Hotel Paredes")
  const [erroresCampo, setErroresCampo] = useState({ email: "", password: "" })
  const { login } = useAuth()
  const router = useRouter()

  useEffect(() => {
    api.configuracion.obtener().then((cfg) => {
      if (cfg.logo_url) setLogoUrl(cfg.logo_url)
      if (cfg.login_fondo_url) setFondoUrl(cfg.login_fondo_url)
      if (cfg.nombre) setHotelName(cfg.nombre)
    }).catch(() => {})
  }, [])

  function validar(): boolean {
    const errs = { email: "", password: "" }
    if (!email.trim()) {
      errs.email = "El correo electrónico es requerido"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Ingrese un correo electrónico válido"
    }
    if (!password) {
      errs.password = "La contraseña es requerida"
    } else if (password.length < 4) {
      errs.password = "La contraseña debe tener al menos 4 caracteres"
    }
    setErroresCampo(errs)
    return !errs.email && !errs.password
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess("")
    setErroresCampo({ email: "", password: "" })

    if (!validar()) return

    setLoading(true)
    try {
      await login(email, password)
      setSuccess("Inicio de sesión exitoso. Redirigiendo...")
      setTimeout(() => router.push("/"), 800)
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative overflow-hidden">
      {fondoUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${API_URL}${fondoUrl})` }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      <Card className="w-full max-w-md mx-4 relative z-10">
        <CardHeader className="text-center space-y-4">
          {logoUrl && (
            <div className="flex justify-center">
              <img src={`${API_URL}${logoUrl}`} alt={hotelName} className="h-24 w-auto object-contain" />
            </div>
          )}
          <CardTitle className="text-2xl">{hotelName}</CardTitle>
          <CardDescription>Sistema de Gestión Hotelera</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm bg-red-50 text-red-600 rounded-md border border-red-200">
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
              <label className="text-sm font-medium">Correo electrónico</label>
              <Input
                type="email"
                placeholder="admin@hotel.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErroresCampo({ ...erroresCampo, email: "" }) }}
                className={erroresCampo.email ? "border-red-400" : ""}
                required
              />
              {erroresCampo.email && <p className="text-xs text-red-500">{erroresCampo.email}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contraseña</label>
              <Input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErroresCampo({ ...erroresCampo, password: "" }) }}
                className={erroresCampo.password ? "border-red-400" : ""}
                required
              />
              {erroresCampo.password && <p className="text-xs text-red-500">{erroresCampo.password}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
