"""Endpoints de autenticación y ciclo de vida de sesiones.

Centraliza el acceso por correo o usuario, la verificación de JWT y el
registro de inicios y cierres de sesión en auditoría.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.seguridad import crear_token_acceso, verificar_password, hash_password
from app.common.auditoria import crear_registro_auditoria
from app.modules.auth.esquemas import LoginRequest, TokenResponse, VerifyTokenRequest
from app.core.seguridad import obtener_usuario_actual
from app.modules.usuarios.modelos import Usuario
from app.modules.usuarios.esquemas import UsuarioResponse

router = APIRouter(prefix="/auth", tags=["Autenticacion"])

@router.post("/login", response_model=TokenResponse)
def login(datos: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Autentica al usuario y emite un token con su versión de sesión."""
    identificador = datos.identificador.strip().lower()
    usuario = db.query(Usuario).filter(
        or_(Usuario.email == identificador, Usuario.usuario == identificador)
    ).first()
    # (previously logged input for debugging; removed)
    if not usuario:
        crear_registro_auditoria(db, None, "LOGIN_FALLIDO", "USUARIO", None, None, {"identificador": identificador, "motivo": "usuario_no_encontrado"}, request.client.host if request.client else None)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales invalidas",
        )
    if not verificar_password(datos.contrasena, usuario.contrasena):
        crear_registro_auditoria(db, usuario.id, "LOGIN_FALLIDO", "USUARIO", usuario.id, None, {"motivo": "contrasena_incorrecta"}, request.client.host if request.client else None)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales invalidas")
    if usuario.estado != "activo":
        crear_registro_auditoria(db, usuario.id, "LOGIN_FALLIDO", "USUARIO", usuario.id, None, {"motivo": "usuario_inactivo"}, request.client.host if request.client else None)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    token = crear_token_acceso(data={
        "sub": usuario.id,
        "rol": usuario.rol,
        "sv": usuario.version_sesion,
    })

    if usuario.contrasena.startswith(("$2a$", "$2b$", "$2y$")):
        usuario.contrasena = hash_password(datos.contrasena)

    usuario.ultimo_acceso = datetime.now(timezone.utc)
    db.commit()
    crear_registro_auditoria(db, usuario.id, "LOGIN", "USUARIO", usuario.id, None, {"resultado": "exitoso"}, request.client.host if request.client else None)

    return TokenResponse(
        access_token=token,
        usuario=UsuarioResponse.model_validate(usuario),
    )


@router.post("/verify", response_model=UsuarioResponse)
def verify_token(datos: VerifyTokenRequest, db: Session = Depends(get_db)):
    """Confirma que un token sigue vigente y que la sesión no fue revocada."""
    from app.core.seguridad import verificar_token

    payload = verificar_token(datos.token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido o expirado",
        )
    usuario_id = payload.get("sub")
    if not usuario_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido",
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
    return UsuarioResponse.model_validate(usuario)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, usuario_actual: Usuario = Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    """Registra el cierre voluntario de la sesión autenticada."""
    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="LOGOUT",
        tipo_entidad="USUARIO",
        entidad_id=usuario_actual.id,
        valores_nuevos={"resultado": "sesion_cerrada"},
        direccion_ip=request.client.host if request.client else None,
    )
