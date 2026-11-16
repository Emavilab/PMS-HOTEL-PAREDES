from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ConfigCrear(BaseModel):
    nombre: str = "Hotel Paredes"
    direccion: Optional[str] = ""
    telefono: Optional[str] = ""
    email: Optional[str] = ""
    rtn: Optional[str] = ""
    cai: Optional[str] = ""
    rango_autorizado: Optional[str] = ""
    fecha_limite_emision: Optional[str] = ""
    impuesto: float = 15.0
    impuesto_turistico: float = 4.0
    moneda: str = "HNL"


class ConfigActualizar(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    rtn: Optional[str] = None
    cai: Optional[str] = None
    rango_autorizado: Optional[str] = None
    fecha_limite_emision: Optional[str] = None
    impuesto: Optional[float] = None
    impuesto_turistico: Optional[float] = None
    moneda: Optional[str] = None
    logo_url: Optional[str] = None
    login_fondo_url: Optional[str] = None


class ConfigResponse(BaseModel):
    id: str
    nombre: str
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    rtn: Optional[str] = None
    cai: Optional[str] = None
    rango_autorizado: Optional[str] = None
    fecha_limite_emision: Optional[str] = None
    impuesto: float
    impuesto_turistico: float
    moneda: str
    logo_url: Optional[str] = None
    login_fondo_url: Optional[str] = None
    creado_en: datetime
    actualizado_en: datetime

    class Config:
        from_attributes = True
