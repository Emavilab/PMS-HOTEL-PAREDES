import json
import re
from typing import Optional
from sqlalchemy.orm import Session
from app.modules.auditoria.modelos import RegistroAuditoria

_CAMPOS_PRIVADOS = re.compile(r"password|contrasena|token|secret|clave|authorization", re.IGNORECASE)


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
        direccion_ip=direccion_ip,
        nombre_usuario=actor.nombre_completo if actor else None,
        rol_usuario=actor.rol if actor else None,
        metodo_http=None,
        ruta=None,
        agente_usuario=None,
    )
    db.add(registro)
    db.commit()
    return registro
