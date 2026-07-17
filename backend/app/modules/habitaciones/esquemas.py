from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TipoHabitacionCrear(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    capacidad_base: int = 1
    capacidad_maxima: int = 2
    precio_base: float = 0
    comodidades: Optional[str] = None
    estado: str = "activo"


class TipoHabitacionActualizar(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    capacidad_base: Optional[int] = None
    capacidad_maxima: Optional[int] = None
    precio_base: Optional[float] = None
    comodidades: Optional[str] = None
    estado: Optional[str] = None


class TipoHabitacionResponse(BaseModel):
    id: str
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    capacidad_base: int
    capacidad_maxima: int
    precio_base: float
    comodidades: Optional[str] = None
    estado: str
    creado_en: datetime
    actualizado_en: datetime

    class Config:
        from_attributes = True


class HabitacionCrear(BaseModel):
    tipo_habitacion_id: str
    numero: str
    piso: Optional[str] = None
    estado_operativo: str = "DISPONIBLE"
    estado_limpieza: str = "LIMPIA"
    notas: Optional[str] = None


class HabitacionActualizar(BaseModel):
    tipo_habitacion_id: Optional[str] = None
    numero: Optional[str] = None
    piso: Optional[str] = None
    estado_operativo: Optional[str] = None
    estado_limpieza: Optional[str] = None
    notas: Optional[str] = None


class HabitacionResponse(BaseModel):
    id: str
    tipo_habitacion_id: str
    numero: str
    piso: Optional[str] = None
    estado_operativo: str
    estado_limpieza: str
    notas: Optional[str] = None
    creado_en: datetime
    actualizado_en: datetime
    tipo_habitacion: Optional[TipoHabitacionResponse] = None

    class Config:
        from_attributes = True


class HabitacionEstadoActualizar(BaseModel):
    estado_operativo: Optional[str] = None
    estado_limpieza: Optional[str] = None
