from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class TareaLimpiezaCrear(BaseModel):
    habitacion_id: str
    asignada_a: Optional[str] = None
    fecha_tarea: date
    tipo_limpieza: str = "GENERAL"
    prioridad: str = "normal"
    notas: Optional[str] = None


class TareaLimpiezaActualizar(BaseModel):
    asignada_a: Optional[str] = None
    fecha_tarea: Optional[date] = None
    tipo_limpieza: Optional[str] = None
    prioridad: Optional[str] = None
    estado: Optional[str] = None
    notas: Optional[str] = None
    iniciada_en: Optional[datetime] = None
    completada_en: Optional[datetime] = None


class TareaLimpiezaResponse(BaseModel):
    id: str
    habitacion_id: str
    asignada_a: Optional[str] = None
    nombre_asignada: Optional[str] = None
    fecha_tarea: date
    tipo_limpieza: str = "GENERAL"
    prioridad: str
    estado: str
    notas: Optional[str] = None
    iniciada_en: Optional[datetime] = None
    completada_en: Optional[datetime] = None
    numero_habitacion: Optional[str] = None
    piso: Optional[str] = None
    tipo_habitacion_nombre: Optional[str] = None
    estado_limpieza: Optional[str] = None
    estado_operativo: Optional[str] = None
    creado_en: datetime
    actualizado_en: datetime

    class Config:
        from_attributes = True
