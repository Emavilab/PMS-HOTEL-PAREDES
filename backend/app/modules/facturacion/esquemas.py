from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CargoCrear(BaseModel):
    reserva_id: Optional[str] = None
    descripcion: str
    cantidad: int = 1
    precio_unitario: float
    total: float


class CargoResponse(BaseModel):
    id: str
    reserva_id: str
    descripcion: str
    cantidad: int
    precio_unitario: float
    total: float
    fecha_cargo: datetime
    creado_por: str
    creado_en: datetime

    class Config:
        from_attributes = True


class PagoCrear(BaseModel):
    reserva_id: Optional[str] = None
    monto: float
    metodo_pago: str
    referencia: Optional[str] = None


class PagoResponse(BaseModel):
    id: str
    reserva_id: str
    monto: float
    metodo_pago: str
    referencia: Optional[str] = None
    estado: str
    recibido_por: str
    pagado_en: datetime
    creado_en: datetime

    class Config:
        from_attributes = True


class FolioResponse(BaseModel):
    reserva_id: str | None = None
    codigo_confirmacion: str | None = None
    huesped_nombre: str | None = None
    fecha_entrada: str | None = None
    fecha_salida: str | None = None
    cargos: list[CargoResponse] = []
    pagos: list[PagoResponse] = []
    subtotal: float = 0
    descuento: float = 0
    impuesto: float = 0
    total: float = 0
    pagado: float = 0
    saldo: float = 0

    class Config:
        from_attributes = True
