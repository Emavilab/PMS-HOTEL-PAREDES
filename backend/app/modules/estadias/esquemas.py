from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CheckInRequest(BaseModel):
    habitacion_id: str


class CheckOutRequest(BaseModel):
    pass


class EstadiaResponse(BaseModel):
    id: str
    reserva_id: str
    check_in_real: Optional[datetime] = None
    check_out_real: Optional[datetime] = None
    check_in_realizado_por: Optional[str] = None
    check_out_realizado_por: Optional[str] = None
    estado: str
    creado_en: datetime
    actualizado_en: datetime

    class Config:
        from_attributes = True
