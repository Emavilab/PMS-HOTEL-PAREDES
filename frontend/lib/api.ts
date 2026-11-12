/**
 * Cliente HTTP centralizado del frontend.
 *
 * Adjunta el JWT, convierte errores de la API en mensajes utilizables por la
 * interfaz y notifica globalmente cuando el backend invalida una sesión.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function obtenerToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("token") || sessionStorage.getItem("token")
  }
  return null
}

async function peticion<T>(
  endpoint: string,
  options: RequestInit & { responseType?: "blob" } = {}
): Promise<T> {
  // Mantener la lectura de ambos almacenamientos permite respetar
  // la opción "recordarme" elegida durante el inicio de sesión.
  const token = obtenerToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers })

  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    sessionStorage.removeItem("token")
    sessionStorage.removeItem("user")
    window.dispatchEvent(new CustomEvent("auth:unauthorized"))
  }

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

  if (options.responseType === "blob") {
    return res.blob() as Promise<T>
  }

  return res.json()
}

export const api = {
  auth: {
    login: (identificador: string, password: string) =>
      peticion<{ access_token: string; usuario: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identificador, contrasena: password }),
      }),
    verificar: (token: string) =>
      peticion<any>("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    logout: () => peticion<void>("/auth/logout", { method: "POST" }),
  },
  usuarios: {
    listar: () => peticion<any[]>("/usuarios"),
    activos: () => peticion<{ id: string; usuario: string; nombre_completo: string; rol: string; ultima_actividad: string }[]>("/usuarios/activos"),
    registrarActividad: () => peticion<void>("/usuarios/actividad", { method: "POST" }),
    crear: (datos: any) =>
      peticion<any>("/usuarios", { method: "POST", body: JSON.stringify(datos) }),
    actualizar: (id: string, datos: any) =>
      peticion<any>(`/usuarios/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    revocarSesion: (id: string) =>
      peticion<void>(`/usuarios/${id}/revocar-sesion`, { method: "POST" }),
    obtener: (id: string) => peticion<any>(`/usuarios/${id}`),
    eliminar: (id: string) => peticion<void>(`/usuarios/${id}`, { method: "DELETE" }),
  },
  tiposHabitacion: {
    listar: () => peticion<any[]>("/tipos-habitacion"),
    crear: (datos: any) =>
      peticion<any>("/tipos-habitacion", { method: "POST", body: JSON.stringify(datos) }),
    actualizar: (id: string, datos: any) =>
      peticion<any>(`/tipos-habitacion/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    eliminar: (id: string) => peticion<void>(`/tipos-habitacion/${id}`, { method: "DELETE" }),
  },
  habitaciones: {
    listar: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : ""
      return peticion<any[]>(`/habitaciones${qs}`)
    },
    crear: (datos: any) =>
      peticion<any>("/habitaciones", { method: "POST", body: JSON.stringify(datos) }),
    actualizar: (id: string, datos: any) =>
      peticion<any>(`/habitaciones/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    actualizarEstado: (id: string, datos: any) =>
      peticion<any>(`/habitaciones/${id}/estado`, { method: "PATCH", body: JSON.stringify(datos) }),
    eliminar: (id: string) => peticion<void>(`/habitaciones/${id}`, { method: "DELETE" }),
    listarPisos: () => peticion<any[]>("/pisos"),
    crearPiso: (datos: any) =>
      peticion<any>("/pisos", { method: "POST", body: JSON.stringify(datos) }),
    actualizarPiso: (id: string, datos: any) =>
      peticion<any>(`/pisos/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    eliminarPiso: (id: string) => peticion<void>(`/pisos/${id}`, { method: "DELETE" }),
  },
  huespedes: {
    listar: (busqueda?: string) =>
      peticion<any[]>(`/huespedes${busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : ""}`),
    crear: (datos: any) =>
      peticion<any>("/huespedes", { method: "POST", body: JSON.stringify(datos) }),
    obtener: (id: string) => peticion<any>(`/huespedes/${id}`),
    actualizar: (id: string, datos: any) =>
      peticion<any>(`/huespedes/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    eliminar: (id: string) => peticion<void>(`/huespedes/${id}`, { method: "DELETE" }),
    historial: (id: string) => peticion<any>(`/huespedes/${id}/historial`),
  },
  reservas: {
    listar: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : ""
      return peticion<any>(`/reservas${qs}`)
    },
    crear: (datos: any) =>
      peticion<any>("/reservas", { method: "POST", body: JSON.stringify(datos) }),
    obtener: (id: string) => peticion<any>(`/reservas/${id}`),
    actualizar: (id: string, datos: any) =>
      peticion<any>(`/reservas/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    cancelar: (id: string, motivo?: string) =>
      peticion<any>(`/reservas/${id}/cancelar`, {
        method: "POST",
        body: JSON.stringify({ motivo: motivo || null }),
      }),
    confirmar: (id: string) =>
      peticion<any>(`/reservas/${id}/confirmar`, { method: "POST" }),
    noShow: (id: string) =>
      peticion<any>(`/reservas/${id}/no-show`, { method: "POST" }),
    eliminar: (id: string) =>
      peticion<void>(`/reservas/${id}`, { method: "DELETE" }),
    checkIn: (id: string, habitacionId: string) =>
      peticion<any>(`/reservas/${id}/check-in`, {
        method: "POST",
        body: JSON.stringify({ habitacion_id: habitacionId }),
      }),
    checkOut: (id: string) =>
      peticion<any>(`/reservas/${id}/check-out`, { method: "POST" }),
    extenderEstadia: (id: string, nuevaFechaSalida: string) =>
      peticion<any>(`/reservas/${id}/extender-estadia`, {
        method: "POST",
        body: JSON.stringify({ nueva_fecha_salida: nuevaFechaSalida }),
      }),
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
    personal: () =>
      peticion<{ id: string; nombre_completo: string }[]>("/tareas-limpieza/personal"),
  },
  facturas: {
    listar: () => peticion<any[]>("/facturas"),
    obtener: (id: string) => peticion<any>(`/facturas/${id}`),
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
  metodosPago: {
    listar: () => peticion<any[]>("/metodos-pago"),
    crear: (datos: { nombre: string; descripcion?: string; activo: boolean }) =>
      peticion<any>("/metodos-pago", { method: "POST", body: JSON.stringify(datos) }),
    actualizar: (id: string, datos: { nombre?: string; descripcion?: string; activo?: boolean }) =>
      peticion<any>(`/metodos-pago/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    eliminar: (id: string) =>
      peticion<void>(`/metodos-pago/${id}`, { method: "DELETE" }),
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
    listar: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : ""
      return peticion<any>(`/sesiones-caja${qs}`)
    },
    activa: () => peticion<any>("/sesiones-caja/activa"),
    resumen: (id: string) => peticion<any>(`/sesiones-caja/${id}/resumen`),
  },
  reportes: {
    notificaciones: () => peticion<import("@/types").Notificacion[]>("/reportes/notificaciones"),
    ocupacion: (fechaInicio: string, fechaFin: string) =>
      peticion<any[]>(`/reportes/ocupacion?desde=${fechaInicio}&hasta=${fechaFin}`),
    ingresos: (fechaInicio: string, fechaFin: string) =>
      peticion<any>(`/reportes/ingresos?desde=${fechaInicio}&hasta=${fechaFin}`),
    llegadas: () => peticion<any[]>("/reportes/llegadas"),
    salidas: (dias?: number) => peticion<any[]>(`/reportes/salidas${dias ? `?dias=${dias}` : ""}`),
    cuentasPorCobrar: (hasta?: string) =>
      peticion<any>(`/reportes/cuentas-por-cobrar${hasta ? `?hasta=${hasta}` : ""}`),
    housekeeping: (fecha?: string) =>
      peticion<any>(`/reportes/housekeeping${fecha ? `?fecha=${fecha}` : ""}`),
    ingresosDetallado: (desde: string, hasta: string) =>
      peticion<any>(`/reportes/ingresos-detallado?desde=${desde}&hasta=${hasta}`),
    forecast: (desde: string, hasta: string) =>
      peticion<any>(`/reportes/forecast?desde=${desde}&hasta=${hasta}`),
    libroHuespedes: (desde: string, hasta: string) =>
      peticion<any>(`/reportes/libro-huespedes?desde=${desde}&hasta=${hasta}`),
    ventas: (desde: string, hasta: string) =>
      peticion<any>(`/reportes/ventas?desde=${desde}&hasta=${hasta}`),
    conciliacionCaja: (desde: string, hasta: string) =>
      peticion<any>(`/reportes/conciliacion-caja?desde=${desde}&hasta=${hasta}`),
    ejecutivo: (desde: string, hasta: string, granularidad?: string) =>
      peticion<any>(`/reportes/ejecutivo?desde=${desde}&hasta=${hasta}&granularidad=${granularidad || "mensual"}`),
    exportar: (tipo: string, formato: "xlsx" | "pdf", desde: string, hasta: string) =>
      peticion<Blob>(`/reportes/exportar?tipo=${tipo}&formato=${formato}&desde=${desde}&hasta=${hasta}`, {
        responseType: "blob",
      }),
  },
  auditoria: {
    listar: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : ""
      return peticion<import("@/types").AuditoriaPaginada>(`/registros-auditoria${qs}`)
    },
    exportar: (params: Record<string, string>, formato: "xlsx" | "pdf") => {
      const query = new URLSearchParams({ ...params, formato }).toString()
      return peticion<Blob>(`/registros-auditoria/exportar?${query}`, { responseType: "blob" })
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
    listarCategorias: () => peticion<any[]>("/ventas/categorias"),
    listarTodasCategorias: () => peticion<any[]>("/ventas/categorias/todas"),
    crearCategoria: (datos: any) => peticion<any>("/ventas/categorias", { method: "POST", body: JSON.stringify(datos) }),
    actualizarCategoria: (id: string, datos: any) => peticion<any>(`/ventas/categorias/${id}`, { method: "PUT", body: JSON.stringify(datos) }),
    eliminarCategoria: (id: string) => peticion<void>(`/ventas/categorias/${id}`, { method: "DELETE" }),
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
    crearVentaParticular: (datos: any) =>
      peticion<any>("/ventas/particulares", { method: "POST", body: JSON.stringify(datos) }),
    verificarSalida: (reservaId: string) =>
      peticion<any>(`/ventas/reservas/${reservaId}/verificar-salida`),
    culminarSalida: (reservaId: string, metodoPago: string, efectivoRecibido?: number) => {
      const params = new URLSearchParams({ metodo_pago: metodoPago })
      if (efectivoRecibido !== undefined) params.set("efectivo_recibido", String(efectivoRecibido))
      return peticion<any>(`/ventas/reservas/${reservaId}/culminar-salida?${params.toString()}`, { method: "POST" })
    },
  },
}
