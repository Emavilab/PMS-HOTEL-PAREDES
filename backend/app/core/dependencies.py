import json

from fastapi import Depends, HTTPException, status

from app.core.seguridad import obtener_usuario_actual, requerir_modulo, requerir_permiso

def AdminUsuario(usuario_actual=Depends(obtener_usuario_actual)):
    if usuario_actual.rol not in ["admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos")
    return usuario_actual


UsuariosModulo = requerir_modulo("usuarios")
HabitacionesModulo = requerir_modulo("habitaciones")
HuespedesModulo = requerir_modulo("huespedes")
ReservasModulo = requerir_modulo("reservas")
LimpiezaModulo = requerir_modulo("housekeeping")
FacturacionModulo = requerir_modulo("facturacion")
CajaModulo = requerir_modulo("caja")
ReportesModulo = requerir_modulo("reportes")
VentasModulo = requerir_modulo("ventas")
AuditoriaModulo = requerir_modulo("auditoria")
ConfiguracionModulo = requerir_modulo("configuracion")
DashboardModulo = requerir_modulo("dashboard")
UsuariosVer = requerir_permiso("usuarios", "ver")
UsuariosCrear = requerir_permiso("usuarios", "crear")
UsuariosEditar = requerir_permiso("usuarios", "editar")
UsuariosEliminar = requerir_permiso("usuarios", "eliminar")

def GerenteUsuario(usuario_actual=Depends(obtener_usuario_actual)):
    if usuario_actual.rol not in ["admin", "gerente"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos")
    return usuario_actual

def PersonalUsuario(usuario_actual=Depends(obtener_usuario_actual)):
    if usuario_actual.rol not in ["admin", "gerente", "recepcionista"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos")
    return usuario_actual

def LimpiezaUsuario(usuario_actual=Depends(obtener_usuario_actual)):
    if usuario_actual.rol not in ["admin", "gerente", "recepcionista", "limpieza"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos")
    return usuario_actual


def ReportesUsuario(usuario_actual=Depends(obtener_usuario_actual)):
    if usuario_actual.rol in ["admin", "gerente"]:
        return usuario_actual
    try:
        permisos = set(json.loads(usuario_actual.permisos or "[]"))
    except (TypeError, ValueError):
        permisos = set()
    if "reportes" in permisos or "reportes:ver" in permisos:
        return usuario_actual
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para consultar reportes")
