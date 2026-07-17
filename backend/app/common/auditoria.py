import json
from typing import Optional
from sqlalchemy.orm import Session
from app.modules.auditoria.modelos import RegistroAuditoria


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
    registro = RegistroAuditoria(
        usuario_id=usuario_id,
        accion=accion,
        tipo_entidad=tipo_entidad,
        entidad_id=entidad_id,
        valores_anteriores=json.dumps(valores_anteriores, default=str) if valores_anteriores else None,
        valores_nuevos=json.dumps(valores_nuevos, default=str) if valores_nuevos else None,
        direccion_ip=direccion_ip,
    )
    db.add(registro)
    db.commit()
    return registro
