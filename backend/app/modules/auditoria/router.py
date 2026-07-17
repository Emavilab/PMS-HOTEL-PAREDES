from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import AdminUsuario
from app.modules.auditoria.modelos import RegistroAuditoria
from app.modules.auditoria.esquemas import RegistroAuditoriaResponse
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/registros-auditoria", tags=["Auditoria"])


@router.get("", response_model=list[RegistroAuditoriaResponse])
def listar_registros_auditoria(
    accion: str | None = Query(None),
    tipo_entidad: str | None = Query(None),
    entidad_id: str | None = Query(None),
    usuario_id: str | None = Query(None),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    pagina: int = Query(1, ge=1),
    tamano: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: Usuario = Depends(AdminUsuario),
):
    consulta = db.query(RegistroAuditoria)

    if accion:
        consulta = consulta.filter(RegistroAuditoria.accion == accion)
    if tipo_entidad:
        consulta = consulta.filter(RegistroAuditoria.tipo_entidad == tipo_entidad)
    if entidad_id:
        consulta = consulta.filter(RegistroAuditoria.entidad_id == entidad_id)
    if usuario_id:
        consulta = consulta.filter(RegistroAuditoria.usuario_id == usuario_id)
    if desde:
        consulta = consulta.filter(RegistroAuditoria.creado_en >= desde)
    if hasta:
        consulta = consulta.filter(RegistroAuditoria.creado_en <= hasta)

    registros = (
        consulta.order_by(RegistroAuditoria.creado_en.desc())
        .offset((pagina - 1) * tamano)
        .limit(tamano)
        .all()
    )

    return [RegistroAuditoriaResponse.model_validate(r) for r in registros]
