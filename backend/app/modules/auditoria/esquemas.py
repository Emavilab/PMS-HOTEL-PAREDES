from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RegistroAuditoriaResponse(BaseModel):
    id: str
    usuario_id: Optional[str] = None
    accion: str
    tipo_entidad: str
    entidad_id: Optional[str] = None
    valores_anteriores: Optional[str] = None
    valores_nuevos: Optional[str] = None
    direccion_ip: Optional[str] = None
    creado_en: datetime

    class Config:
        from_attributes = True
