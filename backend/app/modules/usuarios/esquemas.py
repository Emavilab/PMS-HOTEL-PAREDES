from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UsuarioCrear(BaseModel):
    email: str
    contrasena: str
    nombre_completo: str
    telefono: Optional[str] = None
    rol: str = "recepcionista"


class UsuarioActualizar(BaseModel):
    email: Optional[str] = None
    contrasena: Optional[str] = None
    nombre_completo: Optional[str] = None
    telefono: Optional[str] = None
    rol: Optional[str] = None
    estado: Optional[str] = None


class UsuarioResponse(BaseModel):
    id: str
    email: str
    nombre_completo: str
    telefono: Optional[str] = None
    rol: str
    estado: str
    es_superadmin: bool
    ultimo_acceso: Optional[datetime] = None
    creado_en: datetime

    class Config:
        from_attributes = True
