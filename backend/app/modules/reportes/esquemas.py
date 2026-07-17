from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class ReporteOcupacion(BaseModel):
    fecha: date
    total_habitaciones: int = 0
    habitaciones_ocupadas: int = 0
    habitaciones_disponibles: int = 0
    porcentaje_ocupacion: float = 0


class ReporteIngresos(BaseModel):
    desde: date
    hasta: date
    total_ingresos: float = 0
    total_cargos: float = 0
    total_pagos: float = 0
    descuentos_aplicados: float = 0
    impuestos_recaudados: float = 0


class SolicitudReporte(BaseModel):
    tipo: str
    desde: Optional[date] = None
    hasta: Optional[date] = None
