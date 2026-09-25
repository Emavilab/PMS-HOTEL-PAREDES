import json
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import bcrypt

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

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


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
    usuario_nombre = datos.usuario.lower()
    email = str(datos.email).lower()
    existe = db.query(Usuario).filter(
        (Usuario.email == email) | (Usuario.usuario == usuario_nombre)
    ).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario o email ya esta registrado",
        )

    usuario = Usuario(
        usuario=usuario_nombre,
        email=email,
        contrasena=hash_password(datos.contrasena),
        nombre_completo=datos.nombre_completo,
        telefono=datos.telefono,
        rol=datos.rol,
        permisos=json.dumps(datos.permisos) if datos.permisos else "[]",
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
        valores_nuevos={"email": email, "rol": datos.rol, "permisos": datos.permisos},
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
        "usuario": usuario.usuario,
        "email": usuario.email,
        "nombre_completo": usuario.nombre_completo,
        "rol": usuario.rol,
        "estado": usuario.estado,
    }

    datos_actualizar = datos.model_dump(exclude_unset=True)

    if "usuario" in datos_actualizar:
        nuevo_usuario = datos.usuario.lower()
        existe = (
            db.query(Usuario)
            .filter(Usuario.usuario == nuevo_usuario, Usuario.id != usuario_id)
            .first()
        )
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El usuario ya esta registrado",
            )
        usuario.usuario = nuevo_usuario

    if "email" in datos_actualizar:
        nuevo_email = str(datos.email).lower()
        existe = (
            db.query(Usuario)
            .filter(Usuario.email == nuevo_email, Usuario.id != usuario_id)
            .first()
        )
        if existe:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya esta registrado",
            )
        usuario.email = nuevo_email
    if "contrasena" in datos_actualizar:
        usuario.contrasena = hash_password(datos.contrasena)
    if "nombre_completo" in datos_actualizar:
        usuario.nombre_completo = datos.nombre_completo
    if "telefono" in datos_actualizar:
        usuario.telefono = datos.telefono
    if "rol" in datos_actualizar:
        usuario.rol = datos.rol
    if "estado" in datos_actualizar:
        if usuario.id == usuario_actual.id and datos.estado != "activo":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes desactivar tu propio usuario",
            )
        usuario.estado = datos.estado
    if "permisos" in datos_actualizar:
        usuario.permisos = json.dumps(datos.permisos) if datos.permisos else "[]"

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
            "usuario": usuario.usuario,
            "email": usuario.email,
            "nombre_completo": usuario.nombre_completo,
            "rol": usuario.rol,
            "estado": usuario.estado,
            "permisos": usuario.permisos,
        },
        direccion_ip=request.client.host if request.client else None,
    )

    return UsuarioResponse.model_validate(usuario)


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_usuario(
    usuario_id: str,
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
    if usuario.id == usuario_actual.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminar tu propio usuario",
        )
    if usuario.es_superadmin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar un superadministrador",
        )

    valores_anteriores = {
        "email": usuario.email,
        "nombre_completo": usuario.nombre_completo,
        "rol": usuario.rol,
        "estado": usuario.estado,
    }
    db.delete(usuario)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar un usuario con movimientos asociados. Desactivalo cambiando su estado a inactivo.",
        )

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="ELIMINAR",
        tipo_entidad="Usuario",
        entidad_id=usuario_id,
        valores_anteriores=valores_anteriores,
        direccion_ip=request.client.host if request.client else None,
    )
