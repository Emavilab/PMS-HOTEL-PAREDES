from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import PersonalUsuario
from app.common.auditoria import crear_registro_auditoria
from app.modules.limpieza.modelos import TareaLimpieza
from app.modules.limpieza.esquemas import (
    TareaLimpiezaCrear,
    TareaLimpiezaActualizar,
    TareaLimpiezaResponse,
)
from app.modules.habitaciones.modelos import Habitacion
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/tareas-limpieza", tags=["Limpieza"])


@router.get("", response_model=list[TareaLimpiezaResponse])
def listar_tareas_limpieza(
    estado: str | None = Query(None),
    habitacion_id: str | None = Query(None),
    asignada_a: str | None = Query(None),
    fecha: str | None = Query(None, alias="fecha_tarea"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    consulta = db.query(TareaLimpieza)
    if estado:
        consulta = consulta.filter(TareaLimpieza.estado == estado)
    if habitacion_id:
        consulta = consulta.filter(TareaLimpieza.habitacion_id == habitacion_id)
    if asignada_a:
        consulta = consulta.filter(TareaLimpieza.asignada_a == asignada_a)
    if fecha:
        consulta = consulta.filter(TareaLimpieza.fecha_tarea == fecha)

    tareas = consulta.order_by(TareaLimpieza.fecha_tarea.desc(), TareaLimpieza.prioridad).all()
    return [TareaLimpiezaResponse.model_validate(t) for t in tareas]


@router.post("", response_model=TareaLimpiezaResponse, status_code=status.HTTP_201_CREATED)
def crear_tarea_limpieza(
    datos: TareaLimpiezaCrear,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    habitacion = db.query(Habitacion).filter(Habitacion.id == datos.habitacion_id).first()
    if not habitacion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Habitacion no encontrada",
        )

    tarea = TareaLimpieza(**datos.model_dump())
    db.add(tarea)
    db.commit()
    db.refresh(tarea)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CREAR",
        tipo_entidad="TareaLimpieza",
        entidad_id=tarea.id,
        valores_nuevos=datos.model_dump(),
        direccion_ip=request.client.host if request.client else None,
    )

    return TareaLimpiezaResponse.model_validate(tarea)


@router.patch("/{tarea_id}", response_model=TareaLimpiezaResponse)
def actualizar_tarea_limpieza(
    tarea_id: str,
    datos: TareaLimpiezaActualizar,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    tarea = db.query(TareaLimpieza).filter(TareaLimpieza.id == tarea_id).first()
    if not tarea:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tarea de limpieza no encontrada",
        )

    valores_anteriores = {
        "estado": tarea.estado,
        "asignada_a": tarea.asignada_a,
    }

    datos_actualizar = datos.model_dump(exclude_unset=True)

    if "estado" in datos_actualizar:
        nuevo_estado = datos_actualizar["estado"]
        if nuevo_estado == "EN_PROGRESO" and tarea.estado != "EN_PROGRESO":
            tarea.iniciada_en = datetime.now(timezone.utc)
        elif nuevo_estado == "COMPLETADA" and tarea.estado != "COMPLETADA":
            tarea.completada_en = datetime.now(timezone.utc)
            habitacion = (
                db.query(Habitacion)
                .filter(Habitacion.id == tarea.habitacion_id)
                .first()
            )
            if habitacion:
                habitacion.estado_limpieza = "LIMPIA"

    for campo, valor in datos_actualizar.items():
        if campo not in ("estado",):
            setattr(tarea, campo, valor)
        elif campo == "estado":
            tarea.estado = valor

    db.commit()
    db.refresh(tarea)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ACTUALIZAR",
        tipo_entidad="TareaLimpieza",
        entidad_id=tarea.id,
        valores_anteriores=valores_anteriores,
        valores_nuevos={"estado": tarea.estado},
        direccion_ip=request.client.host if request.client else None,
    )

    return TareaLimpiezaResponse.model_validate(tarea)
