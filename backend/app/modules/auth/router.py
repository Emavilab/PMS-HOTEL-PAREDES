from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
import bcrypt

from app.core.database import get_db
from app.core.seguridad import crear_token_acceso
from app.common.auditoria import crear_registro_auditoria
from app.modules.auth.esquemas import LoginRequest, TokenResponse, VerifyTokenRequest
from app.modules.usuarios.modelos import Usuario
from app.modules.usuarios.esquemas import UsuarioResponse

router = APIRouter(prefix="/auth", tags=["Autenticacion"])

@router.post("/login", response_model=TokenResponse)
def login(datos: LoginRequest, request: Request, db: Session = Depends(get_db)):
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
    try:
        # Use bcrypt.checkpw directly to avoid passlib backend detection issues
        if not bcrypt.checkpw(datos.contrasena.encode("utf-8"), usuario.contrasena.encode("utf-8")):
            crear_registro_auditoria(db, usuario.id, "LOGIN_FALLIDO", "USUARIO", usuario.id, None, {"motivo": "contrasena_incorrecta"}, request.client.host if request.client else None)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales invalidas",
            )
    except ValueError as e:
        # bcrypt may raise ValueError for invalid inputs; return a clear 400 error
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if usuario.estado != "activo":
        crear_registro_auditoria(db, usuario.id, "LOGIN_FALLIDO", "USUARIO", usuario.id, None, {"motivo": "usuario_inactivo"}, request.client.host if request.client else None)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    token = crear_token_acceso(data={"sub": usuario.id, "rol": usuario.rol})

    usuario.ultimo_acceso = datetime.now(timezone.utc)
    db.commit()
    crear_registro_auditoria(db, usuario.id, "LOGIN", "USUARIO", usuario.id, None, {"resultado": "exitoso"}, request.client.host if request.client else None)

    return TokenResponse(
        access_token=token,
        usuario=UsuarioResponse.model_validate(usuario),
    )


@router.post("/verify", response_model=UsuarioResponse)
def verify_token(datos: VerifyTokenRequest, db: Session = Depends(get_db)):
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
    return UsuarioResponse.model_validate(usuario)
