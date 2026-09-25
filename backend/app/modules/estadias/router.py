from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import PersonalUsuario
from app.common.auditoria import crear_registro_auditoria
from app.modules.estadias.modelos import Estadia
from app.modules.estadias.esquemas import (
    CheckInRequest,
    CheckOutRequest,
    EstadiaResponse,
    ExtensionEstadiaRequest,
)
from app.modules.reservas.modelos import Reserva
from app.modules.habitaciones.modelos import Habitacion
from app.modules.limpieza.modelos import TareaLimpieza
from app.modules.facturacion.modelos import Cargo
from app.modules.configuracion.modelos import HotelConfig
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/reservas", tags=["Estadias"])


@router.post("/{reserva_id}/extender-estadia", response_model=EstadiaResponse)
def extender_estadia(
    reserva_id: str,
    datos: ExtensionEstadiaRequest,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.estado != "CHECKED_IN":
        raise HTTPException(
            status_code=400,
            detail="Solo se puede extender una estadia con check-in activo",
        )

    estadia = db.query(Estadia).filter(
        Estadia.reserva_id == reserva_id,
        Estadia.estado == "ACTIVA",
    ).first()
    if not estadia:
        raise HTTPException(status_code=400, detail="No se encontro una estadia activa")
    if datos.nueva_fecha_salida <= reserva.fecha_salida:
        raise HTTPException(
            status_code=400,
            detail="La nueva fecha de salida debe ser posterior a la actual",
        )

    conflicto = db.query(Reserva).filter(
        Reserva.id != reserva_id,
        Reserva.habitacion_id == reserva.habitacion_id,
        Reserva.estado.in_(("PENDIENTE", "CONFIRMADA", "CHECKED_IN")),
        Reserva.fecha_entrada < datos.nueva_fecha_salida,
        Reserva.fecha_salida > reserva.fecha_salida,
    ).first()
    if conflicto:
        raise HTTPException(
            status_code=409,
            detail="La habitacion no esta disponible para la nueva fecha de salida",
        )

    noches_adicionales = (datos.nueva_fecha_salida - reserva.fecha_salida).days
    tipo_habitacion = db.query(Habitacion).filter(
        Habitacion.id == reserva.habitacion_id
    ).first()
    precio_noche = float(
        tipo_habitacion.tipo_habitacion.precio_base
        if tipo_habitacion and tipo_habitacion.tipo_habitacion
        else 0
    )
    config = db.query(HotelConfig).first()
    tasa_impuesto = float((config.impuesto if config else 15.0) or 15.0) / 100
    subtotal_adicional = round(precio_noche * noches_adicionales, 2)
    impuesto_adicional = round(subtotal_adicional * tasa_impuesto, 2)
    total_adicional = round(subtotal_adicional + impuesto_adicional, 2)

    fecha_anterior = reserva.fecha_salida
    reserva.fecha_salida = datos.nueva_fecha_salida
    reserva.subtotal = round((reserva.subtotal or 0) + subtotal_adicional, 2)
    reserva.impuesto = round((reserva.impuesto or 0) + impuesto_adicional, 2)
    reserva.total = round((reserva.total or 0) + total_adicional, 2)
    total_pagado = sum(float(pago.monto or 0) for pago in reserva.pagos)
    saldo_pendiente = max(round(reserva.total - total_pagado, 2), 0)

    cargo = Cargo(
        reserva_id=reserva_id,
        descripcion=f"Extension de estadia: {noches_adicionales} noche(s)",
        cantidad=noches_adicionales,
        precio_unitario=precio_noche,
        total=subtotal_adicional,
        creado_por=usuario_actual.id,
    )
    db.add(cargo)
    db.commit()
    db.refresh(estadia)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="EXTENDER_ESTADIA",
        tipo_entidad="Reserva",
        entidad_id=reserva_id,
        valores_anteriores={"fecha_salida": fecha_anterior},
        valores_nuevos={
            "fecha_salida": datos.nueva_fecha_salida,
            "noches_adicionales": noches_adicionales,
            "total_adicional": total_adicional,
        },
        direccion_ip=request.client.host if request.client else None,
    )
    respuesta = EstadiaResponse.model_validate(estadia)
    return respuesta.model_copy(update={
        "nueva_fecha_salida": reserva.fecha_salida,
        "noches_adicionales": noches_adicionales,
        "total_adicional": total_adicional,
        "nuevo_total": reserva.total,
        "saldo_pendiente": saldo_pendiente,
    })


@router.post("/{reserva_id}/check-in", response_model=EstadiaResponse)
def realizar_check_in(
    reserva_id: str,
    datos: CheckInRequest,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva no encontrada",
        )
    if reserva.estado not in ("PENDIENTE", "CONFIRMADA"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede hacer check-in a una reserva en estado {reserva.estado}",
        )

    habitacion = db.query(Habitacion).filter(Habitacion.id == datos.habitacion_id).first()
    if not habitacion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Habitacion no encontrada",
        )
    if habitacion.estado_operativo != "DISPONIBLE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La habitacion no esta disponible",
        )

    estadia_existente = (
        db.query(Estadia).filter(Estadia.reserva_id == reserva_id).first()
    )
    if estadia_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El check-in ya fue realizado para esta reserva",
        )

    reserva.habitacion_id = datos.habitacion_id
    reserva.estado = "CHECKED_IN"
    habitacion.estado_operativo = "OCUPADA"

    estadia = Estadia(
        reserva_id=reserva_id,
        check_in_real=datetime.now(timezone.utc),
        check_in_realizado_por=usuario_actual.id,
        estado="ACTIVA",
    )
    db.add(estadia)
    db.commit()
    db.refresh(estadia)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CHECK_IN",
        tipo_entidad="Reserva",
        entidad_id=reserva_id,
        valores_nuevos={
            "estado": "CHECKED_IN",
            "habitacion_id": datos.habitacion_id,
        },
        direccion_ip=request.client.host if request.client else None,
    )

    return EstadiaResponse.model_validate(estadia)
@router.post("/{reserva_id}/check-out", response_model=EstadiaResponse)
def realizar_check_out(
    reserva_id: str,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva no encontrada",
        )
    if reserva.estado != "CHECKED_IN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede hacer check-out a una reserva en estado {reserva.estado}",
        )

    estadia = db.query(Estadia).filter(Estadia.reserva_id == reserva_id).first()
    if not estadia:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontro una estadia activa para esta reserva",
        )

    reserva.estado = "CHECKED_OUT"
    estadia.check_out_real = datetime.now(timezone.utc)
    estadia.check_out_realizado_por = usuario_actual.id
    estadia.estado = "COMPLETADA"

    if reserva.habitacion_id:
        habitacion = (
            db.query(Habitacion)
            .filter(Habitacion.id == reserva.habitacion_id)
            .first()
        )
        if habitacion:
            habitacion.estado_operativo = "DISPONIBLE"
            habitacion.estado_limpieza = "SUCIA"

            # Auto-create cleaning task on check-out
            nombre_huesped = ""
            if hasattr(reserva, "huesped") and reserva.huesped:
                nombre_huesped = f"{reserva.huesped.nombres} {reserva.huesped.apellidos}"

            tarea = TareaLimpieza(
                habitacion_id=habitacion.id,
                fecha_tarea=date.today(),
                tipo_limpieza="SALIDA",
                prioridad="alta",
                estado="PENDIENTE",
                notas=f"Limpieza posterior a check-out{' – ' + nombre_huesped if nombre_huesped else ''}",
            )
            db.add(tarea)

    db.commit()
    db.refresh(estadia)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CHECK_OUT",
        tipo_entidad="Reserva",
        entidad_id=reserva_id,
        valores_nuevos={"estado": "CHECKED_OUT"},
        direccion_ip=request.client.host if request.client else None,
    )

    return EstadiaResponse.model_validate(estadia)
