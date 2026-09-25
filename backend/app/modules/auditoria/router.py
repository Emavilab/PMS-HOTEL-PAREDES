from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from typing import Literal
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import GerenteUsuario
from app.modules.auditoria.modelos import RegistroAuditoria
from app.modules.auditoria.esquemas import RegistroAuditoriaResponse, RegistrosAuditoriaPaginados
from app.common.exportar import exportar_excel, exportar_pdf
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/registros-auditoria", tags=["Auditoria"])


@router.get("", response_model=RegistrosAuditoriaPaginados)
def listar_registros_auditoria(
    accion: str | None = Query(None),
    tipo_entidad: str | None = Query(None),
    entidad_id: str | None = Query(None),
    usuario_id: str | None = Query(None),
    buscar: str | None = Query(None, min_length=1, max_length=100),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    pagina: int = Query(1, ge=1),
    tamano: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    consulta = db.query(RegistroAuditoria).options(joinedload(RegistroAuditoria.usuario))

    if accion:
        consulta = consulta.filter(RegistroAuditoria.accion == accion)
    if tipo_entidad:
        consulta = consulta.filter(RegistroAuditoria.tipo_entidad == tipo_entidad)
    if entidad_id:
        consulta = consulta.filter(RegistroAuditoria.entidad_id == entidad_id)
    if usuario_id:
        consulta = consulta.filter(RegistroAuditoria.usuario_id == usuario_id)
    if buscar:
        patron = f"%{buscar}%"
        consulta = consulta.outerjoin(RegistroAuditoria.usuario).filter(
            or_(
                RegistroAuditoria.accion.ilike(patron),
                RegistroAuditoria.tipo_entidad.ilike(patron),
                RegistroAuditoria.entidad_id.ilike(patron),
                Usuario.nombre_completo.ilike(patron),
                Usuario.email.ilike(patron),
            )
        )
    if desde:
        inicio = datetime.combine(desde, time.min, tzinfo=timezone.utc)
        consulta = consulta.filter(RegistroAuditoria.creado_en >= inicio)
    if hasta:
        siguiente_dia = datetime.combine(hasta + timedelta(days=1), time.min, tzinfo=timezone.utc)
        consulta = consulta.filter(RegistroAuditoria.creado_en < siguiente_dia)

    total = consulta.count()
    registros = (
        consulta.order_by(RegistroAuditoria.creado_en.desc())
        .offset((pagina - 1) * tamano)
        .limit(tamano)
        .all()
    )

    items = [
        RegistroAuditoriaResponse(
            id=registro.id,
            usuario_id=registro.usuario_id,
            nombre_usuario=registro.usuario.nombre_completo if registro.usuario else None,
            accion=registro.accion,
            tipo_entidad=registro.tipo_entidad,
            entidad_id=registro.entidad_id,
            valores_anteriores=registro.valores_anteriores,
            valores_nuevos=registro.valores_nuevos,
            direccion_ip=registro.direccion_ip,
            creado_en=registro.creado_en,
        )
        for registro in registros
    ]
    return {"items": items, "total": total, "pagina": pagina, "tamano": tamano}


@router.get("/exportar")
def exportar_registros_auditoria(
    formato: Literal["xlsx", "pdf"] = Query("xlsx"),
    accion: str | None = Query(None),
    tipo_entidad: str | None = Query(None),
    entidad_id: str | None = Query(None),
    usuario_id: str | None = Query(None),
    buscar: str | None = Query(None, min_length=1, max_length=100),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    consulta = db.query(RegistroAuditoria).options(joinedload(RegistroAuditoria.usuario))
    if accion:
        consulta = consulta.filter(RegistroAuditoria.accion == accion)
    if tipo_entidad:
        consulta = consulta.filter(RegistroAuditoria.tipo_entidad == tipo_entidad)
    if entidad_id:
        consulta = consulta.filter(RegistroAuditoria.entidad_id == entidad_id)
    if usuario_id:
        consulta = consulta.filter(RegistroAuditoria.usuario_id == usuario_id)
    if buscar:
        patron = f"%{buscar}%"
        consulta = consulta.outerjoin(RegistroAuditoria.usuario).filter(or_(
            RegistroAuditoria.accion.ilike(patron), RegistroAuditoria.tipo_entidad.ilike(patron),
            RegistroAuditoria.entidad_id.ilike(patron), Usuario.nombre_completo.ilike(patron),
            Usuario.email.ilike(patron),
        ))
    if desde:
        consulta = consulta.filter(RegistroAuditoria.creado_en >= datetime.combine(desde, time.min, tzinfo=timezone.utc))
    if hasta:
        consulta = consulta.filter(RegistroAuditoria.creado_en < datetime.combine(hasta + timedelta(days=1), time.min, tzinfo=timezone.utc))

    registros = consulta.order_by(RegistroAuditoria.creado_en.desc()).limit(5000).all()
    datos = [{
        "fecha": registro.creado_en,
        "usuario": registro.usuario.nombre_completo if registro.usuario else "Sistema",
        "accion": registro.accion,
        "entidad": registro.tipo_entidad,
        "entidad_id": registro.entidad_id or "",
        "ip": registro.direccion_ip or "",
        "anteriores": registro.valores_anteriores or "",
        "nuevos": registro.valores_nuevos or "",
    } for registro in registros]
    columnas = [
        {"key": "fecha", "header": "Fecha", "width": 22}, {"key": "usuario", "header": "Usuario", "width": 25},
        {"key": "accion", "header": "Acción", "width": 18}, {"key": "entidad", "header": "Entidad", "width": 20},
        {"key": "entidad_id", "header": "ID", "width": 38}, {"key": "ip", "header": "IP", "width": 18},
        {"key": "anteriores", "header": "Valores anteriores", "width": 45}, {"key": "nuevos", "header": "Valores nuevos", "width": 45},
    ]
    contenido = exportar_excel(datos, columnas, "Auditoria") if formato == "xlsx" else exportar_pdf(datos, columnas, "Auditoria")
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if formato == "xlsx" else "application/pdf"
    nombre_archivo = f"auditoria_{date.today().isoformat()}.{formato}"
    return Response(content=contenido, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'})
