from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import AdminUsuario, LimpiezaUsuario, PersonalUsuario
from app.common.auditoria import crear_registro_auditoria
from app.modules.habitaciones.modelos import TipoHabitacion, Habitacion
from app.modules.habitaciones.esquemas import (
    TipoHabitacionCrear,
    TipoHabitacionActualizar,
    TipoHabitacionResponse,
    HabitacionCrear,
    HabitacionActualizar,
    HabitacionResponse,
    HabitacionEstadoActualizar,
)
from app.modules.usuarios.modelos import Usuario

router_tipos = APIRouter(prefix="/tipos-habitacion", tags=["Tipos de Habitacion"])
router_habitaciones = APIRouter(prefix="/habitaciones", tags=["Habitaciones"])


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
        .order_by(Habitacion.piso, Habitacion.numero)
        .all()
    )
    resultado = []
    for h in habitaciones:
        resp = HabitacionResponse.model_validate(h)
        if h.tipo_habitacion:
            resp.tipo_habitacion = TipoHabitacionResponse.model_validate(h.tipo_habitacion)
        resultado.append(resp)
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

    resp = HabitacionResponse.model_validate(habitacion)
    if habitacion.tipo_habitacion:
        resp.tipo_habitacion = TipoHabitacionResponse.model_validate(habitacion.tipo_habitacion)
    return resp


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
        "piso": habitacion.piso,
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

    resp = HabitacionResponse.model_validate(habitacion)
    if habitacion.tipo_habitacion:
        resp.tipo_habitacion = TipoHabitacionResponse.model_validate(habitacion.tipo_habitacion)
    return resp


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
        "piso": habitacion.piso,
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

    resp = HabitacionResponse.model_validate(habitacion)
    if habitacion.tipo_habitacion:
        resp.tipo_habitacion = TipoHabitacionResponse.model_validate(habitacion.tipo_habitacion)
    return resp
