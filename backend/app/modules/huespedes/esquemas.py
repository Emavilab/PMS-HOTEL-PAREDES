from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class HuespedCrear(BaseModel):
    nombres: str
    apellidos: str
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    nacionalidad: Optional[str] = None
    direccion: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    notas: Optional[str] = None


class HuespedActualizar(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    nacionalidad: Optional[str] = None
    direccion: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    notas: Optional[str] = None


class HuespedResponse(BaseModel):
    id: str
    nombres: str
    apellidos: str
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    nacionalidad: Optional[str] = None
    direccion: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    notas: Optional[str] = None
    creado_en: datetime
    actualizado_en: Optional[datetime] = None

    class Config:
        from_attributes = True


class HuespedHistorialResponse(BaseModel):
    huesped: HuespedResponse
    reservas: list = []
