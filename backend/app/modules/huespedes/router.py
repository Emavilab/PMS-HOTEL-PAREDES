from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import PersonalUsuario
from app.common.auditoria import crear_registro_auditoria
from app.modules.huespedes.modelos import Huesped
from app.modules.huespedes.esquemas import (
    HuespedCrear,
    HuespedActualizar,
    HuespedResponse,
    HuespedHistorialResponse,
)
from app.modules.reservas.modelos import Reserva
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/huespedes", tags=["Huespedes"])


@router.get("", response_model=list[HuespedResponse])
def listar_huespedes(
    busqueda: str | None = Query(None, description="Buscar por nombre o documento"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    consulta = db.query(Huesped)
    if busqueda:
        patron = f"%{busqueda}%"
        consulta = consulta.filter(
            Huesped.nombres.ilike(patron)
            | Huesped.apellidos.ilike(patron)
            | Huesped.numero_documento.ilike(patron)
            | Huesped.email.ilike(patron)
        )
    huespedes = consulta.order_by(Huesped.apellidos, Huesped.nombres).all()
    return [HuespedResponse.model_validate(h) for h in huespedes]


@router.post("", response_model=HuespedResponse, status_code=status.HTTP_201_CREATED)
def crear_huesped(
    datos: HuespedCrear,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    huesped = Huesped(**datos.model_dump())
    db.add(huesped)
    db.commit()
    db.refresh(huesped)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CREAR",
        tipo_entidad="Huesped",
        entidad_id=huesped.id,
        valores_nuevos=datos.model_dump(),
        direccion_ip=request.client.host if request.client else None,
    )

    return HuespedResponse.model_validate(huesped)


@router.get("/{huesped_id}", response_model=HuespedResponse)
def obtener_huesped(
    huesped_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    huesped = db.query(Huesped).filter(Huesped.id == huesped_id).first()
    if not huesped:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Huesped no encontrado",
        )
    return HuespedResponse.model_validate(huesped)


@router.put("/{huesped_id}", response_model=HuespedResponse)
def actualizar_huesped(
    huesped_id: str,
    datos: HuespedActualizar,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    huesped = db.query(Huesped).filter(Huesped.id == huesped_id).first()
    if not huesped:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Huesped no encontrado",
        )

    valores_anteriores = {
        "nombres": huesped.nombres,
        "apellidos": huesped.apellidos,
        "tipo_documento": huesped.tipo_documento,
        "numero_documento": huesped.numero_documento,
    }

    datos_actualizar = datos.model_dump(exclude_unset=True)
    for campo, valor in datos_actualizar.items():
        setattr(huesped, campo, valor)

    db.commit()
    db.refresh(huesped)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ACTUALIZAR",
        tipo_entidad="Huesped",
        entidad_id=huesped.id,
        valores_anteriores=valores_anteriores,
        valores_nuevos=datos_actualizar,
        direccion_ip=request.client.host if request.client else None,
    )

    return HuespedResponse.model_validate(huesped)


@router.delete("/{huesped_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_huesped(
    huesped_id: str,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    huesped = db.query(Huesped).filter(Huesped.id == huesped_id).first()
    if not huesped:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Huesped no encontrado",
        )

    reservas = db.query(Reserva).filter(Reserva.huesped_id == huesped_id).count()
    if reservas:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar un huesped con reservas asociadas",
        )

    valores_anteriores = {
        "nombres": huesped.nombres,
        "apellidos": huesped.apellidos,
        "tipo_documento": huesped.tipo_documento,
        "numero_documento": huesped.numero_documento,
        "telefono": huesped.telefono,
        "email": huesped.email,
    }
    db.delete(huesped)
    db.commit()

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ELIMINAR",
        tipo_entidad="Huesped",
        entidad_id=huesped_id,
        valores_anteriores=valores_anteriores,
        direccion_ip=request.client.host if request.client else None,
    )


@router.get("/{huesped_id}/historial", response_model=HuespedHistorialResponse)
def historial_huesped(
    huesped_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    huesped = db.query(Huesped).filter(Huesped.id == huesped_id).first()
    if not huesped:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Huesped no encontrado",
        )

    reservas = (
        db.query(Reserva)
        .filter(Reserva.huesped_id == huesped_id)
        .order_by(Reserva.creado_en.desc())
        .all()
    )

    return HuespedHistorialResponse(
        huesped=HuespedResponse.model_validate(huesped),
        reservas=[
            {
                "id": r.id,
                "codigo_confirmacion": r.codigo_confirmacion,
                "fecha_entrada": str(r.fecha_entrada),
                "fecha_salida": str(r.fecha_salida),
                "estado": r.estado,
                "total": r.total,
            }
            for r in reservas
        ],
    )
