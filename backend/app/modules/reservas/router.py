import secrets
import string
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.core.database import get_db
from app.core.dependencies import PersonalUsuario
from app.common.auditoria import crear_registro_auditoria
from app.modules.reservas.modelos import Reserva
from app.modules.reservas.esquemas import (
    ReservaCrear,
    ReservaActualizar,
    ReservaResponse,
    ReservaListaResponse,
    DisponibilidadRequest,
    DisponibilidadResponse,
)
from app.modules.habitaciones.modelos import TipoHabitacion, Habitacion
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/reservas", tags=["Reservas"])
router_disponibilidad = APIRouter(prefix="/disponibilidad", tags=["Disponibilidad"])

ESTADOS_OCUPAN_INVENTARIO = ["PENDIENTE", "CONFIRMADA", "CHECKED_IN"]


def generar_codigo_confirmacion() -> str:
    caracteres = string.ascii_uppercase + string.digits
    return "RES-" + "".join(secrets.choice(caracteres) for _ in range(8))


def _tiene_conflicto(
    db: Session,
    fecha_entrada: date,
    fecha_salida: date,
    habitacion_id: str | None = None,
    tipo_habitacion_id: str | None = None,
    excluir_reserva_id: str | None = None,
) -> bool:
    consulta = db.query(Reserva).filter(
        Reserva.estado.in_(ESTADOS_OCUPAN_INVENTARIO),
        Reserva.fecha_entrada < fecha_salida,
        Reserva.fecha_salida > fecha_entrada,
    )
    if habitacion_id:
        consulta = consulta.filter(Reserva.habitacion_id == habitacion_id)
    if tipo_habitacion_id:
        consulta = consulta.filter(Reserva.tipo_habitacion_id == tipo_habitacion_id)
    if excluir_reserva_id:
        consulta = consulta.filter(Reserva.id != excluir_reserva_id)
    return consulta.first() is not None


@router.get("", response_model=list[ReservaListaResponse])
def listar_reservas(
    estado: str | None = Query(None),
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    huesped_id: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    consulta = db.query(Reserva)
    if estado:
        consulta = consulta.filter(Reserva.estado == estado)
    if fecha_desde:
        consulta = consulta.filter(Reserva.fecha_entrada >= fecha_desde)
    if fecha_hasta:
        consulta = consulta.filter(Reserva.fecha_salida <= fecha_hasta)
    if huesped_id:
        consulta = consulta.filter(Reserva.huesped_id == huesped_id)

    reservas = consulta.order_by(Reserva.fecha_entrada.desc()).all()
    resultado = []
    for r in reservas:
        nombre = None
        if r.huesped:
            nombre = f"{r.huesped.nombres} {r.huesped.apellidos}"
        item = ReservaListaResponse(
            id=r.id,
            codigo_confirmacion=r.codigo_confirmacion,
            huesped_nombre=nombre,
            fecha_entrada=r.fecha_entrada,
            fecha_salida=r.fecha_salida,
            estado=r.estado,
            total=r.total,
            creado_en=r.creado_en,
        )
        resultado.append(item)
    return resultado


@router.post("", response_model=ReservaResponse, status_code=status.HTTP_201_CREATED)
def crear_reserva(
    datos: ReservaCrear,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    if datos.fecha_entrada >= datos.fecha_salida:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de salida debe ser posterior a la fecha de entrada",
        )
    if datos.fecha_entrada < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de entrada no puede ser en el pasado",
        )

    tipo_habitacion = None
    if datos.tipo_habitacion_id:
        tipo_habitacion = (
            db.query(TipoHabitacion)
            .filter(TipoHabitacion.id == datos.tipo_habitacion_id)
            .first()
        )
        if not tipo_habitacion:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tipo de habitacion no encontrado",
            )

    if datos.habitacion_id:
        habitacion = (
            db.query(Habitacion).filter(Habitacion.id == datos.habitacion_id).first()
        )
        if not habitacion:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Habitacion no encontrada",
            )
        if _tiene_conflicto(
            db, datos.fecha_entrada, datos.fecha_salida, habitacion_id=datos.habitacion_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La habitacion no esta disponible en las fechas seleccionadas",
            )

    precio_base = tipo_habitacion.precio_base if tipo_habitacion else 0
    noches = (datos.fecha_salida - datos.fecha_entrada).days
    subtotal = precio_base * noches
    impuesto = round(subtotal * 0.15, 2)
    descuento = datos.descuento or 0
    total = subtotal + impuesto - descuento
    if total < 0:
        total = 0

    reserva = Reserva(
        codigo_confirmacion=generar_codigo_confirmacion(),
        huesped_id=datos.huesped_id,
        tipo_habitacion_id=datos.tipo_habitacion_id,
        habitacion_id=datos.habitacion_id,
        creada_por=usuario_actual.id,
        fecha_entrada=datos.fecha_entrada,
        fecha_salida=datos.fecha_salida,
        adultos=datos.adultos,
        ninos=datos.ninos,
        origen=datos.origen,
        subtotal=subtotal,
        descuento=descuento,
        impuesto=impuesto,
        total=total,
        solicitudes_especiales=datos.solicitudes_especiales,
    )
    db.add(reserva)
    db.commit()
    db.refresh(reserva)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CREAR",
        tipo_entidad="Reserva",
        entidad_id=reserva.id,
        valores_nuevos={
            "codigo_confirmacion": reserva.codigo_confirmacion,
            "fecha_entrada": str(reserva.fecha_entrada),
            "fecha_salida": str(reserva.fecha_salida),
            "total": reserva.total,
        },
        direccion_ip=request.client.host if request.client else None,
    )

    return ReservaResponse.model_validate(reserva)


@router.get("/{reserva_id}", response_model=ReservaResponse)
def obtener_reserva(
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
    return ReservaResponse.model_validate(reserva)


@router.put("/{reserva_id}", response_model=ReservaResponse)
def actualizar_reserva(
    reserva_id: str,
    datos: ReservaActualizar,
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

    valores_anteriores = {
        "fecha_entrada": str(reserva.fecha_entrada),
        "fecha_salida": str(reserva.fecha_salida),
        "habitacion_id": reserva.habitacion_id,
        "estado": reserva.estado,
    }

    nueva_entrada = datos.fecha_entrada or reserva.fecha_entrada
    nueva_salida = datos.fecha_salida or reserva.fecha_salida
    if nueva_entrada >= nueva_salida:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de salida debe ser posterior a la fecha de entrada",
        )

    nueva_habitacion_id = datos.habitacion_id or reserva.habitacion_id
    if nueva_habitacion_id:
        if _tiene_conflicto(
            db,
            nueva_entrada,
            nueva_salida,
            habitacion_id=nueva_habitacion_id,
            excluir_reserva_id=reserva_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La habitacion no esta disponible en las fechas seleccionadas",
            )

    datos_actualizar = datos.model_dump(exclude_unset=True)
    for campo, valor in datos_actualizar.items():
        setattr(reserva, campo, valor)

    db.commit()
    db.refresh(reserva)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ACTUALIZAR",
        tipo_entidad="Reserva",
        entidad_id=reserva.id,
        valores_anteriores=valores_anteriores,
        valores_nuevos={
            "fecha_entrada": str(reserva.fecha_entrada),
            "fecha_salida": str(reserva.fecha_salida),
            "habitacion_id": reserva.habitacion_id,
            "estado": reserva.estado,
        },
        direccion_ip=request.client.host if request.client else None,
    )

    return ReservaResponse.model_validate(reserva)


@router.post("/{reserva_id}/cancelar", response_model=ReservaResponse)
def cancelar_reserva(
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
    if reserva.estado in ("CANCELADA", "CHECKED_OUT", "NO_SHOW"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede cancelar una reserva en estado {reserva.estado}",
        )

    reserva.estado = "CANCELADA"
    db.commit()
    db.refresh(reserva)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CANCELAR",
        tipo_entidad="Reserva",
        entidad_id=reserva.id,
        valores_anteriores={"estado": "ACTIVA"},
        valores_nuevos={"estado": "CANCELADA"},
        direccion_ip=request.client.host if request.client else None,
    )

    return ReservaResponse.model_validate(reserva)


@router_disponibilidad.get("", response_model=DisponibilidadResponse)
def verificar_disponibilidad(
    fecha_entrada: date = Query(...),
    fecha_salida: date = Query(...),
    tipo_habitacion_id: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    if fecha_entrada >= fecha_salida:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de salida debe ser posterior a la fecha de entrada",
        )

    consulta_habitaciones = db.query(Habitacion).filter(
        Habitacion.estado_operativo == "DISPONIBLE"
    )
    if tipo_habitacion_id:
        consulta_habitaciones = consulta_habitaciones.filter(
            Habitacion.tipo_habitacion_id == tipo_habitacion_id
        )

    todas_las_habitaciones = consulta_habitaciones.all()

    habitaciones_ocupadas_ids = set()
    reservas_conflictivas = (
        db.query(Reserva.habitacion_id)
        .filter(
            Reserva.estado.in_(ESTADOS_OCUPAN_INVENTARIO),
            Reserva.fecha_entrada < fecha_salida,
            Reserva.fecha_salida > fecha_entrada,
            Reserva.habitacion_id.isnot(None),
        )
        .all()
    )
    habitaciones_ocupadas_ids = {r[0] for r in reservas_conflictivas}

    habitaciones_disponibles = [
        h
        for h in todas_las_habitaciones
        if h.id not in habitaciones_ocupadas_ids
    ]

    tipos_conteo = {}
    for h in habitaciones_disponibles:
        tid = h.tipo_habitacion_id
        if tid not in tipos_conteo:
            tipos_conteo[tid] = {"tipo_habitacion_id": tid, "disponibles": 0}
        tipos_conteo[tid]["disponibles"] += 1

    return DisponibilidadResponse(
        disponible=len(habitaciones_disponibles) > 0,
        habitaciones_disponibles=len(habitaciones_disponibles),
        tipos_habitacion=list(tipos_conteo.values()),
    )
