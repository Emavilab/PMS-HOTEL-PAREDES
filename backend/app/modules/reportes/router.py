from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date

from app.core.database import get_db
from app.core.dependencies import GerenteUsuario, PersonalUsuario
from app.modules.reportes.esquemas import ReporteOcupacion, ReporteIngresos
from app.modules.habitaciones.modelos import Habitacion
from app.modules.reservas.modelos import Reserva
from app.modules.facturacion.modelos import Cargo, Pago
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/reportes", tags=["Reportes"])


@router.get("/ocupacion", response_model=list[ReporteOcupacion])
def reporte_ocupacion(
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    total_habitaciones = db.query(func.count(Habitacion.id)).scalar() or 0
    if total_habitaciones == 0:
        return []

    from datetime import timedelta

    resultados = []
    fecha_actual = desde
    while fecha_actual <= hasta:
        ocupadas = (
            db.query(func.count(Reserva.id))
            .filter(
                Reserva.estado.in_(["PENDIENTE", "CONFIRMADA", "CHECKED_IN"]),
                Reserva.fecha_entrada <= fecha_actual,
                Reserva.fecha_salida > fecha_actual,
            )
            .scalar()
            or 0
        )
        disponibles = total_habitaciones - ocupadas
        porcentaje = round((ocupadas / total_habitaciones) * 100, 2) if total_habitaciones > 0 else 0

        resultados.append(
            ReporteOcupacion(
                fecha=fecha_actual,
                total_habitaciones=total_habitaciones,
                habitaciones_ocupadas=ocupadas,
                habitaciones_disponibles=disponibles,
                porcentaje_ocupacion=porcentaje,
            )
        )
        fecha_actual += timedelta(days=1)

    return resultados


@router.get("/ingresos", response_model=ReporteIngresos)
def reporte_ingresos(
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    total_cargos = (
        db.query(func.coalesce(func.sum(Cargo.total), 0))
        .filter(cast(Cargo.fecha_cargo, Date) >= desde, cast(Cargo.fecha_cargo, Date) <= hasta)
        .scalar()
        or 0
    )

    total_pagos = (
        db.query(func.coalesce(func.sum(Pago.monto), 0))
        .filter(cast(Pago.pagado_en, Date) >= desde, cast(Pago.pagado_en, Date) <= hasta)
        .scalar()
        or 0
    )

    descuentos = (
        db.query(func.coalesce(func.sum(Reserva.descuento), 0))
        .filter(
            Reserva.creado_en >= desde,
            Reserva.creado_en <= hasta,
        )
        .scalar()
        or 0
    )

    impuestos = (
        db.query(func.coalesce(func.sum(Reserva.impuesto), 0))
        .filter(
            Reserva.creado_en >= desde,
            Reserva.creado_en <= hasta,
        )
        .scalar()
        or 0
    )

    total_ingresos = (
        db.query(func.coalesce(func.sum(Reserva.total), 0))
        .filter(
            Reserva.creado_en >= desde,
            Reserva.creado_en <= hasta,
        )
        .scalar()
        or 0
    )

    return ReporteIngresos(
        desde=desde,
        hasta=hasta,
        total_ingresos=float(total_ingresos),
        total_cargos=float(total_cargos),
        total_pagos=float(total_pagos),
        descuentos_aplicados=float(descuentos),
        impuestos_recaudados=float(impuestos),
    )


@router.get("/llegadas", response_model=list[dict])
def llegadas_del_dia(
    fecha: date | None = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    dia = fecha or date.today()
    reservas = (
        db.query(Reserva)
        .filter(
            Reserva.fecha_entrada == dia,
            Reserva.estado.in_(["PENDIENTE", "CONFIRMADA", "CHECKED_IN"]),
        )
        .all()
    )
    resultado = []
    for r in reservas:
        nombre = f"{r.huesped.nombres} {r.huesped.apellidos}" if r.huesped else "N/A"
        resultado.append(
            {
                "id": r.id,
                "codigo_confirmacion": r.codigo_confirmacion,
                "huesped": nombre,
                "fecha_entrada": str(r.fecha_entrada),
                "fecha_salida": str(r.fecha_salida),
                "habitacion": r.habitacion_ref.numero if r.habitacion_ref else None,
                "tipo_habitacion_id": r.tipo_habitacion_id,
                "estado": r.estado,
            }
        )
    return resultado


@router.get("/salidas", response_model=list[dict])
def salidas_del_dia(
    fecha: date | None = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    dia = fecha or date.today()
    reservas = (
        db.query(Reserva)
        .filter(
            Reserva.fecha_salida == dia,
            Reserva.estado.in_(["CHECKED_IN", "CONFIRMADA"]),
        )
        .all()
    )
    resultado = []
    for r in reservas:
        nombre = f"{r.huesped.nombres} {r.huesped.apellidos}" if r.huesped else "N/A"
        resultado.append(
            {
                "id": r.id,
                "codigo_confirmacion": r.codigo_confirmacion,
                "huesped": nombre,
                "fecha_entrada": str(r.fecha_entrada),
                "fecha_salida": str(r.fecha_salida),
                "habitacion": r.habitacion_ref.numero if r.habitacion_ref else None,
                "estado": r.estado,
                "total": float(r.total),
            }
        )
    return resultado
