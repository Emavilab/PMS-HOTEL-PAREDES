"""Creación y sanitización centralizada de registros de auditoría.

El contexto HTTP se guarda por solicitud para que los routers existentes
capturen método, ruta, IP y agente de usuario sin repetir esa lógica.
"""

import json
import re
from contextvars import ContextVar
from typing import Optional
from sqlalchemy.orm import Session
from app.modules.auditoria.modelos import RegistroAuditoria

_CAMPOS_PRIVADOS = re.compile(r"password|contrasena|token|secret|clave|authorization", re.IGNORECASE)
_request_context: ContextVar[object | None] = ContextVar("auditoria_request", default=None)


def establecer_contexto_request(request: object):
    """Asocia la solicitud HTTP actual al contexto de la auditoría."""
    return _request_context.set(request)


def limpiar_contexto_request(token) -> None:
    """Restaura el contexto anterior al terminar una solicitud HTTP."""
    _request_context.reset(token)


def _sanitizar(valor):
    if isinstance(valor, dict):
        return {
            str(clave): "[REDACTADO]" if _CAMPOS_PRIVADOS.search(str(clave)) else _sanitizar(contenido)
            for clave, contenido in valor.items()
        }
    if isinstance(valor, (list, tuple)):
        return [_sanitizar(item) for item in valor]
    return valor


def crear_registro_auditoria(
    db: Session,
    usuario_id: Optional[str],
    accion: str,
    tipo_entidad: str,
    entidad_id: Optional[str] = None,
    valores_anteriores: Optional[dict] = None,
    valores_nuevos: Optional[dict] = None,
    direccion_ip: Optional[str] = None,
) -> RegistroAuditoria:
    """Persiste una acción con actor, contexto HTTP y valores sanitizados.

    Nunca se guardan contraseñas, tokens ni secretos en los valores
    anteriores o nuevos, aunque un router los envíe accidentalmente.
    """
    request = _request_context.get()
    request_url = getattr(request, "url", None)
    request_headers = getattr(request, "headers", {})
    request_client = getattr(request, "client", None)
    actor = None
    if usuario_id:
        try:
            from app.modules.usuarios.modelos import Usuario
            actor = db.get(Usuario, usuario_id)
        except Exception:
            actor = None

    registro = RegistroAuditoria(
        usuario_id=usuario_id,
        accion=accion,
        tipo_entidad=tipo_entidad,
        entidad_id=entidad_id,
        valores_anteriores=json.dumps(_sanitizar(valores_anteriores), default=str) if valores_anteriores else None,
        valores_nuevos=json.dumps(_sanitizar(valores_nuevos), default=str) if valores_nuevos else None,
        direccion_ip=direccion_ip or (request_client.host if request_client else None),
        nombre_usuario=actor.nombre_completo if actor else None,
        rol_usuario=actor.rol if actor else None,
        metodo_http=getattr(request, "method", None),
        ruta=str(request_url.path) if request_url else None,
        estado_http=200,
        agente_usuario=request_headers.get("user-agent") if request_headers else None,
    )
    db.add(registro)
    db.commit()
    return registro
