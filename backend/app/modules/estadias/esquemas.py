from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class CheckInRequest(BaseModel):
    habitacion_id: str


class CheckOutRequest(BaseModel):
    pass


class ExtensionEstadiaRequest(BaseModel):
    nueva_fecha_salida: date


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
    nueva_fecha_salida: Optional[date] = None
    noches_adicionales: Optional[int] = None
    total_adicional: Optional[float] = None
    nuevo_total: Optional[float] = None
    saldo_pendiente: Optional[float] = None

    class Config:
        from_attributes = True
