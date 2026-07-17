from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.dependencies import PersonalUsuario
from app.common.auditoria import crear_registro_auditoria
from app.modules.facturacion.modelos import Cargo, Pago
from app.modules.facturacion.esquemas import (
    CargoCrear,
    CargoResponse,
    PagoCrear,
    PagoResponse,
    FolioResponse,
)
from app.modules.reservas.modelos import Reserva
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/reservas", tags=["Facturacion"])


@router.post("/{reserva_id}/cargos", response_model=CargoResponse, status_code=status.HTTP_201_CREATED)
def agregar_cargo(
    reserva_id: str,
    datos: CargoCrear,
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

    cargo = Cargo(
        reserva_id=reserva_id,
        descripcion=datos.descripcion,
        cantidad=datos.cantidad,
        precio_unitario=datos.precio_unitario,
        total=datos.total,
        creado_por=usuario_actual.id,
    )
    db.add(cargo)

    reserva.subtotal = (reserva.subtotal or 0) + datos.total
    reserva.total = (reserva.subtotal or 0) - (reserva.descuento or 0) + (reserva.impuesto or 0)

    db.commit()
    db.refresh(cargo)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CREAR",
        tipo_entidad="Cargo",
        entidad_id=cargo.id,
        valores_nuevos={
            "reserva_id": reserva_id,
            "descripcion": datos.descripcion,
            "total": datos.total,
        },
        direccion_ip=request.client.host if request.client else None,
    )

    return CargoResponse.model_validate(cargo)


@router.get("/{reserva_id}/cargos", response_model=list[CargoResponse])
def listar_cargos(
    reserva_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva no encontrada",
        )
    cargos = (
        db.query(Cargo)
        .filter(Cargo.reserva_id == reserva_id)
        .order_by(Cargo.fecha_cargo.desc())
        .all()
    )
    return [CargoResponse.model_validate(c) for c in cargos]


@router.post("/{reserva_id}/pagos", response_model=PagoResponse, status_code=status.HTTP_201_CREATED)
def registrar_pago(
    reserva_id: str,
    datos: PagoCrear,
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

    pago = Pago(
        reserva_id=reserva_id,
        monto=datos.monto,
        metodo_pago=datos.metodo_pago,
        referencia=datos.referencia,
        recibido_por=usuario_actual.id,
    )
    db.add(pago)
    db.commit()
    db.refresh(pago)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CREAR",
        tipo_entidad="Pago",
        entidad_id=pago.id,
        valores_nuevos={
            "reserva_id": reserva_id,
            "monto": datos.monto,
            "metodo_pago": datos.metodo_pago,
        },
        direccion_ip=request.client.host if request.client else None,
    )

    return PagoResponse.model_validate(pago)


@router.get("/{reserva_id}/pagos", response_model=list[PagoResponse])
def listar_pagos(
    reserva_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva no encontrada",
        )
    pagos = (
        db.query(Pago)
        .filter(Pago.reserva_id == reserva_id)
        .order_by(Pago.pagado_en.desc())
        .all()
    )
    return [PagoResponse.model_validate(p) for p in pagos]


@router.get("/{reserva_id}/folio", response_model=FolioResponse)
def obtener_folio(
    reserva_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva no encontrada",
        )

    cargos = db.query(Cargo).filter(Cargo.reserva_id == reserva_id).all()
    pagos = db.query(Pago).filter(Pago.reserva_id == reserva_id).all()

    total_pagado = db.query(func.sum(Pago.monto)).filter(Pago.reserva_id == reserva_id).scalar() or 0

    return FolioResponse(
        cargos=[CargoResponse.model_validate(c) for c in cargos],
        pagos=[PagoResponse.model_validate(p) for p in pagos],
        subtotal=reserva.subtotal or 0,
        descuento=reserva.descuento or 0,
        impuesto=reserva.impuesto or 0,
        total=reserva.total or 0,
        pagado=float(total_pagado),
        saldo=(reserva.total or 0) - float(total_pagado),
    )
