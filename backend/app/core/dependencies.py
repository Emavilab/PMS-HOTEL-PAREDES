from fastapi import Depends, HTTPException, status

from app.core.seguridad import obtener_usuario_actual

def AdminUsuario(usuario_actual=Depends(obtener_usuario_actual)):
    if usuario_actual.rol not in ["admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos")
    return usuario_actual

def GerenteUsuario(usuario_actual=Depends(obtener_usuario_actual)):
    if usuario_actual.rol not in ["admin", "gerente"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos")
    return usuario_actual

def PersonalUsuario(usuario_actual=Depends(obtener_usuario_actual)):
    if usuario_actual.rol not in ["admin", "gerente", "recepcionista"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos")
    return usuario_actual
