from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RegistroAuditoriaResponse(BaseModel):
    id: str
    usuario_id: Optional[str] = None
    nombre_usuario: Optional[str] = None
    rol_usuario: Optional[str] = None
    accion: str
    tipo_entidad: str
    entidad_id: Optional[str] = None
    valores_anteriores: Optional[str] = None
    valores_nuevos: Optional[str] = None
    direccion_ip: Optional[str] = None
    metodo_http: Optional[str] = None
    ruta: Optional[str] = None
    estado_http: Optional[int] = None
    agente_usuario: Optional[str] = None
    creado_en: datetime
    descripcion: str = ""
    detalles: dict = Field(default_factory=dict)

    class Config:
        from_attributes = True


class RegistrosAuditoriaPaginados(BaseModel):
    items: list[RegistroAuditoriaResponse]
    total: int
    pagina: int
    tamano: int
