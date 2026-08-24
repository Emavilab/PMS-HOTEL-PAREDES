from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.modules.habitaciones.esquemas import TipoHabitacionResponse
from app.modules.huespedes.esquemas import HuespedResponse


class ReservaCrear(BaseModel):
    huesped_id: str
    tipo_habitacion_id: Optional[str] = None
    habitacion_id: Optional[str] = None
    fecha_entrada: date
    fecha_salida: date
    adultos: int = Field(default=1, ge=1, le=20)
    ninos: int = Field(default=0, ge=0, le=20)
    descuento: float = Field(default=0, ge=0)
    origen: Optional[str] = None
    tiene_vehiculo: bool = False
    detalle_vehiculo: Optional[str] = None
    solicitudes_especiales: Optional[str] = None


class ReservaActualizar(BaseModel):
    huesped_id: Optional[str] = None
    tipo_habitacion_id: Optional[str] = None
    habitacion_id: Optional[str] = None
    fecha_entrada: Optional[date] = None
    fecha_salida: Optional[date] = None
    adultos: Optional[int] = Field(default=None, ge=1, le=20)
    ninos: Optional[int] = Field(default=None, ge=0, le=20)
    estado: Optional[str] = None
    origen: Optional[str] = None
    descuento: Optional[float] = Field(default=None, ge=0)
    tiene_vehiculo: Optional[bool] = None
    detalle_vehiculo: Optional[str] = None
    solicitudes_especiales: Optional[str] = None


class ReservaResponse(BaseModel):
    id: str
    codigo_confirmacion: str
    huesped_id: str
    tipo_habitacion_id: Optional[str] = None
    habitacion_id: Optional[str] = None
    creada_por: str
    fecha_entrada: date
    fecha_salida: date
    adultos: int
    ninos: int
    estado: str
    origen: Optional[str] = None
    subtotal: float
    descuento: float
    impuesto: float
    total: float
    tiene_vehiculo: bool = False
    detalle_vehiculo: Optional[str] = None
    solicitudes_especiales: Optional[str] = None
    motivo_cancelacion: Optional[str] = None
    creado_en: datetime
    actualizado_en: datetime
    huesped: Optional[HuespedResponse] = None
    tipo_habitacion: Optional[TipoHabitacionResponse] = None

    class Config:
        from_attributes = True


class CancelarReserva(BaseModel):
    motivo: Optional[str] = Field(default=None, max_length=500)


class ReservaListaResponse(BaseModel):
    id: str
    codigo_confirmacion: str
    huesped_nombre: Optional[str] = None
    numero_habitacion: Optional[str] = None
    tipo_habitacion_nombre: Optional[str] = None
    fecha_entrada: date
    fecha_salida: date
    estado: str
    total: float
    creado_en: datetime

    class Config:
        from_attributes = True


class ReservasPaginadasResponse(BaseModel):
    items: list[ReservaListaResponse]
    total: int
    page: int
    pages: int
    per_page: int


class DisponibilidadRequest(BaseModel):
    fecha_entrada: date
    fecha_salida: date
    tipo_habitacion_id: Optional[str] = None


class DisponibilidadResponse(BaseModel):
    disponible: bool
    habitaciones_disponibles: int = 0
    tipos_habitacion: list = []
