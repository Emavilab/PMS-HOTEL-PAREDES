from datetime import datetime, timedelta, timezone
from typing import Optional
import json
import base64
import hashlib
import hmac
import os

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.modules.usuarios.modelos import Usuario
from app.modules.usuarios.esquemas import MODULOS_KEYS, PERMISOS_VALIDOS

seguridad = HTTPBearer()


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**15, r=8, p=1, dklen=64, maxmem=64 * 1024 * 1024)
    salt_text = base64.urlsafe_b64encode(salt).decode("ascii").rstrip("=")
    digest_text = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return f"$scrypt$32768$8$1${salt_text}${digest_text}"


def verificar_password(password: str, password_hash: str) -> bool:
    if password_hash.startswith(("$2a$", "$2b$", "$2y$")):
        import bcrypt
        try:
            return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("utf-8"))
        except (ValueError, TypeError):
            return False
    if password_hash.startswith("$scrypt$"):
        try:
            _, algorithm, n, r, p, salt_encoded, digest_encoded = password_hash.split("$")
            if (int(n), int(r), int(p)) != (32768, 8, 1):
                return False
            salt = base64.urlsafe_b64decode(salt_encoded + "=" * (-len(salt_encoded) % 4))
            expected = base64.urlsafe_b64decode(digest_encoded + "=" * (-len(digest_encoded) % 4))
            actual = hashlib.scrypt(
                password.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p),
                dklen=len(expected), maxmem=64 * 1024 * 1024,
            )
            return hmac.compare_digest(actual, expected)
        except (ValueError, TypeError, MemoryError):
            return False
    return False


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
    request: Request,
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
    if payload.get("sv", 0) != usuario.version_sesion:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión fue cerrada remotamente",
        )
    request.state.usuario_auditoria = usuario
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


MODULOS_POR_ROL = {
    "admin": set(MODULOS_KEYS),
    "gerente": set(MODULOS_KEYS) - {"usuarios", "configuracion"},
    "recepcionista": {
        "dashboard", "recepcion", "verificar_salida", "reservas", "huespedes",
        "habitaciones", "ventas", "housekeeping", "facturacion", "caja",
    },
    "limpieza": {"housekeeping", "habitaciones"},
}

RECEPCION_LECTURAS_COMPARTIDAS = {
    "/reportes/llegadas",
    "/reportes/salidas",
    "/habitaciones",
    "/metodos-pago",
    "/ventas/ocupadas",
}


def tiene_lectura_compartida_recepcion(usuario: Usuario, request: Request) -> bool:
    ruta = request.url.path
    ruta_compartida = ruta in RECEPCION_LECTURAS_COMPARTIDAS or (
        ruta.startswith("/ventas/habitaciones/") and ruta.endswith("/ocupacion")
    )
    extension_desde_recepcion = (
        request.method == "POST"
        and ruta.startswith("/reservas/")
        and ruta.endswith("/extender-estadia")
    )
    if not extension_desde_recepcion and (request.method != "GET" or not ruta_compartida):
        return False
    try:
        permisos = set(json.loads(usuario.permisos or "[]"))
    except (TypeError, ValueError):
        permisos = set()
    return "recepcion" in permisos or {
        "recepcion:ver",
        "recepcion:crear",
        "recepcion:editar",
        "recepcion:eliminar",
    }.issubset(permisos)


def requerir_modulo(modulo: str):
    def verificar_modulo(
        request: Request,
        usuario: Usuario = Depends(obtener_usuario_actual),
    ) -> Usuario:
        modulos_rol = MODULOS_POR_ROL.get(usuario.rol, set())
        try:
            permisos_usuario = set(json.loads(usuario.permisos or "[]"))
        except (TypeError, ValueError):
            permisos_usuario = set()
        permisos_modulo = {
            permiso for permiso in permisos_usuario
            if permiso == modulo or permiso.startswith(f"{modulo}:")
        }
        if tiene_lectura_compartida_recepcion(usuario, request):
            return usuario
        tiene_permiso_explicito = modulo in permisos_usuario or any(
            permiso.startswith(f"{modulo}:") for permiso in permisos_usuario
        )
        if permisos_usuario and not tiene_permiso_explicito:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para este módulo")
        if modulo not in modulos_rol and not tiene_permiso_explicito:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para este módulo")
        if usuario.rol != "admin" and permisos_modulo and modulo not in permisos_modulo:
            accion_por_metodo = {
                "GET": "ver",
                "POST": "crear",
                "PUT": "editar",
                "PATCH": "editar",
                "DELETE": "eliminar",
            }
            accion = accion_por_metodo.get(request.method)
            if accion and f"{modulo}:{accion}" not in permisos_usuario:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"No tienes permiso para {accion} en este módulo",
                )
        return usuario
    return verificar_modulo


def requerir_permiso(modulo: str, accion: str):
    permiso = f"{modulo}:{accion}"
    if permiso not in PERMISOS_VALIDOS:
        raise ValueError(f"Permiso no registrado: {permiso}")

    def verificar_permiso(usuario: Usuario = Depends(obtener_usuario_actual)) -> Usuario:
        if usuario.rol == "admin":
            return usuario
        modulos_rol = MODULOS_POR_ROL.get(usuario.rol, set())
        try:
            permisos_usuario = set(json.loads(usuario.permisos or "[]"))
        except (TypeError, ValueError):
            permisos_usuario = set()
        permisos_modulo = {
            permiso_actual for permiso_actual in permisos_usuario
            if permiso_actual == modulo or permiso_actual.startswith(f"{modulo}:")
        }
        if permisos_usuario and not permisos_modulo:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para este módulo")
        if modulo not in modulos_rol and not permisos_modulo:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para este módulo")
        if modulo in permisos_modulo or permiso in permisos_modulo:
            return usuario
        if permisos_modulo:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para esta acción")
        return usuario

    return verificar_permiso
