"""Gestión administrativa de usuarios, actividad y sesiones remotas.

Las operaciones sensibles exigen permisos del módulo Usuarios y generan
auditoría con el actor que realizó el cambio.
"""

import json
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import (
    GerenteUsuario,
    UsuariosCrear,
    UsuariosEditar,
    UsuariosEliminar,
    UsuariosModulo,
    UsuariosVer,
)
from app.core.seguridad import hash_password, obtener_usuario_actual
from app.common.auditoria import crear_registro_auditoria
from app.modules.usuarios.modelos import Usuario
from app.modules.usuarios.esquemas import (
    UsuarioCrear,
    UsuarioActualizar,
    UsuarioResponse,
)

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])
UMBRAL_ACTIVIDAD = timedelta(seconds=90)

@router.get("", response_model=list[UsuarioResponse], dependencies=[Depends(UsuariosModulo), Depends(UsuariosVer)])
def listar_usuarios(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """Devuelve las cuentas visibles para el usuario administrador."""
    usuarios = db.query(Usuario).all()
    return [UsuarioResponse.model_validate(u) for u in usuarios]


@router.post("/actividad", status_code=status.HTTP_204_NO_CONTENT)
def registrar_actividad(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """Actualiza la última actividad para detectar usuarios conectados."""
    usuario_actual.ultima_actividad = datetime.now(timezone.utc)
    db.commit()


@router.get("/activos", dependencies=[Depends(UsuariosModulo)])
def listar_usuarios_activos(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(GerenteUsuario),
):
    """Lista usuarios activos con actividad reciente para supervisión."""
    limite = datetime.now(timezone.utc) - UMBRAL_ACTIVIDAD
    usuarios = db.query(Usuario).filter(
        Usuario.estado == "activo", Usuario.ultima_actividad.isnot(None),
        Usuario.ultima_actividad >= limite,
    ).order_by(Usuario.ultima_actividad.desc()).all()
    return [{
        "id": usuario.id,
        "usuario": usuario.usuario,
        "nombre_completo": usuario.nombre_completo,
        "rol": usuario.rol,
        "ultima_actividad": usuario.ultima_actividad,
    } for usuario in usuarios]


@router.post("", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(UsuariosModulo), Depends(UsuariosCrear)])
def crear_usuario(
    datos: UsuarioCrear,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    """Crea una cuenta aplicando hash de contraseña y permisos validados."""
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


@router.get("/{usuario_id}", response_model=UsuarioResponse, dependencies=[Depends(UsuariosModulo), Depends(UsuariosVer)])
def obtener_usuario(
    usuario_id: str,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    return UsuarioResponse.model_validate(usuario)


@router.post("/{usuario_id}/revocar-sesion", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(UsuariosModulo), Depends(UsuariosEditar)])
def revocar_sesion_usuario(
    usuario_id: str,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    if usuario.id == usuario_actual.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes cerrar tu propia sesión desde esta pantalla",
        )

    usuario.version_sesion += 1
    db.commit()
    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="REVOCAR_SESION",
        tipo_entidad="Usuario",
        entidad_id=usuario.id,
        valores_nuevos={"resultado": "sesiones_revocadas"},
        direccion_ip=request.client.host if request.client else None,
    )


@router.put("/{usuario_id}", response_model=UsuarioResponse, dependencies=[Depends(UsuariosModulo), Depends(UsuariosEditar)])
def actualizar_usuario(
    usuario_id: str,
    datos: UsuarioActualizar,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
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


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(UsuariosModulo), Depends(UsuariosEliminar)])
def eliminar_usuario(
    usuario_id: str,
    request: Request,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(obtener_usuario_actual),
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
