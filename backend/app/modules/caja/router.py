from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.database import get_db
from app.core.dependencies import PersonalUsuario, CajaModulo
from app.common.auditoria import crear_registro_auditoria
from app.modules.caja.modelos import SesionCaja
from app.modules.caja.esquemas import (
    SesionCajaAbrir,
    SesionCajaCerrar,
    SesionCajaResponse,
    SesionesCajaPaginadas,
)
from app.modules.facturacion.modelos import Pago
from app.modules.ventas.modelos import VentaParticular
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/sesiones-caja", tags=["Caja"])

METODO_EFECTIVO = "efectivo"


def _pagos_sesion(db: Session, sesion: SesionCaja) -> list[Pago]:
    filtros = [
        Pago.recibido_por == sesion.usuario_id,
        Pago.pagado_en >= sesion.abierta_en,
        Pago.estado == "completado",
    ]
    if sesion.cerrada_en:
        filtros.append(Pago.pagado_en <= sesion.cerrada_en)
    return (
        db.query(Pago)
        .filter(*filtros)
        .all()
    )


def _ventas_particulares_sesion(db: Session, sesion: SesionCaja) -> list[VentaParticular]:
    filtros = [
        VentaParticular.creado_por == sesion.usuario_id,
        VentaParticular.creado_en >= sesion.abierta_en,
    ]
    if sesion.cerrada_en:
        filtros.append(VentaParticular.creado_en <= sesion.cerrada_en)
    return (
        db.query(VentaParticular)
        .filter(*filtros)
        .all()
    )


def _desglose_pagos(pagos: list[Pago], ventas_particulares: list[VentaParticular] | None = None) -> dict:
    por_metodo: dict[str, float] = {}
    for pago in pagos:
        metodo = (pago.metodo_pago or "Otro").strip()
        por_metodo[metodo] = round(por_metodo.get(metodo, 0) + float(pago.monto), 2)
    for venta in ventas_particulares or []:
        metodo = (venta.metodo_pago or "Otro").strip()
        por_metodo[metodo] = round(por_metodo.get(metodo, 0) + float(venta.total or 0), 2)
    efectivo = sum(
        monto for metodo, monto in por_metodo.items()
        if metodo.lower() == METODO_EFECTIVO
    )
    return {
        "por_metodo": por_metodo,
        "total_pagos": round(sum(float(p.monto) for p in pagos) + sum(float(v.total or 0) for v in (ventas_particulares or [])), 2),
        "cantidad_pagos": len(pagos) + len(ventas_particulares or []),
        "efectivo": round(efectivo, 2),
    }


@router.post("/abrir", response_model=SesionCajaResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(CajaModulo)])
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


@router.get("/activa", response_model=SesionCajaResponse, dependencies=[Depends(CajaModulo)])
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


@router.get("/{sesion_id}/resumen", response_model=dict, dependencies=[Depends(CajaModulo)])
def obtener_resumen_sesion(
    sesion_id: str,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    sesion = db.query(SesionCaja).filter(SesionCaja.id == sesion_id).first()
    if not sesion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesion de caja no encontrada",
        )
    if sesion.usuario_id != usuario_actual.id and usuario_actual.rol not in ("admin", "gerente"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes consultar esta sesion de caja")
    desglose = _desglose_pagos(_pagos_sesion(db, sesion), _ventas_particulares_sesion(db, sesion))
    return {
        "sesion_id": sesion.id,
        "estado": sesion.estado,
        "abierta_en": sesion.abierta_en.isoformat() if sesion.abierta_en else None,
        "cerrada_en": sesion.cerrada_en.isoformat() if sesion.cerrada_en else None,
        "monto_apertura": float(sesion.monto_apertura or 0),
        **desglose,
        "esperado_caja": round(float(sesion.monto_apertura or 0) + desglose["efectivo"], 2),
    }


@router.post("/{sesion_id}/cerrar", response_model=SesionCajaResponse, dependencies=[Depends(CajaModulo)])
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
    es_propia = sesion.usuario_id == usuario_actual.id
    puede_supervisar = usuario_actual.rol in ("admin", "gerente")
    if not es_propia and not puede_supervisar:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes cerrar una sesion de caja que no te pertenece",
        )

    desglose = _desglose_pagos(_pagos_sesion(db, sesion), _ventas_particulares_sesion(db, sesion))

    sesion.monto_esperado = round(float(sesion.monto_apertura or 0) + desglose["efectivo"], 2)
    sesion.monto_declarado = datos.monto_declarado
    sesion.diferencia = round(datos.monto_declarado - sesion.monto_esperado, 2)
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
            "monto_declarado": sesion.monto_declarado,
            "diferencia": sesion.diferencia,
            "cerrada_por_propietario": es_propia,
        },
        direccion_ip=request.client.host if request.client else None,
    )

    return SesionCajaResponse.model_validate(sesion)


@router.get("", response_model=SesionesCajaPaginadas, dependencies=[Depends(CajaModulo)])
def listar_sesiones_caja(
    estado: str | None = Query(None),
    usuario_id: str | None = Query(None),
    desde: datetime | None = Query(None),
    hasta: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    consulta = db.query(SesionCaja).options(joinedload(SesionCaja.usuario))
    if estado:
        consulta = consulta.filter(SesionCaja.estado == estado.upper())
    if usuario_id:
        consulta = consulta.filter(SesionCaja.usuario_id == usuario_id)
    if desde:
        consulta = consulta.filter(SesionCaja.abierta_en >= desde)
    if hasta:
        consulta = consulta.filter(SesionCaja.abierta_en <= hasta)

    total = consulta.count()
    sesiones = (
        consulta
        .order_by(SesionCaja.abierta_en.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return SesionesCajaPaginadas(
        items=[SesionCajaResponse.model_validate(s) for s in sesiones],
        total=total,
        page=page,
        pages=(total + per_page - 1) // per_page,
        per_page=per_page,
    )
