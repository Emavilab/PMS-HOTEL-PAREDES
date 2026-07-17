from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.modules.usuarios.modelos import Usuario

seguridad = HTTPBearer()


def crear_token_acceso(data: dict, expira_delta: Optional[timedelta] = None) -> str:
    datos = data.copy()
    expira = datetime.now(timezone.utc) + (
        expira_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    datos.update({"exp": expira})
    return jwt.encode(datos, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verificar_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def obtener_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(seguridad),
    db: Session = Depends(get_db),
) -> Usuario:
    token = credentials.credentials
    payload = verificar_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
    usuario_id = payload.get("sub")
    if usuario_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sin datos de usuario",
        )
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario or usuario.estado != "activo":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
        )
    return usuario


def requerir_rol(*roles: str):
    def verificador_rol(usuario_actual: Usuario = Depends(obtener_usuario_actual)):
        if usuario_actual.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para esta acción",
            )
        return usuario_actual
    return verificador_rol
