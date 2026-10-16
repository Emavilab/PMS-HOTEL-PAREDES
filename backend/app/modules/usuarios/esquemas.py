from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
import json


ROLES_VALIDOS = {"admin", "gerente", "recepcionista", "limpieza"}
ESTADOS_VALIDOS = {"activo", "inactivo"}

# Módulos del sistema para permisos granulares
MODULOS_SISTEMA = [
    {"key": "dashboard", "label": "Dashboard", "icon": "LayoutDashboard"},
    {"key": "recepcion", "label": "Recepción", "icon": "ClipboardCheck"},
    {"key": "verificar_salida", "label": "Verificar Salida", "icon": "LogOut"},
    {"key": "reservas", "label": "Reservas", "icon": "Calendar"},
    {"key": "huespedes", "label": "Huéspedes", "icon": "Users"},
    {"key": "habitaciones", "label": "Habitaciones", "icon": "BedDouble"},
    {"key": "ventas", "label": "Ventas", "icon": "ShoppingCart"},
    {"key": "housekeeping", "label": "Housekeeping", "icon": "Building2"},
    {"key": "facturacion", "label": "Facturación", "icon": "Receipt"},
    {"key": "caja", "label": "Caja", "icon": "DollarSign"},
    {"key": "reportes", "label": "Reportes", "icon": "BarChart3"},
    {"key": "usuarios", "label": "Usuarios", "icon": "Users"},
    {"key": "auditoria", "label": "Auditoría", "icon": "Shield"},
    {"key": "configuracion", "label": "Configuración", "icon": "Settings"},
]

MODULOS_KEYS = [m["key"] for m in MODULOS_SISTEMA]


def validar_longitud_contrasena(valor: str) -> str:
    if len(valor) < 12:
        raise ValueError("La contraseña debe tener al menos 12 caracteres")
    if len(valor.encode("utf-8")) > 256:
        raise ValueError("La contraseña no puede superar 256 bytes")
    if valor.strip() != valor or not any(caracter.isalpha() for caracter in valor) or not any(caracter.isdigit() for caracter in valor):
        raise ValueError("La contraseña debe incluir letras y números, sin espacios al inicio o al final")
    return valor


class UsuarioCrear(BaseModel):
    usuario: str = Field(min_length=3, max_length=100)
    email: EmailStr
    contrasena: str = Field(min_length=12, max_length=256)
    nombre_completo: str = Field(min_length=3, max_length=255)
    telefono: Optional[str] = Field(default=None, max_length=50)
    rol: str = "recepcionista"
    permisos: Optional[list[str]] = Field(default_factory=list)

    @field_validator("contrasena")
    @classmethod
    def validar_contrasena(cls, valor: str) -> str:
        return validar_longitud_contrasena(valor)

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

    @field_validator("usuario")
    @classmethod
    def validar_usuario(cls, valor: str) -> str:
        valor = valor.strip().lower()
        if not valor.replace("_", "").replace("-", "").isalnum():
            raise ValueError("El usuario solo puede contener letras, numeros, guion y guion bajo")
        return valor

    @field_validator("permisos")
    @classmethod
    def validar_permisos(cls, valor: list[str]) -> list[str]:
        if valor is None:
            return []
        invalidos = [p for p in valor if p not in MODULOS_KEYS]
        if invalidos:
            raise ValueError(f"Permisos inválidos: {', '.join(invalidos)}")
        return valor


class UsuarioActualizar(BaseModel):
    usuario: Optional[str] = Field(default=None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None
    contrasena: Optional[str] = Field(default=None, min_length=12, max_length=256)
    nombre_completo: Optional[str] = Field(default=None, min_length=3, max_length=255)
    telefono: Optional[str] = Field(default=None, max_length=50)
    rol: Optional[str] = None
    estado: Optional[str] = None
    permisos: Optional[list[str]] = None

    @field_validator("contrasena")
    @classmethod
    def validar_contrasena(cls, valor: Optional[str]) -> Optional[str]:
        return validar_longitud_contrasena(valor) if valor is not None else valor

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

    @field_validator("usuario")
    @classmethod
    def validar_usuario(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return valor
        valor = valor.strip().lower()
        if not valor.replace("_", "").replace("-", "").isalnum():
            raise ValueError("El usuario solo puede contener letras, numeros, guion y guion bajo")
        return valor

    @field_validator("permisos")
    @classmethod
    def validar_permisos(cls, valor: Optional[list[str]]) -> Optional[list[str]]:
        if valor is None:
            return valor
        invalidos = [p for p in valor if p not in MODULOS_KEYS]
        if invalidos:
            raise ValueError(f"Permisos inválidos: {', '.join(invalidos)}")
        return valor


class UsuarioResponse(BaseModel):
    id: str
    usuario: str
    email: str
    nombre_completo: str
    telefono: Optional[str] = None
    rol: str
    estado: str
    es_superadmin: bool
    permisos: list[str] = []
    ultimo_acceso: Optional[datetime] = None
    creado_en: datetime

    @field_validator("permisos", mode="before")
    @classmethod
    def convertir_permisos(cls, valor: object) -> list[str]:
        if isinstance(valor, str):
            try:
                valor = json.loads(valor)
            except json.JSONDecodeError:
                return []
        return valor if isinstance(valor, list) else []

    class Config:
        from_attributes = True
