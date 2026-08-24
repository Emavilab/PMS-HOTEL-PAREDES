from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


ROLES_VALIDOS = {"admin", "gerente", "recepcionista", "limpieza"}
ESTADOS_VALIDOS = {"activo", "inactivo"}


class UsuarioCrear(BaseModel):
    email: EmailStr
    contrasena: str = Field(min_length=6)
    nombre_completo: str = Field(min_length=3, max_length=255)
    telefono: Optional[str] = Field(default=None, max_length=50)
    rol: str = "recepcionista"

    @field_validator("rol")
    @classmethod
    def validar_rol(cls, valor: str) -> str:
        valor = valor.strip().lower()
        if valor not in ROLES_VALIDOS:
            raise ValueError("Rol invalido")
        return valor

    @field_validator("nombre_completo")
    @classmethod
    def limpiar_nombre(cls, valor: str) -> str:
        return valor.strip()


class UsuarioActualizar(BaseModel):
    email: Optional[EmailStr] = None
    contrasena: Optional[str] = Field(default=None, min_length=6)
    nombre_completo: Optional[str] = Field(default=None, min_length=3, max_length=255)
    telefono: Optional[str] = Field(default=None, max_length=50)
    rol: Optional[str] = None
    estado: Optional[str] = None

    @field_validator("rol")
    @classmethod
    def validar_rol(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return valor
        valor = valor.strip().lower()
        if valor not in ROLES_VALIDOS:
            raise ValueError("Rol invalido")
        return valor

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return valor
        valor = valor.strip().lower()
        if valor not in ESTADOS_VALIDOS:
            raise ValueError("Estado invalido")
        return valor

    @field_validator("nombre_completo")
    @classmethod
    def limpiar_nombre(cls, valor: Optional[str]) -> Optional[str]:
        return valor.strip() if valor is not None else valor


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
