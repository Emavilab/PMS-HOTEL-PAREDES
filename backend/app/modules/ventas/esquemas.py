from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class ProductoCrear(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    precio_unitario: float
    categoria: Optional[str] = None


class ProductoActualizar(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio_unitario: Optional[float] = None
    categoria: Optional[str] = None
    estado: Optional[str] = None


class ProductoResponse(BaseModel):
    id: str
    nombre: str
    descripcion: Optional[str] = None
    precio_unitario: float
    categoria: Optional[str] = None
    estado: str
    creado_en: datetime

    class Config:
        from_attributes = True


class ConsumoCrear(BaseModel):
    producto_id: str
    cantidad: int = 1
    pagado: bool = False


class ConsumoResponse(BaseModel):
    id: str
    reserva_id: str
    producto_id: str
    producto_nombre: Optional[str] = None
    cantidad: int
    precio_unitario: float
    total: float
    pagado: bool
    creado_en: datetime

    class Config:
        from_attributes = True


class VerificacionSalidaResponse(BaseModel):
    reserva_id: str
    codigo_confirmacion: str
    huesped_nombre: str
    huesped_documento: Optional[str] = None
    habitacion_numero: Optional[str] = None
    habitacion_tipo: Optional[str] = None
    fecha_entrada: date
    fecha_salida: date
    noches: int
    subtotal: float
    descuento: float
    impuesto: float
    total_habitacion: float
    consumos: list[ConsumoResponse] = []
    total_consumos: float = 0
    total_consumos_pendientes: float = 0
    total_pagado: float = 0
    mora_penalidad: float = 0
    total_a_pagar: float = 0

    class Config:
        from_attributes = True
