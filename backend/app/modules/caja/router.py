from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.dependencies import PersonalUsuario
from app.common.auditoria import crear_registro_auditoria
from app.modules.caja.modelos import SesionCaja
from app.modules.caja.esquemas import SesionCajaAbrir, SesionCajaCerrar, SesionCajaResponse
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/sesiones-caja", tags=["Caja"])


@router.post("/abrir", response_model=SesionCajaResponse, status_code=status.HTTP_201_CREATED)
def abrir_sesion_caja(
    datos: SesionCajaAbrir,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    sesion_activa = (
        db.query(SesionCaja)
        .filter(
            SesionCaja.usuario_id == usuario_actual.id,
            SesionCaja.estado == "ABIERTA",
        )
        .first()
    )
    if sesion_activa:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya tienes una sesion de caja abierta",
        )

    sesion = SesionCaja(
        usuario_id=usuario_actual.id,
        monto_apertura=datos.monto_apertura,
    )
    db.add(sesion)
    db.commit()
    db.refresh(sesion)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ABRIR_CAJA",
        tipo_entidad="SesionCaja",
        entidad_id=sesion.id,
        valores_nuevos={"monto_apertura": datos.monto_apertura},
        direccion_ip=request.client.host if request.client else None,
    )

    return SesionCajaResponse.model_validate(sesion)


@router.post("/{sesion_id}/cerrar", response_model=SesionCajaResponse)
def cerrar_sesion_caja(
    sesion_id: str,
    datos: SesionCajaCerrar,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    sesion = db.query(SesionCaja).filter(SesionCaja.id == sesion_id).first()
    if not sesion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesion de caja no encontrada",
        )
    if sesion.estado != "ABIERTA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La sesion de caja ya esta cerrada",
        )
    if sesion.usuario_id != usuario_actual.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes cerrar una sesion de caja que no te pertenece",
        )

    from app.modules.facturacion.modelos import Pago

    total_pagos = (
        db.query(func.sum(Pago.monto))
        .filter(
            Pago.recibido_por == usuario_actual.id,
            Pago.pagado_en >= sesion.abierta_en,
        )
        .scalar()
        or 0
    )

    sesion.monto_esperado = sesion.monto_apertura + float(total_pagos)
    sesion.monto_declarado = datos.monto_declarado
    sesion.diferencia = datos.monto_declarado - sesion.monto_esperado
    sesion.cerrada_en = datetime.now(timezone.utc)
    sesion.estado = "CERRADA"
    db.commit()
    db.refresh(sesion)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CERRAR_CAJA",
        tipo_entidad="SesionCaja",
        entidad_id=sesion.id,
        valores_anteriores={"estado": "ABIERTA"},
        valores_nuevos={
            "estado": "CERRADA",
            "monto_esperado": sesion.monto_esperado,
            "diferencia": sesion.diferencia,
        },
        direccion_ip=request.client.host if request.client else None,
    )

    return SesionCajaResponse.model_validate(sesion)


@router.get("", response_model=list[SesionCajaResponse])
def listar_sesiones_caja(
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    sesiones = (
        db.query(SesionCaja)
        .order_by(SesionCaja.abierta_en.desc())
        .all()
    )
    return [SesionCajaResponse.model_validate(s) for s in sesiones]


@router.get("/activa", response_model=SesionCajaResponse)
def obtener_sesion_activa(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    sesion = (
        db.query(SesionCaja)
        .filter(
            SesionCaja.usuario_id == usuario_actual.id,
            SesionCaja.estado == "ABIERTA",
        )
        .first()
    )
    if not sesion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tienes una sesion de caja abierta",
        )
    return SesionCajaResponse.model_validate(sesion)
