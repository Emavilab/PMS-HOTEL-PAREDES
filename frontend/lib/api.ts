const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function obtenerToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token")
  }
  return null
}

async function peticion<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = obtenerToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = Array.isArray(error.detail)
      ? error.detail.map((e: any) => e.msg || e.message).join(" | ")
      : error.detail || `Error ${res.status}`
    throw new Error(msg)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json()
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      peticion<{ access_token: string; usuario: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, contrasena: password }),
      }),
    verificar: (token: string) =>
      peticion<any>("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
  },
  usuarios: {
    listar: () => peticion<any[]>("/usuarios"),
    crear: (datos: any) =>
      peticion<any>("/usuarios", { method: "POST", body: JSON.stringify(datos) }),
    actualizar: (id: string, datos: any) =>
      peticion<any>(`/usuarios/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    obtener: (id: string) => peticion<any>(`/usuarios/${id}`),
  },
  tiposHabitacion: {
    listar: () => peticion<any[]>("/tipos-habitacion"),
    crear: (datos: any) =>
      peticion<any>("/tipos-habitacion", { method: "POST", body: JSON.stringify(datos) }),
    actualizar: (id: string, datos: any) =>
      peticion<any>(`/tipos-habitacion/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
  },
  habitaciones: {
    listar: () => peticion<any[]>("/habitaciones"),
    crear: (datos: any) =>
      peticion<any>("/habitaciones", { method: "POST", body: JSON.stringify(datos) }),
    actualizarEstado: (id: string, datos: any) =>
      peticion<any>(`/habitaciones/${id}/estado`, { method: "PATCH", body: JSON.stringify(datos) }),
  },
  huespedes: {
    listar: (busqueda?: string) =>
      peticion<any[]>(`/huespedes${busqueda ? `?search=${busqueda}` : ""}`),
    crear: (datos: any) =>
      peticion<any>("/huespedes", { method: "POST", body: JSON.stringify(datos) }),
    obtener: (id: string) => peticion<any>(`/huespedes/${id}`),
    actualizar: (id: string, datos: any) =>
      peticion<any>(`/huespedes/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    historial: (id: string) => peticion<any[]>(`/huespedes/${id}/historial`),
  },
  reservas: {
    listar: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : ""
      return peticion<any[]>(`/reservas${qs}`)
    },
    crear: (datos: any) =>
      peticion<any>("/reservas", { method: "POST", body: JSON.stringify(datos) }),
    obtener: (id: string) => peticion<any>(`/reservas/${id}`),
    actualizar: (id: string, datos: any) =>
      peticion<any>(`/reservas/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    cancelar: (id: string) =>
      peticion<any>(`/reservas/${id}/cancelar`, { method: "POST" }),
    eliminar: (id: string) =>
      peticion<void>(`/reservas/${id}`, { method: "DELETE" }),
    checkIn: (id: string, habitacionId: string) =>
      peticion<any>(`/reservas/${id}/check-in`, {
        method: "POST",
        body: JSON.stringify({ habitacion_id: habitacionId }),
      }),
    checkOut: (id: string) =>
      peticion<any>(`/reservas/${id}/check-out`, { method: "POST" }),
  },
  disponibilidad: {
    verificar: (entrada: string, salida: string, tipoHabitacionId?: string) => {
      let params = `fecha_entrada=${entrada}&fecha_salida=${salida}`
      if (tipoHabitacionId) params += `&tipo_habitacion_id=${tipoHabitacionId}`
      return peticion<any[]>(`/disponibilidad?${params}`)
    },
  },
  limpieza: {
    listar: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : ""
      return peticion<any[]>(`/tareas-limpieza${qs}`)
    },
    crear: (datos: any) =>
      peticion<any>("/tareas-limpieza", { method: "POST", body: JSON.stringify(datos) }),
    actualizar: (id: string, datos: any) =>
      peticion<any>(`/tareas-limpieza/${id}`, { method: "PATCH", body: JSON.stringify(datos) }),
  },
  facturacion: {
    agregarCargo: (reservaId: string, datos: any) =>
      peticion<any>(`/reservas/${reservaId}/cargos`, {
        method: "POST",
        body: JSON.stringify(datos),
      }),
    listarCargos: (reservaId: string) =>
      peticion<any[]>(`/reservas/${reservaId}/cargos`),
    agregarPago: (reservaId: string, datos: any) =>
      peticion<any>(`/reservas/${reservaId}/pagos`, {
        method: "POST",
        body: JSON.stringify(datos),
      }),
    listarPagos: (reservaId: string) =>
      peticion<any[]>(`/reservas/${reservaId}/pagos`),
    obtenerFolio: (reservaId: string) =>
      peticion<any>(`/reservas/${reservaId}/folio`),
  },
  caja: {
    abrir: (montoApertura: number) =>
      peticion<any>("/sesiones-caja/abrir", {
        method: "POST",
        body: JSON.stringify({ monto_apertura: montoApertura }),
      }),
    cerrar: (id: string, montoDeclarado: number) =>
      peticion<any>(`/sesiones-caja/${id}/cerrar`, {
        method: "POST",
        body: JSON.stringify({ monto_declarado: montoDeclarado }),
      }),
    listar: () => peticion<any[]>("/sesiones-caja"),
    activa: () => peticion<any>("/sesiones-caja/activa"),
  },
  reportes: {
    ocupacion: (fechaInicio: string, fechaFin: string) =>
      peticion<any[]>(`/reportes/ocupacion?start_date=${fechaInicio}&end_date=${fechaFin}`),
    ingresos: (fechaInicio: string, fechaFin: string) =>
      peticion<any[]>(`/reportes/ingresos?start_date=${fechaInicio}&end_date=${fechaFin}`),
    llegadas: () => peticion<any[]>("/reportes/llegadas"),
    salidas: () => peticion<any[]>("/reportes/salidas"),
  },
  auditoria: {
    listar: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : ""
      return peticion<any[]>(`/registros-auditoria${qs}`)
    },
  },
  configuracion: {
    obtener: () => peticion<any>("/configuracion"),
    actualizar: (datos: any) =>
      peticion<any>("/configuracion", { method: "PUT", body: JSON.stringify(datos) }),
    subirLogo: (archivo: File) => {
      const formData = new FormData()
      formData.append("archivo", archivo)
      const token = obtenerToken()
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`
      return fetch(`${API_URL}/configuracion/logo`, {
        method: "POST",
        headers,
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const error = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(error.detail || `Error ${res.status}`)
        }
        return res.json()
      })
    },
    eliminarLogo: () =>
      peticion<any>("/configuracion/logo", { method: "DELETE" }),
    subirFondoLogin: (archivo: File) => {
      const formData = new FormData()
      formData.append("archivo", archivo)
      const token = obtenerToken()
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`
      return fetch(`${API_URL}/configuracion/fondo-login`, {
        method: "POST",
        headers,
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const error = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(error.detail || `Error ${res.status}`)
        }
        return res.json()
      })
    },
    eliminarFondoLogin: () =>
      peticion<any>("/configuracion/fondo-login", { method: "DELETE" }),
  },
  ventas: {
    listarProductos: (categoria?: string) =>
      peticion<any[]>(`/ventas/productos${categoria ? `?categoria=${categoria}` : ""}`),
    crearProducto: (datos: any) =>
      peticion<any>("/ventas/productos", { method: "POST", body: JSON.stringify(datos) }),
    actualizarProducto: (id: string, datos: any) =>
      peticion<any>(`/ventas/productos/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    eliminarProducto: (id: string) =>
      peticion<any>(`/ventas/productos/${id}`, { method: "DELETE" }),
    ocupadas: () => peticion<any[]>("/ventas/ocupadas"),
    detalleOcupacion: (habitacionId: string) =>
      peticion<any>(`/ventas/habitaciones/${habitacionId}/ocupacion`),
    agregarConsumos: (reservaId: string, datos: any[]) =>
      peticion<any[]>(`/ventas/reservas/${reservaId}/consumos`, {
        method: "POST", body: JSON.stringify(datos),
      }),
    listarConsumos: (reservaId: string) =>
      peticion<any[]>(`/ventas/reservas/${reservaId}/consumos`),
    verificarSalida: (reservaId: string) =>
      peticion<any>(`/ventas/reservas/${reservaId}/verificar-salida`),
    culminarSalida: (reservaId: string, metodoPago: string) =>
      peticion<any>(`/ventas/reservas/${reservaId}/culminar-salida?metodo_pago=${metodoPago}`, { method: "POST" }),
  },
}
