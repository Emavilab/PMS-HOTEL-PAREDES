from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.core.database import get_db
from app.core.dependencies import AdminUsuario, GerenteUsuario
from app.common.auditoria import crear_registro_auditoria
from app.modules.usuarios.modelos import Usuario
from app.modules.usuarios.esquemas import (
    UsuarioCrear,
    UsuarioActualizar,
    UsuarioResponse,
)

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.get("", response_model=list[UsuarioResponse])
def listar_usuarios(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(GerenteUsuario),
):
    usuarios = db.query(Usuario).all()
    return [UsuarioResponse.model_validate(u) for u in usuarios]


@router.post("", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    datos: UsuarioCrear,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    existe = db.query(Usuario).filter(Usuario.email == datos.email).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya esta registrado",
        )

    usuario = Usuario(
        email=datos.email,
        contrasena=pwd_context.hash(datos.contrasena),
        nombre_completo=datos.nombre_completo,
        telefono=datos.telefono,
        rol=datos.rol,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CREAR",
        tipo_entidad="Usuario",
        entidad_id=usuario.id,
        valores_nuevos={"email": datos.email, "rol": datos.rol},
        direccion_ip=request.client.host if request.client else None,
    )

    return UsuarioResponse.model_validate(usuario)


@router.get("/{usuario_id}", response_model=UsuarioResponse)
def obtener_usuario(
    usuario_id: str,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(GerenteUsuario),
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return UsuarioResponse.model_validate(usuario)


@router.put("/{usuario_id}", response_model=UsuarioResponse)
def actualizar_usuario(
    usuario_id: str,
    datos: UsuarioActualizar,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    valores_anteriores = {
        "email": usuario.email,
        "nombre_completo": usuario.nombre_completo,
        "rol": usuario.rol,
        "estado": usuario.estado,
    }

    if datos.email is not None:
        existe = (
            db.query(Usuario)
            .filter(Usuario.email == datos.email, Usuario.id != usuario_id)
            .first()
        )
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya esta registrado",
            )
        usuario.email = datos.email
    if datos.contrasena is not None:
        usuario.contrasena = pwd_context.hash(datos.contrasena)
    if datos.nombre_completo is not None:
        usuario.nombre_completo = datos.nombre_completo
    if datos.telefono is not None:
        usuario.telefono = datos.telefono
    if datos.rol is not None:
        usuario.rol = datos.rol
    if datos.estado is not None:
        usuario.estado = datos.estado

    db.commit()
    db.refresh(usuario)

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ACTUALIZAR",
        tipo_entidad="Usuario",
        entidad_id=usuario.id,
        valores_anteriores=valores_anteriores,
        valores_nuevos={
            "email": usuario.email,
            "nombre_completo": usuario.nombre_completo,
            "rol": usuario.rol,
            "estado": usuario.estado,
        },
        direccion_ip=request.client.host if request.client else None,
    )

    return UsuarioResponse.model_validate(usuario)
