import secrets
import string
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func

from app.core.database import get_db
from app.core.dependencies import AdminUsuario, PersonalUsuario, ReservasModulo, HabitacionesModulo
from app.common.auditoria import crear_registro_auditoria
from app.modules.reservas.modelos import Reserva
from app.modules.estadias.modelos import Estadia
from app.modules.facturacion.modelos import Cargo, Pago
from app.modules.ventas.modelos import Consumo
from app.modules.reservas.esquemas import (
    ReservaCrear,
    ReservaActualizar,
    ReservaResponse,
    ReservaListaResponse,
    DisponibilidadRequest,
    DisponibilidadResponse,
    CancelarReserva,
    ReservasPaginadasResponse,
)
from app.modules.habitaciones.modelos import TipoHabitacion, Habitacion
from app.modules.configuracion.modelos import HotelConfig
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


def _habitaciones_disponibles_tipo(
    db: Session,
    fecha_entrada: date,
    fecha_salida: date,
    tipo_habitacion_id: str,
) -> int:
    total = db.query(Habitacion).filter(
        Habitacion.tipo_habitacion_id == tipo_habitacion_id,
        Habitacion.estado_operativo == "DISPONIBLE",
    ).count()

    ocupadas = (
        db.query(Reserva.habitacion_id)
        .join(Habitacion, Reserva.habitacion_id == Habitacion.id)
        .filter(
            Reserva.estado.in_(ESTADOS_OCUPAN_INVENTARIO),
            Reserva.fecha_entrada < fecha_salida,
            Reserva.fecha_salida > fecha_entrada,
            Reserva.habitacion_id.isnot(None),
            Habitacion.tipo_habitacion_id == tipo_habitacion_id,
        )
        .all()
    )

    sin_asignar = db.query(func.count(Reserva.id)).filter(
        Reserva.estado.in_(ESTADOS_OCUPAN_INVENTARIO),
        Reserva.fecha_entrada < fecha_salida,
        Reserva.fecha_salida > fecha_entrada,
        Reserva.habitacion_id.is_(None),
        Reserva.tipo_habitacion_id == tipo_habitacion_id,
    ).scalar() or 0

    return max(0, total - len({r[0] for r in ocupadas}) - int(sin_asignar))


def _recalcular_totales(db: Session, reserva: Reserva):
    tipo = (
        db.query(TipoHabitacion).filter(TipoHabitacion.id == reserva.tipo_habitacion_id).first()
        if reserva.tipo_habitacion_id else None
    )
    precio_base = tipo.precio_base if tipo else 0
    noches = max((reserva.fecha_salida - reserva.fecha_entrada).days, 0)

    config = db.query(HotelConfig).first()
    tasa = ((config.impuesto if config else 15.0) or 15.0) / 100

    cargos = db.query(func.coalesce(func.sum(Cargo.total), 0)).filter(
        Cargo.reserva_id == reserva.id
    ).scalar() or 0

    descuento = min(reserva.descuento or 0, precio_base * noches + float(cargos))
    subtotal_habitacion = round(precio_base * noches, 2)
    impuesto = round(subtotal_habitacion * tasa, 2)

    reserva.subtotal = round(subtotal_habitacion + float(cargos), 2)
    reserva.impuesto = impuesto
    reserva.descuento = round(descuento, 2)
    reserva.total = max(round(subtotal_habitacion + float(cargos) + impuesto - descuento, 2), 0)


@router.get("", response_model=ReservasPaginadasResponse, dependencies=[Depends(ReservasModulo)])
def listar_reservas(
    estado: str | None = Query(None),
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    huesped_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    consulta = db.query(Reserva).options(
        joinedload(Reserva.huesped),
        joinedload(Reserva.habitacion_ref),
        joinedload(Reserva.tipo_habitacion_ref),
    )
    if estado:
        consulta = consulta.filter(Reserva.estado == estado)
    if fecha_desde:
        consulta = consulta.filter(Reserva.fecha_entrada >= fecha_desde)
    if fecha_hasta:
        consulta = consulta.filter(Reserva.fecha_salida <= fecha_hasta)
    if huesped_id:
        consulta = consulta.filter(Reserva.huesped_id == huesped_id)

    total = consulta.count()
    reservas = (
        consulta
        .order_by(Reserva.fecha_entrada.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    resultado = []
    for r in reservas:
        nombre = f"{r.huesped.nombres} {r.huesped.apellidos}" if r.huesped else None
        resultado.append(ReservaListaResponse(
            id=r.id,
            codigo_confirmacion=r.codigo_confirmacion,
            huesped_nombre=nombre,
            numero_habitacion=r.habitacion_ref.numero if r.habitacion_ref else None,
            tipo_habitacion_nombre=r.tipo_habitacion_ref.nombre if r.tipo_habitacion_ref else None,
            fecha_entrada=r.fecha_entrada,
            fecha_salida=r.fecha_salida,
            estado=r.estado,
            total=r.total,
            creado_en=r.creado_en,
        ))

    return ReservasPaginadasResponse(
        items=resultado,
        total=total,
        page=page,
        pages=(total + per_page - 1) // per_page,
        per_page=per_page,
    )


@router.post("", response_model=ReservaResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(ReservasModulo)])
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
    elif datos.tipo_habitacion_id:
        disponibles = _habitaciones_disponibles_tipo(
            db, datos.fecha_entrada, datos.fecha_salida, datos.tipo_habitacion_id
        )
        if disponibles <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No hay habitaciones disponibles de ese tipo en las fechas seleccionadas",
            )

    precio_base = tipo_habitacion.precio_base if tipo_habitacion else 0
    noches = (datos.fecha_salida - datos.fecha_entrada).days
    subtotal = precio_base * noches
    config = db.query(HotelConfig).first()
    porcentaje_impuesto = (config.impuesto if config else 15.0) / 100
    impuesto = round(subtotal * porcentaje_impuesto, 2)
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
        tiene_vehiculo=datos.tiene_vehiculo,
        detalle_vehiculo=datos.detalle_vehiculo if datos.tiene_vehiculo else None,
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


@router.get("/{reserva_id}", response_model=ReservaResponse, dependencies=[Depends(ReservasModulo)])
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


@router.put("/{reserva_id}", response_model=ReservaResponse, dependencies=[Depends(ReservasModulo)])
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
    datos_actualizar = datos.model_dump(exclude_unset=True)

    if "estado" in datos_actualizar and datos.estado != reserva.estado:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El estado no se cambia por esta via. Usa confirmar, no-show, cancelar o check-in.",
        )

    if datos.estado == "CHECKED_IN" and reserva.estado != "CHECKED_IN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Para marcar ingreso usa check-in y asigna una habitacion disponible",
        )

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

    for campo, valor in datos_actualizar.items():
        setattr(reserva, campo, valor)

    campos_que_afectan_precio = {"fecha_entrada", "fecha_salida", "descuento", "tipo_habitacion_id"}
    if campos_que_afectan_precio & set(datos_actualizar.keys()):
        _recalcular_totales(db, reserva)

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


@router.post("/{reserva_id}/confirmar", response_model=ReservaResponse, dependencies=[Depends(ReservasModulo)])
def confirmar_reserva(
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
    if reserva.estado != "PENDIENTE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se pueden confirmar reservas pendientes. Estado actual: {reserva.estado}",
        )

    estado_anterior = reserva.estado
    reserva.estado = "CONFIRMADA"
    db.commit()
    db.refresh(reserva)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CONFIRMAR",
        tipo_entidad="Reserva",
        entidad_id=reserva.id,
        valores_anteriores={"estado": estado_anterior},
        valores_nuevos={"estado": "CONFIRMADA"},
        direccion_ip=request.client.host if request.client else None,
    )

    return ReservaResponse.model_validate(reserva)


@router.post("/{reserva_id}/no-show", response_model=ReservaResponse, dependencies=[Depends(ReservasModulo)])
def marcar_no_show(
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
    if reserva.estado not in ("PENDIENTE", "CONFIRMADA"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se puede marcar NO_SHOW en reservas pendientes o confirmadas. Estado actual: {reserva.estado}",
        )

    estado_anterior = reserva.estado
    reserva.estado = "NO_SHOW"
    db.commit()
    db.refresh(reserva)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="NO_SHOW",
        tipo_entidad="Reserva",
        entidad_id=reserva.id,
        valores_anteriores={"estado": estado_anterior},
        valores_nuevos={"estado": "NO_SHOW"},
        direccion_ip=request.client.host if request.client else None,
    )

    return ReservaResponse.model_validate(reserva)


@router.post("/{reserva_id}/cancelar", response_model=ReservaResponse, dependencies=[Depends(ReservasModulo)])
def cancelar_reserva(
    reserva_id: str,
    request: Request,
    datos: CancelarReserva | None = None,
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
            detail=f"Solo se pueden cancelar reservas pendientes o confirmadas. Estado actual: {reserva.estado}",
        )

    valores_anteriores_estado = reserva.estado
    motivo = (datos.motivo or "").strip() if datos else ""
    reserva.estado = "CANCELADA"
    reserva.motivo_cancelacion = motivo or None
    db.commit()
    db.refresh(reserva)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CANCELAR",
        tipo_entidad="Reserva",
        entidad_id=reserva.id,
        valores_anteriores={"estado": valores_anteriores_estado},
        valores_nuevos={"estado": "CANCELADA", "motivo": motivo or None},
        direccion_ip=request.client.host if request.client else None,
    )

    return ReservaResponse.model_validate(reserva)


@router.delete("/{reserva_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(ReservasModulo)])
def eliminar_reserva(
    reserva_id: str,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva no encontrada",
        )
    if reserva.estado == "CHECKED_IN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar una reserva con hospedaje activo",
        )

    pagos = db.query(Pago).filter(Pago.reserva_id == reserva_id).count()
    if pagos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar una reserva con pagos registrados. Cancelala en su lugar.",
        )

    valores_anteriores = {
        "codigo_confirmacion": reserva.codigo_confirmacion,
        "estado": reserva.estado,
        "fecha_entrada": str(reserva.fecha_entrada),
        "fecha_salida": str(reserva.fecha_salida),
    }

    db.query(Consumo).filter(Consumo.reserva_id == reserva_id).delete()
    db.query(Cargo).filter(Cargo.reserva_id == reserva_id).delete()
    db.query(Pago).filter(Pago.reserva_id == reserva_id).delete()
    db.query(Estadia).filter(Estadia.reserva_id == reserva_id).delete()
    db.delete(reserva)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ELIMINAR",
        tipo_entidad="Reserva",
        entidad_id=reserva_id,
        valores_anteriores=valores_anteriores,
        direccion_ip=request.client.host if request.client else None,
    )
    db.commit()


@router_disponibilidad.get("", response_model=DisponibilidadResponse, dependencies=[Depends(HabitacionesModulo)])
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
