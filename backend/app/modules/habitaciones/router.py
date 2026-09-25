from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import AdminUsuario, LimpiezaUsuario, PersonalUsuario
from app.common.auditoria import crear_registro_auditoria
from app.modules.habitaciones.modelos import MetodoPago, TipoHabitacion, Habitacion, Piso
from app.modules.habitaciones.esquemas import (
    MetodoPagoActualizar,
    MetodoPagoCrear,
    MetodoPagoResponse,
    TipoHabitacionCrear,
    TipoHabitacionActualizar,
    TipoHabitacionResponse,
    HabitacionCrear,
    HabitacionActualizar,
    HabitacionResponse,
    HabitacionEstadoActualizar,
    PisoCrear,
    PisoActualizar,
    PisoResponse,
)
from app.modules.usuarios.modelos import Usuario

router_tipos = APIRouter(prefix="/tipos-habitacion", tags=["Tipos de Habitacion"])
router_habitaciones = APIRouter(prefix="/habitaciones", tags=["Habitaciones"])
router_pisos = APIRouter(prefix="/pisos", tags=["Pisos"])
router_pagos = APIRouter(prefix="/metodos-pago", tags=["Metodos de Pago"])


def _habitacion_response(habitacion: Habitacion) -> HabitacionResponse:
    return HabitacionResponse(
        id=habitacion.id,
        tipo_habitacion_id=habitacion.tipo_habitacion_id,
        piso_id=habitacion.piso_id,
        numero=habitacion.numero,
        piso=habitacion.piso.nombre if habitacion.piso else None,
        estado_operativo=habitacion.estado_operativo,
        estado_limpieza=habitacion.estado_limpieza,
        notas=habitacion.notas,
        creado_en=habitacion.creado_en,
        actualizado_en=habitacion.actualizado_en,
        tipo_habitacion=(
            TipoHabitacionResponse.model_validate(habitacion.tipo_habitacion)
            if habitacion.tipo_habitacion
            else None
        ),
    )


@router_tipos.get("", response_model=list[TipoHabitacionResponse])
def listar_tipos_habitacion(
    db: Session = Depends(get_db),
    _: Usuario = Depends(LimpiezaUsuario),
):
    tipos = db.query(TipoHabitacion).all()
    return [TipoHabitacionResponse.model_validate(t) for t in tipos]


@router_tipos.post("", response_model=TipoHabitacionResponse, status_code=status.HTTP_201_CREATED)
def crear_tipo_habitacion(
    datos: TipoHabitacionCrear,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    existe = db.query(TipoHabitacion).filter(TipoHabitacion.codigo == datos.codigo).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El codigo del tipo de habitacion ya existe",
        )

    tipo = TipoHabitacion(**datos.model_dump())
    db.add(tipo)
    db.commit()
    db.refresh(tipo)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CREAR",
        tipo_entidad="TipoHabitacion",
        entidad_id=tipo.id,
        valores_nuevos=datos.model_dump(),
        direccion_ip=request.client.host if request.client else None,
    )

    return TipoHabitacionResponse.model_validate(tipo)


@router_tipos.put("/{tipo_id}", response_model=TipoHabitacionResponse)
def actualizar_tipo_habitacion(
    tipo_id: str,
    datos: TipoHabitacionActualizar,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    tipo = db.query(TipoHabitacion).filter(TipoHabitacion.id == tipo_id).first()
    if not tipo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de habitacion no encontrado",
        )

    valores_anteriores = {
        "codigo": tipo.codigo,
        "nombre": tipo.nombre,
        "precio_base": tipo.precio_base,
        "estado": tipo.estado,
    }

    datos_actualizar = datos.model_dump(exclude_unset=True)
    nuevo_codigo = datos_actualizar.get("codigo")
    if nuevo_codigo and nuevo_codigo != tipo.codigo:
        existe = db.query(TipoHabitacion).filter(TipoHabitacion.codigo == nuevo_codigo).first()
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El codigo del tipo de habitacion ya existe",
            )

    for campo, valor in datos_actualizar.items():
        setattr(tipo, campo, valor)

    db.commit()
    db.refresh(tipo)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ACTUALIZAR",
        tipo_entidad="TipoHabitacion",
        entidad_id=tipo.id,
        valores_anteriores=valores_anteriores,
        valores_nuevos=datos_actualizar,
        direccion_ip=request.client.host if request.client else None,
    )

    return TipoHabitacionResponse.model_validate(tipo)


@router_tipos.delete("/{tipo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_tipo_habitacion(
    tipo_id: str,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    tipo = db.query(TipoHabitacion).filter(TipoHabitacion.id == tipo_id).first()
    if not tipo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tipo de habitacion no encontrado",
        )

    habitaciones = db.query(Habitacion).filter(Habitacion.tipo_habitacion_id == tipo_id).count()
    if habitaciones:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar un tipo con habitaciones asignadas",
        )

    valores_anteriores = {
        "codigo": tipo.codigo,
        "nombre": tipo.nombre,
        "precio_base": tipo.precio_base,
        "estado": tipo.estado,
    }
    db.delete(tipo)
    db.commit()

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ELIMINAR",
        tipo_entidad="TipoHabitacion",
        entidad_id=tipo_id,
        valores_anteriores=valores_anteriores,
        direccion_ip=request.client.host if request.client else None,
    )


@router_habitaciones.get("", response_model=list[HabitacionResponse])
def listar_habitaciones(
    db: Session = Depends(get_db),
    _: Usuario = Depends(LimpiezaUsuario),
):
    habitaciones = (
        db.query(Habitacion)
        .order_by(Habitacion.piso_id, Habitacion.numero)
        .all()
    )
    resultado = []
    for h in habitaciones:
        resultado.append(_habitacion_response(h))
    return resultado


@router_habitaciones.post("", response_model=HabitacionResponse, status_code=status.HTTP_201_CREATED)
def crear_habitacion(
    datos: HabitacionCrear,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    existe = db.query(Habitacion).filter(Habitacion.numero == datos.numero).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El numero de habitacion ya existe",
        )

    tipo = db.query(TipoHabitacion).filter(TipoHabitacion.id == datos.tipo_habitacion_id).first()
    if not tipo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El tipo de habitacion no existe",
        )
    if tipo.estado.lower() != "activo":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede crear una habitacion con un tipo inactivo",
        )

    piso = db.query(Piso).filter(Piso.id == datos.piso_id).first()
    if not piso:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El piso no existe",
        )

    habitacion = Habitacion(**datos.model_dump())
    db.add(habitacion)
    db.commit()
    db.refresh(habitacion)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CREAR",
        tipo_entidad="Habitacion",
        entidad_id=habitacion.id,
        valores_nuevos=datos.model_dump(),
        direccion_ip=request.client.host if request.client else None,
    )

    return _habitacion_response(habitacion)


@router_habitaciones.put("/{habitacion_id}", response_model=HabitacionResponse)
def actualizar_habitacion(
    habitacion_id: str,
    datos: HabitacionActualizar,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    habitacion = db.query(Habitacion).filter(Habitacion.id == habitacion_id).first()
    if not habitacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habitacion no encontrada",
        )

    datos_actualizar = datos.model_dump(exclude_unset=True)
    nuevo_numero = datos_actualizar.get("numero")
    if nuevo_numero and nuevo_numero != habitacion.numero:
        existe = db.query(Habitacion).filter(Habitacion.numero == nuevo_numero).first()
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El numero de habitacion ya existe",
            )

    nuevo_piso_id = datos_actualizar.get("piso_id")
    if nuevo_piso_id:
        piso = db.query(Piso).filter(Piso.id == nuevo_piso_id).first()
        if not piso:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El piso no existe",
            )

    nuevo_tipo_id = datos_actualizar.get("tipo_habitacion_id")
    if nuevo_tipo_id:
        tipo = db.query(TipoHabitacion).filter(TipoHabitacion.id == nuevo_tipo_id).first()
        if not tipo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El tipo de habitacion no existe",
            )
        if nuevo_tipo_id != habitacion.tipo_habitacion_id and tipo.estado.lower() != "activo":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede asignar un tipo de habitacion inactivo",
            )

    valores_anteriores = {
        "tipo_habitacion_id": habitacion.tipo_habitacion_id,
        "numero": habitacion.numero,
        "piso": habitacion.piso.nombre if habitacion.piso else None,
        "estado_operativo": habitacion.estado_operativo,
        "estado_limpieza": habitacion.estado_limpieza,
        "notas": habitacion.notas,
    }
    for campo, valor in datos_actualizar.items():
        setattr(habitacion, campo, valor)

    db.commit()
    db.refresh(habitacion)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ACTUALIZAR",
        tipo_entidad="Habitacion",
        entidad_id=habitacion.id,
        valores_anteriores=valores_anteriores,
        valores_nuevos=datos_actualizar,
        direccion_ip=request.client.host if request.client else None,
    )

    return _habitacion_response(habitacion)


@router_habitaciones.delete("/{habitacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_habitacion(
    habitacion_id: str,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    habitacion = db.query(Habitacion).filter(Habitacion.id == habitacion_id).first()
    if not habitacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habitacion no encontrada",
        )

    valores_anteriores = {
        "tipo_habitacion_id": habitacion.tipo_habitacion_id,
        "numero": habitacion.numero,
        "piso": habitacion.piso.nombre if habitacion.piso else None,
        "estado_operativo": habitacion.estado_operativo,
        "estado_limpieza": habitacion.estado_limpieza,
        "notas": habitacion.notas,
    }
    db.delete(habitacion)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar una habitacion con reservas, ventas o tareas asociadas",
        )

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ELIMINAR",
        tipo_entidad="Habitacion",
        entidad_id=habitacion_id,
        valores_anteriores=valores_anteriores,
        direccion_ip=request.client.host if request.client else None,
    )


@router_habitaciones.patch("/{habitacion_id}/estado", response_model=HabitacionResponse)
def actualizar_estado_habitacion(
    habitacion_id: str,
    datos: HabitacionEstadoActualizar,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    habitacion = db.query(Habitacion).filter(Habitacion.id == habitacion_id).first()
    if not habitacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habitacion no encontrada",
        )

    datos_actualizar = datos.model_dump(exclude_unset=True)
    for campo, valor in datos_actualizar.items():
        setattr(habitacion, campo, valor)

    db.commit()
    db.refresh(habitacion)

    return _habitacion_response(habitacion)


# --- Piso CRUD Routes ---

@router_pisos.get("", response_model=list[PisoResponse])
def listar_pisos(
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    pisos = db.query(Piso).order_by(Piso.nombre).all()
    return [PisoResponse.model_validate(p) for p in pisos]


@router_pisos.post("", response_model=PisoResponse, status_code=status.HTTP_201_CREATED)
def crear_piso(
    datos: PisoCrear,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    existe = db.query(Piso).filter(Piso.nombre == datos.nombre).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de piso ya existe",
        )

    piso = Piso(**datos.model_dump())
    db.add(piso)
    db.commit()
    db.refresh(piso)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CREAR",
        tipo_entidad="Piso",
        entidad_id=piso.id,
        valores_nuevos=datos.model_dump(),
        direccion_ip=request.client.host if request.client else None,
    )

    return PisoResponse.model_validate(piso)


@router_pisos.put("/{piso_id}", response_model=PisoResponse)
def actualizar_piso(
    piso_id: str,
    datos: PisoActualizar,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    piso = db.query(Piso).filter(Piso.id == piso_id).first()
    if not piso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Piso no encontrado",
        )

    valores_anteriores = {
        "nombre": piso.nombre,
        "descripcion": piso.descripcion,
        "estado": piso.estado,
    }

    datos_actualizar = datos.model_dump(exclude_unset=True)
    nuevo_nombre = datos_actualizar.get("nombre")
    if nuevo_nombre and nuevo_nombre != piso.nombre:
        existe = db.query(Piso).filter(Piso.nombre == nuevo_nombre).first()
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de piso ya existe",
            )

    for campo, valor in datos_actualizar.items():
        setattr(piso, campo, valor)

    db.commit()
    db.refresh(piso)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ACTUALIZAR",
        tipo_entidad="Piso",
        entidad_id=piso.id,
        valores_anteriores=valores_anteriores,
        valores_nuevos=datos_actualizar,
        direccion_ip=request.client.host if request.client else None,
    )

    return PisoResponse.model_validate(piso)


@router_pisos.delete("/{piso_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_piso(
    piso_id: str,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    piso = db.query(Piso).filter(Piso.id == piso_id).first()
    if not piso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Piso no encontrado",
        )

    habitaciones = db.query(Habitacion).filter(Habitacion.piso_id == piso_id).count()
    if habitaciones:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar un piso que tiene habitaciones asignadas",
        )

    valores_anteriores = {
        "nombre": piso.nombre,
        "descripcion": piso.descripcion,
        "estado": piso.estado,
    }
    db.delete(piso)
    db.commit()

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ELIMINAR",
        tipo_entidad="Piso",
        entidad_id=piso_id,
        valores_anteriores=valores_anteriores,
        direccion_ip=request.client.host if request.client else None,
    )


@router_pagos.get("", response_model=list[MetodoPagoResponse])
def listar_metodos_pago(
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    metodos = db.query(MetodoPago).order_by(MetodoPago.nombre).all()
    return [MetodoPagoResponse.model_validate(m) for m in metodos]


@router_pagos.post("", response_model=MetodoPagoResponse, status_code=status.HTTP_201_CREATED)
def crear_metodo_pago(
    datos: MetodoPagoCrear,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    existe = db.query(MetodoPago).filter(MetodoPago.nombre == datos.nombre).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El metodo de pago ya existe",
        )

    metodo = MetodoPago(**datos.model_dump())
    db.add(metodo)
    db.commit()
    db.refresh(metodo)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CREAR",
        tipo_entidad="MetodoPago",
        entidad_id=metodo.id,
        valores_nuevos=datos.model_dump(),
        direccion_ip=request.client.host if request.client else None,
    )

    return MetodoPagoResponse.model_validate(metodo)


@router_pagos.put("/{metodo_id}", response_model=MetodoPagoResponse)
def actualizar_metodo_pago(
    metodo_id: str,
    datos: MetodoPagoActualizar,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    metodo = db.query(MetodoPago).filter(MetodoPago.id == metodo_id).first()
    if not metodo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Metodo de pago no encontrado",
        )

    valores_anteriores = {
        "nombre": metodo.nombre,
        "descripcion": metodo.descripcion,
        "activo": metodo.activo,
    }

    datos_actualizar = datos.model_dump(exclude_unset=True)
    nuevo_nombre = datos_actualizar.get("nombre")
    if nuevo_nombre and nuevo_nombre != metodo.nombre:
        existe = db.query(MetodoPago).filter(MetodoPago.nombre == nuevo_nombre).first()
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El metodo de pago ya existe",
            )

    for campo, valor in datos_actualizar.items():
        setattr(metodo, campo, valor)

    db.commit()
    db.refresh(metodo)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ACTUALIZAR",
        tipo_entidad="MetodoPago",
        entidad_id=metodo.id,
        valores_anteriores=valores_anteriores,
        valores_nuevos=datos_actualizar,
        direccion_ip=request.client.host if request.client else None,
    )

    return MetodoPagoResponse.model_validate(metodo)


@router_pagos.delete("/{metodo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_metodo_pago(
    metodo_id: str,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    metodo = db.query(MetodoPago).filter(MetodoPago.id == metodo_id).first()
    if not metodo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Metodo de pago no encontrado",
        )

    valores_anteriores = {
        "nombre": metodo.nombre,
        "descripcion": metodo.descripcion,
        "activo": metodo.activo,
    }
    db.delete(metodo)
    db.commit()

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ELIMINAR",
        tipo_entidad="MetodoPago",
        entidad_id=metodo_id,
        valores_anteriores=valores_anteriores,
        direccion_ip=request.client.host if request.client else None,
    )