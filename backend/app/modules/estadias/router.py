from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import PersonalUsuario
from app.common.auditoria import crear_registro_auditoria
from app.modules.estadias.modelos import Estadia
from app.modules.estadias.esquemas import CheckInRequest, CheckOutRequest, EstadiaResponse
from app.modules.reservas.modelos import Reserva
from app.modules.habitaciones.modelos import Habitacion
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/reservas", tags=["Estadias"])


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
