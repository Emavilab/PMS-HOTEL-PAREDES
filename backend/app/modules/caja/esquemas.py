from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SesionCajaAbrir(BaseModel):
    monto_apertura: float = Field(ge=0)


class SesionCajaCerrar(BaseModel):
    monto_declarado: float = Field(ge=0)


class SesionCajaResponse(BaseModel):
    id: str
    usuario_id: str
    nombre_usuario: Optional[str] = None
    monto_apertura: float
    monto_esperado: Optional[float] = None
    monto_declarado: Optional[float] = None
    diferencia: Optional[float] = None
    abierta_en: datetime
    cerrada_en: Optional[datetime] = None
    estado: str

    class Config:
        from_attributes = True


class SesionesCajaPaginadas(BaseModel):
    items: list[SesionCajaResponse]
    total: int
    page: int
    pages: int
    per_page: int
