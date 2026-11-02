from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class ReporteOcupacion(BaseModel):
    fecha: date
    total_habitaciones: int = 0
    habitaciones_ocupadas: int = 0
    habitaciones_disponibles: int = 0
    porcentaje_ocupacion: float = 0


class ReporteIngresos(BaseModel):
    desde: date
    hasta: date
    total_ingresos: float = 0
    total_cargos: float = 0
    total_pagos: float = 0
    descuentos_aplicados: float = 0
    impuestos_recaudados: float = 0


class CuentaPorCobrar(BaseModel):
    reserva_id: str
    codigo_confirmacion: str
    huesped: str
    fecha_entrada: date
    fecha_salida: date
    total_reserva: float
    pagado: float
    saldo: float
    dias_vencido: int
    tramo: str  # "0-30", "31-60", "61-90", "90+"


class ReporteCuentasPorCobrar(BaseModel):
    items: List[CuentaPorCobrar]
    total_saldo: float
    por_tramo: dict


class ProductividadCamarera(BaseModel):
    camarera_id: str
    camarera_nombre: str
    tareas_asignadas: int
    tareas_completadas: int
    tareas_pendientes: int
    tareas_en_progreso: int
    porcentaje_completado: float
    tiempo_promedio_minutos: Optional[float] = None


class ReporteHousekeeping(BaseModel):
    fecha: date
    total_tareas: int
    completadas: int
    en_progreso: int
    pendientes: int
    inspecciones_fallidas: int
    productividad_por_camarera: List[ProductividadCamarera]


class IngresoPorCanal(BaseModel):
    canal: str
    reservas: int
    ingresos: float
    adr: float
    porcentaje: float


class IngresoPorTipoHabitacion(BaseModel):
    tipo_habitacion: str
    reservas: int
    ingresos: float
    adr: float
    ocupacion_pct: float


class ReporteIngresosDetallado(BaseModel):
    desde: date
    hasta: date
    total_ingresos: float
    por_canal: List[IngresoPorCanal]
    por_tipo_habitacion: List[IngresoPorTipoHabitacion]


class ForecastItem(BaseModel):
    fecha: date
    ocupacion_estimada_pct: float
    ingresos_estimados: float
    habitaciones_ocupadas_estimadas: int


class ReporteForecast(BaseModel):
    desde: date
    hasta: date
    items: List[ForecastItem]


class SolicitudReporte(BaseModel):
    tipo: str
    desde: Optional[date] = None
    hasta: Optional[date] = None


class LibroHuespedesItem(BaseModel):
    numero_registro: int
    fecha_registro: date
    codigo_confirmacion: str
    huesped_nombre: str
    huesped_documento: Optional[str] = None
    huesped_nacionalidad: Optional[str] = None
    huesped_direccion: Optional[str] = None
    fecha_entrada: date
    fecha_salida: date
    habitacion: str
    adultos: int
    ninos: int
    estado: str
    total: float


class ReporteLibroHuespedes(BaseModel):
    desde: date
    hasta: date
    total_registros: int
    items: List[LibroHuespedesItem]


class ReporteVentas(BaseModel):
    desde: date
    hasta: date
    total_ventas: float
    total_particulares: float
    total_consumos: float
    ventas_particulares: int
    consumos: int
    items: List[dict]


class ConciliacionCajaItem(BaseModel):
    fecha: date
    sesion_id: str
    cajero: str
    monto_apertura: float
    monto_esperado: float
    monto_declarado: float
    diferencia: float
    estado: str


class ReporteConciliacionCaja(BaseModel):
    desde: date
    hasta: date
    total_sesiones: int
    total_diferencias: float
    sesiones_cuadradas: int
    sesiones_con_diferencia: int
    items: List[ConciliacionCajaItem]


class KPIEjecutivo(BaseModel):
    periodo: str
    revpar: float
    adr: float
    ocupacion_pct: float
    goppar: Optional[float] = None
    ingresos_totales: float
    habitaciones_vendidas: int
    habitaciones_disponibles: int
    total_huespedes: int
    estancia_media: float
    ingresos_por_huesped: float


class ReporteEjecutivo(BaseModel):
    desde: date
    hasta: date
    kpis: List[KPIEjecutivo]
    resumen: dict
