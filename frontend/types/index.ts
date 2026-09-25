export interface Usuario {
  id: string
  usuario: string
  email: string
  nombre_completo: string
  telefono: string | null
  rol: string
  estado: string
  es_superadmin: boolean
  ultimo_acceso: string | null
  creado_en: string
  permisos: string[]
}

export interface RegistroAuditoria {
  id: string
  accion: string
  tipo_entidad: string
  entidad_id: string | null
  usuario_id: string | null
  nombre_usuario: string | null
  valores_anteriores: string | null
  valores_nuevos: string | null
  direccion_ip: string | null
  creado_en: string
}

export interface AuditoriaPaginada {
  items: RegistroAuditoria[]
  total: number
  pagina: number
  tamano: number
}

export interface Notificacion {
  id: string
  tipo: "llegada" | "salida" | "reserva" | "limpieza" | "caja"
  prioridad: "alta" | "media" | "baja"
  titulo: string
  mensaje: string
  fecha: string
  href: string
}

export interface TipoHabitacion {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  capacidad_base: number
  capacidad_maxima: number
  precio_base: number
  comodidades: string | null
  estado: string
  creado_en: string
  actualizado_en: string
}

export interface Habitacion {
  id: string
  tipo_habitacion_id: string
  piso_id: string
  numero: string
  piso: string | null
  estado_operativo: string
  estado_limpieza: string
  notas: string | null
  creado_en: string
  actualizado_en: string
  tipo_habitacion?: TipoHabitacion | null
}

export interface Piso {
  id: string
  nombre: string
  descripcion: string | null
  estado: string
  creado_en: string
  actualizado_en: string
}

export interface TareaLimpieza {
  id: string
  habitacion_id: string
  asignada_a: string | null
  nombre_asignada: string | null
  fecha_tarea: string
  tipo_limpieza: string
  prioridad: string
  estado: string
  notas: string | null
  iniciada_en: string | null
  completada_en: string | null
  numero_habitacion?: string
  piso?: string | null
  tipo_habitacion_nombre?: string | null
  estado_limpieza?: string | null
  estado_operativo?: string | null
  creado_en: string
  actualizado_en: string
}

export interface ReservaLista {
  id: string
  codigo_confirmacion: string
  huesped_nombre: string
  numero_habitacion?: string | null
  tipo_habitacion_nombre?: string | null
  fecha_entrada: string
  fecha_salida: string
  estado: string
  total: number
  creado_en: string
}

export interface Huesped {
  id: string
  nombres: string
  apellidos: string
  tipo_documento: string | null
  numero_documento: string | null
  telefono: string | null
  email: string | null
  nacionalidad: string | null
  direccion: string | null
  fecha_nacimiento: string | null
  notas: string | null
  creado_en: string
  actualizado_en: string | null
}

export interface Disponibilidad {
  habitacion_id: string
  numero: string
  tipo_habitacion: string
  piso: string | null
  disponible: boolean
}

export interface MetodoPago {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  creado_en: string
  actualizado_en: string
}