"use client"

import { useEffect, useState, FormEvent } from "react"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, User } from "lucide-react"
import type { Huesped } from "@/types"

export default function HuespedesPage() {
  const [guests, setGuests] = useState<Huesped[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nombres: "", apellidos: "", tipo_documento: "DNI", numero_documento: "", telefono: "", email: "" })
  const [error, setError] = useState("")

  function loadGuests() {
    setLoading(true)
    api.huespedes.listar(search || undefined).then(setGuests).finally(() => setLoading(false))
  }

  useEffect(() => { loadGuests() }, [])

  useEffect(() => {
    if (!search) loadGuests()
  }, [search])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    try {
      await api.huespedes.crear(form)
      setShowForm(false)
      setForm({ nombres: "", apellidos: "", tipo_documento: "DNI", numero_documento: "", telefono: "", email: "" })
      loadGuests()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Huéspedes</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Huésped
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Buscar por nombre, documento o teléfono..." className="pl-9"
          value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadGuests()}
        />
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Nuevo Huésped</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {error && <div className="col-span-full p-3 text-sm bg-red-50 text-red-600 rounded-md">{error}</div>}
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre</label>
                <Input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Apellido</label>
                <Input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo Doc.</label>
                <select className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}>
                  <option value="DNI">DNI</option>
                  <option value="Pasaporte">Pasaporte</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">N° Documento</label>
                <Input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Teléfono</label>
                <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Correo</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
          ) : guests.length === 0 ? (
            <p className="p-6 text-gray-500">No se encontraron huéspedes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Nombre</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Documento</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Teléfono</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-500">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr key={g.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        {g.nombres} {g.apellidos}
                      </td>
                      <td className="p-4">{g.tipo_documento} {g.numero_documento}</td>
                      <td className="p-4">{g.telefono || "-"}</td>
                      <td className="p-4">{g.email || "-"}</td>
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
