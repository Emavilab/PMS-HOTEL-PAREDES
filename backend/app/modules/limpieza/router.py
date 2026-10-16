from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import LimpiezaUsuario, LimpiezaModulo
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

# Valid state transitions
_TRANSICIONES_VALIDAS = {
    "PENDIENTE": ["EN_PROGRESO", "CANCELADA"],
    "EN_PROGRESO": ["INSPECCION", "COMPLETADA", "PENDIENTE"],
    "INSPECCION": ["COMPLETADA", "EN_PROGRESO"],
    "COMPLETADA": [],
    "CANCELADA": [],
}


@router.get("/personal", response_model=list[dict], dependencies=[Depends(LimpiezaModulo)])
def listar_personal_limpieza(
    db: Session = Depends(get_db),
    _: Usuario = Depends(LimpiezaUsuario),
):
    """List users with role 'limpieza' for task assignment."""
    personal = (
        db.query(Usuario)
        .filter(Usuario.rol == "limpieza", Usuario.estado == "activo")
        .order_by(Usuario.nombre_completo)
        .all()
    )
    return [{"id": u.id, "nombre_completo": u.nombre_completo} for u in personal]


@router.get("", response_model=list[TareaLimpiezaResponse], dependencies=[Depends(LimpiezaModulo)])
def listar_tareas_limpieza(
    estado: str | None = Query(None),
    habitacion_id: str | None = Query(None),
    asignada_a: str | None = Query(None),
    fecha: str | None = Query(None, alias="fecha_tarea"),
    tipo_limpieza: str | None = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(LimpiezaUsuario),
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
    if tipo_limpieza:
        consulta = consulta.filter(TareaLimpieza.tipo_limpieza == tipo_limpieza)

    tareas = consulta.order_by(TareaLimpieza.fecha_tarea.desc(), TareaLimpieza.prioridad).all()
    return [_tarea_response(t, db) for t in tareas]


@router.post("", response_model=TareaLimpiezaResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(LimpiezaModulo)])
def crear_tarea_limpieza(
    datos: TareaLimpiezaCrear,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(LimpiezaUsuario),
):
    habitacion = db.query(Habitacion).filter(Habitacion.id == datos.habitacion_id).first()
    if not habitacion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Habitacion no encontrada",
        )

    tarea = TareaLimpieza(**datos.model_dump())
    db.add(tarea)

    if habitacion.estado_operativo != "OCUPADA":
        habitacion.estado_limpieza = "SUCIA"

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

    return _tarea_response(tarea, db)


@router.patch("/{tarea_id}", response_model=TareaLimpiezaResponse, dependencies=[Depends(LimpiezaModulo)])
def actualizar_tarea_limpieza(
    tarea_id: str,
    datos: TareaLimpiezaActualizar,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(LimpiezaUsuario),
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

        # Validate transition
        estados_permitidos = _TRANSICIONES_VALIDAS.get(tarea.estado, [])
        if nuevo_estado not in estados_permitidos:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede cambiar de {tarea.estado} a {nuevo_estado}",
            )

        habitacion = (
            db.query(Habitacion)
            .filter(Habitacion.id == tarea.habitacion_id)
            .first()
        )

        if nuevo_estado == "EN_PROGRESO" and tarea.estado != "EN_PROGRESO":
            tarea.iniciada_en = datetime.now(timezone.utc)
            if habitacion and habitacion.estado_operativo != "OCUPADA":
                habitacion.estado_limpieza = "EN_PROGRESO"

        elif nuevo_estado == "INSPECCION":
            if habitacion and habitacion.estado_operativo != "OCUPADA":
                habitacion.estado_limpieza = "INSPECCION"

        elif nuevo_estado == "COMPLETADA" and tarea.estado != "COMPLETADA":
            tarea.completada_en = datetime.now(timezone.utc)
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

    return _tarea_response(tarea, db)


def _tarea_response(tarea: TareaLimpieza, db: Session) -> TareaLimpiezaResponse:
    resp = TareaLimpiezaResponse.model_validate(tarea)
    if tarea.habitacion:
        resp.numero_habitacion = tarea.habitacion.numero
        resp.piso = tarea.habitacion.piso.nombre if tarea.habitacion.piso else None
        resp.estado_limpieza = tarea.habitacion.estado_limpieza
        resp.estado_operativo = tarea.habitacion.estado_operativo
        if tarea.habitacion.tipo_habitacion:
            resp.tipo_habitacion_nombre = tarea.habitacion.tipo_habitacion.nombre
    if tarea.asignada_a:
        usuario = db.query(Usuario).filter(Usuario.id == tarea.asignada_a).first()
        if usuario:
            resp.nombre_asignada = usuario.nombre_completo
    return resp
