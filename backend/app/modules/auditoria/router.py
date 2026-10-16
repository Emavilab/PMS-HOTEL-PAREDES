import json
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from typing import Literal
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.dependencies import GerenteUsuario, AuditoriaModulo
from app.modules.auditoria.modelos import RegistroAuditoria
from app.modules.auditoria.esquemas import RegistroAuditoriaResponse, RegistrosAuditoriaPaginados
from app.common.exportar import exportar_excel, exportar_pdf
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/registros-auditoria", tags=["Auditoria"])

NOMBRES_ENTIDAD = {
    "RESERVA": "la reserva",
    "HUESPED": "el huésped",
    "HUESPEDES": "el huésped",
    "SESIONCAJA": "la caja",
    "PRODUCTO": "el producto",
    "CATEGORIAPRODUCTO": "la categoría de producto",
    "CONSUMO": "el consumo",
    "CARGO": "el cargo",
    "PAGO": "el pago",
    "FACTURA": "la factura",
    "USUARIO": "el usuario",
    "HABITACION": "la habitación",
    "TIPOHABITACION": "el tipo de habitación",
    "PISO": "el piso",
    "TAREALIMPIEZA": "la tarea de limpieza",
    "CONFIGURACION": "la configuración",
    "LOGO": "el logo",
    "FONDO_LOGIN": "la imagen de inicio de sesión",
}

NOMBRES_ACCION = {
    "ABRIR_CAJA": "abrió la caja",
    "CERRAR_CAJA": "cerró la caja",
    "CONFIRMAR": "confirmó",
    "CANCELAR": "canceló",
    "NO_SHOW": "marcó como no presentado",
    "CHECK_IN": "registró la entrada de",
    "CHECK_OUT": "registró la salida de",
    "CULMINAR_SALIDA": "completó la salida de",
    "EXTENDER_ESTADIA": "extendió la estadía de",
    "LOGIN": "inició sesión",
    "LOGIN_FALLIDO": "intentó iniciar sesión sin éxito",
    "LOGOUT": "cerró sesión",
    "ACTUALIZAR_ESTADO": "cambió el estado de",
    "DESACTIVAR": "desactivó",
    "ELIMINAR": "eliminó",
    "CREAR": "creó",
    "ACTUALIZAR": "editó",
}


def _descripcion_accion(registro: RegistroAuditoria) -> str:
    actor = registro.nombre_usuario or (registro.usuario.nombre_completo if registro.usuario else "Un usuario")
    accion = NOMBRES_ACCION.get(registro.accion.upper(), "realizó una acción en")
    entidad = NOMBRES_ENTIDAD.get(registro.tipo_entidad.upper(), "el registro")
    valores = {}
    try:
        valores = json.loads(registro.valores_nuevos or "{}")
        if not isinstance(valores, dict):
            valores = {}
    except (TypeError, ValueError):
        pass

    if registro.accion.upper() in {"LOGIN", "LOGOUT", "LOGIN_FALLIDO"}:
        return f"{actor} {accion}"
    descripcion = f"{actor} {accion} {entidad}"
    referencia = valores.get("codigo_confirmacion") or valores.get("numero") or valores.get("numero_habitacion")
    if referencia:
        descripcion += f" {referencia}"
    return descripcion.strip()


def _detalles_legibles(registro: RegistroAuditoria) -> dict:
    datos = {}
    for titulo, raw in (("Antes", registro.valores_anteriores), ("Después", registro.valores_nuevos)):
        if not raw:
            continue
        try:
            valores = json.loads(raw)
        except (TypeError, ValueError):
            continue
        if not isinstance(valores, dict):
            continue
        for clave, valor in valores.items():
            if clave.lower() in {"estado_http", "metodo", "ruta", "resultado", "consumos", "permisos"}:
                continue
            datos[f"{titulo}: {_etiqueta_campo(clave)}"] = valor
    return datos


def _etiqueta_campo(clave: str) -> str:
    etiquetas = {
        "estado": "Estado", "monto_apertura": "Monto inicial", "monto_esperado": "Monto esperado",
        "monto_declarado": "Monto declarado", "diferencia": "Diferencia de caja", "total": "Total",
        "total_factura": "Total de la factura", "total_pagado": "Total pagado", "saldo_final": "Saldo pendiente",
        "metodo_pago": "Forma de pago", "fecha_entrada": "Entrada", "fecha_salida": "Salida",
        "habitacion_id": "Habitación", "noches_adicionales": "Noches agregadas", "total_adicional": "Cargo adicional",
        "motivo": "Motivo", "descripcion": "Descripción", "nombre_completo": "Nombre", "email": "Correo",
        "rol": "Rol", "estado_operativo": "Estado de habitación", "estado_limpieza": "Estado de limpieza",
        "factura_numero": "Número de factura", "fecha": "Fecha", "cantidad": "Cantidad",
    }
    return etiquetas.get(clave, clave.replace("_", " ").capitalize())


@router.get("", response_model=RegistrosAuditoriaPaginados, dependencies=[Depends(AuditoriaModulo)])
def listar_registros_auditoria(
    accion: str | None = Query(None),
    tipo_entidad: str | None = Query(None),
    entidad_id: str | None = Query(None),
    usuario_id: str | None = Query(None),
    rol_usuario: str | None = Query(None),
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
    if rol_usuario:
        consulta = consulta.filter(RegistroAuditoria.rol_usuario == rol_usuario)
    if buscar:
        patron = f"%{buscar}%"
        consulta = consulta.outerjoin(RegistroAuditoria.usuario).filter(
            or_(
                RegistroAuditoria.accion.ilike(patron),
                RegistroAuditoria.tipo_entidad.ilike(patron),
                RegistroAuditoria.entidad_id.ilike(patron),
                RegistroAuditoria.nombre_usuario.ilike(patron),
                RegistroAuditoria.ruta.ilike(patron),
                RegistroAuditoria.rol_usuario.ilike(patron),
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
            nombre_usuario=registro.nombre_usuario or (registro.usuario.nombre_completo if registro.usuario else None),
            rol_usuario=registro.rol_usuario,
            accion=registro.accion,
            tipo_entidad=registro.tipo_entidad,
            entidad_id=registro.entidad_id,
            valores_anteriores=registro.valores_anteriores,
            valores_nuevos=registro.valores_nuevos,
            direccion_ip=registro.direccion_ip,
            metodo_http=registro.metodo_http,
            ruta=registro.ruta,
            estado_http=registro.estado_http,
            agente_usuario=registro.agente_usuario,
            creado_en=registro.creado_en,
            descripcion=_descripcion_accion(registro),
            detalles=_detalles_legibles(registro),
        )
        for registro in registros
    ]
    return {"items": items, "total": total, "pagina": pagina, "tamano": tamano}


@router.get("/exportar", dependencies=[Depends(AuditoriaModulo)])
def exportar_registros_auditoria(
    formato: Literal["xlsx", "pdf"] = Query("xlsx"),
    accion: str | None = Query(None),
    tipo_entidad: str | None = Query(None),
    entidad_id: str | None = Query(None),
    usuario_id: str | None = Query(None),
    rol_usuario: str | None = Query(None),
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
    if rol_usuario:
        consulta = consulta.filter(RegistroAuditoria.rol_usuario == rol_usuario)
    if buscar:
        patron = f"%{buscar}%"
        consulta = consulta.outerjoin(RegistroAuditoria.usuario).filter(or_(
            RegistroAuditoria.accion.ilike(patron), RegistroAuditoria.tipo_entidad.ilike(patron),
            RegistroAuditoria.entidad_id.ilike(patron), RegistroAuditoria.ruta.ilike(patron),
            RegistroAuditoria.rol_usuario.ilike(patron), Usuario.nombre_completo.ilike(patron),
            Usuario.email.ilike(patron),
        ))
    if desde:
        consulta = consulta.filter(RegistroAuditoria.creado_en >= datetime.combine(desde, time.min, tzinfo=timezone.utc))
    if hasta:
        consulta = consulta.filter(RegistroAuditoria.creado_en < datetime.combine(hasta + timedelta(days=1), time.min, tzinfo=timezone.utc))

    registros = consulta.order_by(RegistroAuditoria.creado_en.desc()).limit(5000).all()
    datos = [{
        "fecha": registro.creado_en,
        "usuario": registro.nombre_usuario or (registro.usuario.nombre_completo if registro.usuario else "Sistema"),
        "accion": _descripcion_accion(registro),
        "detalles": json.dumps(_detalles_legibles(registro), ensure_ascii=False, default=str),
    } for registro in registros]
    columnas = [
        {"key": "fecha", "header": "Fecha", "width": 22}, {"key": "usuario", "header": "Usuario", "width": 25},
        {"key": "accion", "header": "Acción realizada", "width": 55}, {"key": "detalles", "header": "Detalles", "width": 55},
    ]
    contenido = exportar_excel(datos, columnas, "Auditoria") if formato == "xlsx" else exportar_pdf(datos, columnas, "Auditoria")
    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if formato == "xlsx" else "application/pdf"
    nombre_archivo = f"auditoria_{date.today().isoformat()}.{formato}"
    return Response(content=contenido, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'})
