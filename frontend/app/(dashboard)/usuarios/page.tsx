"use client"

import { useEffect, useState, FormEvent } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge, statusBadge } from "@/components/ui/badge"
import { Plus, User } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import type { Usuario } from "@/types"

export default function UsuariosPage() {
  const { user: currentUser } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: "", contrasena: "", nombre_completo: "", rol: "recepcionista" })
  const [error, setError] = useState("")

  function loadUsers() {
    setLoading(true)
    api.usuarios.listar().then(setUsuarios).finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    try {
      await api.usuarios.crear(form)
      setShowForm(false)
      setForm({ email: "", contrasena: "", nombre_completo: "", rol: "recepcionista" })
      loadUsers()
    } catch (err: any) { setError(err.message) }
  }

  if (currentUser?.rol !== "admin") {
    return <p className="text-gray-500">No tienes permisos para ver esta página.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Usuario
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Nuevo Usuario</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {error && <div className="col-span-full p-3 text-sm bg-red-50 text-red-600 rounded-md">{error}</div>}
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre Completo</label>
                <Input value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Correo</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contraseña</label>
                <Input type="password" value={form.contrasena} onChange={(e) => setForm({ ...form, contrasena: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rol</label>
                <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  <option value="admin">Administrador</option>
                  <option value="gerente">Gerente</option>
                  <option value="recepcionista">Recepcionista</option>
                </select>
              </div>
              <div className="col-span-full flex gap-4">
                <Button type="submit">Guardar</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-gray-500">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Usuario</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Correo</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Rol</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        {u.nombre_completo}
                      </td>
                      <td className="p-4">{u.email}</td>
                      <td className="p-4 capitalize">{u.rol}</td>
                      <td className="p-4"><Badge {...statusBadge(u.estado)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
