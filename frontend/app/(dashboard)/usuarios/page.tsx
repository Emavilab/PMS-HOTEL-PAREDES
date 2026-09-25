"use client"

import { FormEvent, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge, statusBadge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2, Edit, Eye, EyeOff, Plus, Trash2, User } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import type { Usuario } from "@/types"

const roles = [
  { value: "admin", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "recepcionista", label: "Recepcionista" },
  { value: "limpieza", label: "Limpieza" },
]

const MODULOS = [
  { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { key: "recepcion", label: "Recepción", icon: "ClipboardCheck" },
  { key: "verificar_salida", label: "Verificar Salida", icon: "LogOut" },
  { key: "reservas", label: "Reservas", icon: "Calendar" },
  { key: "huespedes", label: "Huéspedes", icon: "Users" },
  { key: "habitaciones", label: "Habitaciones", icon: "BedDouble" },
  { key: "ventas", label: "Ventas", icon: "ShoppingCart" },
  { key: "housekeeping", label: "Housekeeping", icon: "Building2" },
  { key: "facturacion", label: "Facturación", icon: "Receipt" },
  { key: "caja", label: "Caja", icon: "DollarSign" },
  { key: "reportes", label: "Reportes", icon: "BarChart3" },
  { key: "usuarios", label: "Usuarios", icon: "Users" },
  { key: "auditoria", label: "Auditoría", icon: "Shield" },
  { key: "configuracion", label: "Configuración", icon: "Settings" },
]

const initialForm = {
  usuario: "",
  email: "",
  contrasena: "",
  nombre_completo: "",
  telefono: "",
  rol: "recepcionista",
  estado: "activo",
  permisos: [] as string[],
}

type UserForm = typeof initialForm

type ConfirmConfig = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  variant: "default" | "destructive"
  action: () => Promise<void>
}

type Tab = "datos" | "permisos"

export default function UsuariosPage() {
  const { user: currentUser } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formDialog, setFormDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<Usuario | null>(null)
  const [form, setForm] = useState<UserForm>(initialForm)
  const [activeTab, setActiveTab] = useState<Tab>("datos")
  const [error, setError] = useState("")
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null)
  const [success, setSuccess] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  function loadUsers() {
    setLoading(true)
    setError("")
    api.usuarios.listar()
      .then(setUsuarios)
      .catch((err) => setError(err.message || "No se pudieron cargar los usuarios"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function openForm(usuario?: Usuario) {
    setEditingUser(usuario || null)
    setActiveTab("datos")
    setShowPassword(false)
    setForm(usuario ? {
      usuario: usuario.usuario,
      email: usuario.email,
      contrasena: "",
      nombre_completo: usuario.nombre_completo,
      telefono: usuario.telefono || "",
      rol: usuario.rol,
      estado: usuario.estado,
      permisos: usuario.permisos || [],
    } : initialForm)
    setError("")
    setFormDialog(true)
  }

  function validateForm() {
    const email = form.email.trim()
    const username = form.usuario.trim()
    const name = form.nombre_completo.trim()
    const password = form.contrasena.trim()

    if (username.length < 3) return "El usuario debe tener al menos 3 caracteres"
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return "El usuario solo puede contener letras, numeros, guion y guion bajo"
    if (name.length < 3) return "El nombre completo debe tener al menos 3 caracteres"
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Ingresa un correo valido"
    if (!editingUser && password.length < 6) return "La contrasena debe tener al menos 6 caracteres"
    if (editingUser && password && password.length < 6) return "La nueva contrasena debe tener al menos 6 caracteres"
    if (!roles.some((role) => role.value === form.rol)) return "Selecciona un tipo de usuario valido"
    if (!['activo', 'inactivo'].includes(form.estado)) return "Selecciona un estado valido"
    return ""
  }

  function saveUser(e: FormEvent) {
    e.preventDefault()
    const validation = validateForm()
    if (validation) {
      setError(validation)
      return
    }

    setConfirm({
      open: true,
      title: editingUser ? "Confirmar cambios" : "Crear usuario",
      message: editingUser
        ? `Se actualizaran los datos de ${form.nombre_completo.trim()}.`
        : `Se creara el usuario ${form.nombre_completo.trim()} con tipo ${roleLabel(form.rol)}.`,
      confirmLabel: editingUser ? "Guardar cambios" : "Crear usuario",
      variant: "default",
      action: persistUser,
    })
  }

  async function persistUser() {
    setSaving(true)
    setError("")
    try {
      const payload: Record<string, string | null | string[]> = {
        usuario: form.usuario.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        nombre_completo: form.nombre_completo.trim(),
        telefono: form.telefono.trim() || null,
        rol: form.rol,
        estado: form.estado,
        permisos: form.permisos,
      }
      if (form.contrasena.trim()) payload.contrasena = form.contrasena.trim()
      if (!editingUser) delete payload.estado

      if (editingUser) await api.usuarios.actualizar(editingUser.id, payload)
      else await api.usuarios.crear(payload)

      setFormDialog(false)
      setSuccess(editingUser ? "Usuario actualizado correctamente" : "Usuario creado correctamente")
      loadUsers()
    } catch (err: any) {
      setError(err.message || "No se pudo guardar el usuario")
    } finally {
      setSaving(false)
    }
  }

  function deleteUser(usuario: Usuario) {
    setConfirm({
      open: true,
      title: "Eliminar usuario",
      message: `Esta accion eliminara a ${usuario.nombre_completo}. Si tiene movimientos asociados, el sistema pedira desactivarlo en su lugar.`,
      confirmLabel: "Eliminar usuario",
      variant: "destructive",
      action: async () => {
        setSaving(true)
        setError("")
        try {
          await api.usuarios.eliminar(usuario.id)
          setSuccess("Usuario eliminado correctamente")
          loadUsers()
        } catch (err: any) {
          setError(err.message || "No se pudo eliminar el usuario")
        } finally {
          setSaving(false)
        }
      },
    })
  }

  async function confirmAction() {
    if (!confirm) return
    await confirm.action()
    setConfirm(null)
  }

  if (currentUser?.rol !== "admin") {
    return <p className="text-gray-500">No tienes permisos para ver esta pagina.</p>
  }

  function renderDatosTab() {
    return (
      <div>
        <Field label="Nombre completo">
          <Input value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} />
        </Field>
        <Field label="Usuario">
          <Input value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value })} placeholder="Ej. recepcion" autoComplete="username" />
        </Field>
        <Field label="Correo">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Telefono">
            <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </Field>
          <Field label={editingUser ? "Nueva contrasena" : "Contrasena"}>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.contrasena}
                onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
                placeholder={editingUser ? "Dejar igual" : "Minimo 6 caracteres"}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-gray-500 hover:text-gray-800"
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                title={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tipo de usuario">
            <select className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </Field>
          {editingUser && (
            <Field label="Estado">
              <select className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </Field>
          )}
        </div>
      </div>
    )
  }

  function renderPermisosTab() {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500">
            Selecciona los módulos a los que este usuario tendrá acceso. Si eliges permisos, se aplicarán como restricción adicional al rol.
          </p>
          <span className="shrink-0 text-xs font-medium text-gray-500">
            {form.permisos.length} de {MODULOS.length} seleccionados
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, permisos: MODULOS.map((modulo) => modulo.key) })}>
            Seleccionar todos
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, permisos: [] })}>
            Limpiar permisos
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-96 overflow-y-auto p-2 border rounded-md">
          {MODULOS.map((modulo) => (
            <label key={modulo.key} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={form.permisos.includes(modulo.key)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    permisos: e.target.checked
                      ? [...form.permisos, modulo.key]
                      : form.permisos.filter((p) => p !== modulo.key),
                  })
                }
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm font-medium">{modulo.label}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-gray-500">Administra accesos, tipos de usuario y estado de cuenta.</p>
        </div>
        <Button onClick={() => openForm()}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo usuario
        </Button>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700" role="status">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Cargando usuarios...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-4 text-left text-sm font-medium text-gray-500">Usuario</th>
                    <th className="p-4 text-left text-sm font-medium text-gray-500">Usuario</th>
                    <th className="p-4 text-left text-sm font-medium text-gray-500">Correo</th>
                    <th className="p-4 text-left text-sm font-medium text-gray-500">Telefono</th>
                    <th className="p-4 text-left text-sm font-medium text-gray-500">Tipo</th>
                    <th className="p-4 text-left text-sm font-medium text-gray-500">Estado</th>
                    <th className="p-4 text-right text-sm font-medium text-gray-500">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{usuario.nombre_completo}</span>
                        </div>
                      </td>
                      <td className="p-4 font-medium">{usuario.usuario}</td>
                      <td className="p-4">{usuario.email}</td>
                      <td className="p-4">{usuario.telefono || "-"}</td>
                      <td className="p-4">{roleLabel(usuario.rol)}</td>
                      <td className="p-4"><Badge {...statusBadge(usuario.estado)} /></td>
                      <td className="p-4">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openForm(usuario)}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteUser(usuario)} disabled={usuario.id === currentUser.id || usuario.es_superadmin}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {usuarios.length === 0 && <p className="p-6 text-sm text-gray-500">No hay usuarios registrados.</p>}
            </div>
          )}
        </CardContent>
      </Card>

<Dialog open={formDialog} onClose={() => { setFormDialog(false); setActiveTab("datos") }} title={editingUser ? "Editar usuario" : "Nuevo usuario"}>
        <div className="space-y-4">
          <div className="flex border-b">
            <button
              type="button"
              className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "datos"
                  ? "border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("datos")}
            >
              Datos
            </button>
            <button
              type="button"
              className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "permisos"
                  ? "border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("permisos")}
            >
              Permisos
            </button>
          </div>

          <form className="space-y-4" onSubmit={saveUser}>
            {activeTab === "datos" && renderDatosTab()}
            {activeTab === "permisos" && renderPermisosTab()}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setFormDialog(false); setActiveTab("datos") }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {editingUser ? "Guardar cambios" : "Crear usuario"}
              </Button>
            </div>
          </form>
        </div>
        </Dialog>

      <ConfirmModal config={confirm} loading={saving} onCancel={() => setConfirm(null)} onConfirm={confirmAction} />
      <SuccessModal message={success} onClose={() => setSuccess("")} />
    </div>
)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-sm font-medium text-gray-700"><span>{label}</span>{children}</label>
}

function ConfirmModal({
  config,
  loading,
  onCancel,
  onConfirm,
}: {
  config: ConfirmConfig | null
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const destructive = config?.variant === "destructive"

  return (
    <Dialog open={!!config?.open} onClose={onCancel} title={config?.title || "Confirmar accion"} className="max-w-md">
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${destructive ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
            {destructive ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-sm leading-6 text-gray-600">{config?.message}</p>
            <p className="mt-2 text-xs text-gray-500">Revisa la informacion antes de continuar.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button type="button" variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={loading}>
            {loading ? "Procesando..." : config?.confirmLabel || "Confirmar"}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function SuccessModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <Dialog open={!!message} onClose={onClose} title="Operacion exitosa" className="max-w-sm">
      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm leading-6 text-gray-600">{message}</p>
        </div>
        <div className="flex justify-end border-t pt-4">
          <Button type="button" onClick={onClose}>Aceptar</Button>
        </div>
      </div>
    </Dialog>
  )
}
function roleLabel(role: string) { return roles.find((item) => item.value === role)?.label || role }
