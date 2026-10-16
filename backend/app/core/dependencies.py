from fastapi import Depends, HTTPException, status

from app.core.seguridad import obtener_usuario_actual, requerir_modulo

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
