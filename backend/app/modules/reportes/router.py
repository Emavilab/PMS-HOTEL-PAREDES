from datetime import date, datetime, timezone, timedelta
from typing import Optional, List
from collections import defaultdict
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, cast, Date, and_, or_
from io import BytesIO

from app.core.database import get_db
from app.core.dependencies import GerenteUsuario, PersonalUsuario, ReportesModulo, DashboardModulo
from app.common.exportar import exportar_excel, exportar_pdf
from app.modules.reportes.esquemas import (
    ReporteOcupacion,
    ReporteIngresos,
    CuentaPorCobrar,
    ReporteCuentasPorCobrar,
    ProductividadCamarera,
    ReporteHousekeeping,
    IngresoPorCanal,
    IngresoPorTipoHabitacion,
    ReporteIngresosDetallado,
    ForecastItem,
    ReporteForecast,
    LibroHuespedesItem,
    ReporteLibroHuespedes,
    ImpuestoTuristicoItem,
    ReporteImpuestosTuristicos,
    ReporteVentas,
    ConciliacionCajaItem,
    ReporteConciliacionCaja,
    KPIEjecutivo,
    ReporteEjecutivo,
)
from app.modules.habitaciones.modelos import Habitacion, TipoHabitacion
from app.modules.reservas.modelos import Reserva
from app.modules.facturacion.modelos import Cargo, Pago
from app.modules.ventas.modelos import Consumo, VentaParticular
from app.modules.usuarios.modelos import Usuario
from app.modules.limpieza.modelos import TareaLimpieza
from app.modules.caja.modelos import SesionCaja
from app.modules.configuracion.modelos import HotelConfig

router = APIRouter(prefix="/reportes", tags=["Reportes"])

router = APIRouter(prefix="/reportes", tags=["Reportes"])

COLUMNAS_OCUPACION = [
    {"key": "fecha", "header": "Fecha", "width": 14},
    {"key": "total_habitaciones", "header": "Total Hab.", "width": 12},
    {"key": "habitaciones_ocupadas", "header": "Ocupadas", "width": 12},
    {"key": "habitaciones_disponibles", "header": "Disponibles", "width": 14},
    {"key": "porcentaje_ocupacion", "header": "% Ocup.", "width": 12},
]

COLUMNAS_INGRESOS = [
    {"key": "fecha", "header": "Fecha", "width": 14},
    {"key": "total_ingresos", "header": "Ingresos", "width": 16},
    {"key": "total_cargos", "header": "Cargos", "width": 14},
    {"key": "total_pagos", "header": "Pagos", "width": 14},
    {"key": "descuentos_aplicados", "header": "Descuentos", "width": 14},
    {"key": "impuestos_recaudados", "header": "Impuestos", "width": 14},
]

COLUMNAS_CUENTAS_COBRAR = [
    {"key": "codigo_confirmacion", "header": "Confirmación", "width": 18},
    {"key": "huesped", "header": "Huésped", "width": 25},
    {"key": "fecha_entrada", "header": "Entrada", "width": 14},
    {"key": "fecha_salida", "header": "Salida", "width": 14},
    {"key": "total_reserva", "header": "Total Reserva", "width": 16},
    {"key": "pagado", "header": "Pagado", "width": 14},
    {"key": "saldo", "header": "Saldo", "width": 14},
    {"key": "dias_vencido", "header": "Días Venc.", "width": 12},
    {"key": "tramo", "header": "Tramo", "width": 10},
]

COLUMNAS_HOUSEKEEPING = [
    {"key": "camarera_nombre", "header": "Camarera", "width": 20},
    {"key": "tareas_asignadas", "header": "Asignadas", "width": 12},
    {"key": "tareas_completadas", "header": "Completadas", "width": 14},
    {"key": "tareas_pendientes", "header": "Pendientes", "width": 12},
    {"key": "tareas_en_progreso", "header": "En Progreso", "width": 14},
    {"key": "porcentaje_completado", "header": "% Completado", "width": 14},
    {"key": "tiempo_promedio_minutos", "header": "Tiempo Prom. (min)", "width": 18},
]

COLUMNAS_CANAL = [
    {"key": "canal", "header": "Canal", "width": 20},
    {"key": "reservas", "header": "Reservas", "width": 12},
    {"key": "ingresos", "header": "Ingresos", "width": 16},
    {"key": "adr", "header": "ADR", "width": 14},
    {"key": "porcentaje", "header": "%", "width": 8},
]

COLUMNAS_TIPO_HAB = [
    {"key": "tipo_habitacion", "header": "Tipo Habitación", "width": 22},
    {"key": "reservas", "header": "Reservas", "width": 12},
    {"key": "ingresos", "header": "Ingresos", "width": 16},
    {"key": "adr", "header": "ADR", "width": 14},
    {"key": "ocupacion_pct", "header": "% Ocup.", "width": 12},
]

COLUMNAS_FORECAST = [
    {"key": "fecha", "header": "Fecha", "width": 14},
    {"key": "ocupacion_estimada_pct", "header": "% Ocup. Est.", "width": 16},
    {"key": "ingresos_estimados", "header": "Ing. Est.", "width": 14},
    {"key": "habitaciones_ocupadas_estimadas", "header": "Hab. Est.", "width": 14},
]

COLUMNAS_LIBRO_HUESPEDES = [
    {"key": "numero_registro", "header": "Nº Registro", "width": 12},
    {"key": "fecha_registro", "header": "Fecha Reg.", "width": 14},
    {"key": "codigo_confirmacion", "header": "Confirmación", "width": 18},
    {"key": "huesped_nombre", "header": "Huésped", "width": 25},
    {"key": "huesped_documento", "header": "Documento", "width": 20},
    {"key": "huesped_nacionalidad", "header": "Nacionalidad", "width": 18},
    {"key": "fecha_entrada", "header": "Entrada", "width": 14},
    {"key": "fecha_salida", "header": "Salida", "width": 14},
    {"key": "habitacion", "header": "Hab.", "width": 10},
    {"key": "adultos", "header": "Ad.", "width": 6},
    {"key": "ninos", "header": "Niños", "width": 6},
    {"key": "estado", "header": "Estado", "width": 12},
    {"key": "total", "header": "Total", "width": 14},
]

COLUMNAS_IMPUESTOS_TURISTICOS = [
    {"key": "codigo_confirmacion", "header": "Confirmación", "width": 18},
    {"key": "huesped", "header": "Huésped", "width": 25},
    {"key": "fecha_entrada", "header": "Entrada", "width": 14},
    {"key": "fecha_salida", "header": "Salida", "width": 14},
    {"key": "noches", "header": "Noches", "width": 8},
    {"key": "tarifa_base", "header": "Tarifa Base", "width": 14},
    {"key": "impuesto_turistico", "header": "Imp. Turístico", "width": 16},
    {"key": "total_con_impuesto", "header": "Total c/Imp.", "width": 16},
]

COLUMNAS_CONCILIACION_CAJA = [
    {"key": "fecha", "header": "Fecha", "width": 14},
    {"key": "cajero", "header": "Cajero", "width": 20},
    {"key": "monto_apertura", "header": "Apertura", "width": 14},
    {"key": "monto_esperado", "header": "Esperado", "width": 14},
    {"key": "monto_declarado", "header": "Declarado", "width": 14},
    {"key": "diferencia", "header": "Diferencia", "width": 14},
    {"key": "estado", "header": "Estado", "width": 12},
]

COLUMNAS_VENTAS = [
    {"key": "fecha", "header": "Fecha", "width": 14},
    {"key": "tipo", "header": "Tipo", "width": 18},
    {"key": "cliente", "header": "Cliente", "width": 24},
    {"key": "habitacion", "header": "Habitación", "width": 14},
    {"key": "producto", "header": "Producto", "width": 24},
    {"key": "cantidad", "header": "Cantidad", "width": 10},
    {"key": "metodo_pago", "header": "Método", "width": 16},
    {"key": "total", "header": "Total", "width": 14},
]

COLUMNAS_EJECUTIVO = [
    {"key": "periodo", "header": "Período", "width": 18},
    {"key": "revpar", "header": "RevPAR", "width": 14},
    {"key": "adr", "header": "ADR", "width": 12},
    {"key": "ocupacion_pct", "header": "% Ocup.", "width": 12},
    {"key": "goppar", "header": "GOPPAR", "width": 14},
    {"key": "ingresos_totales", "header": "Ing. Totales", "width": 16},
    {"key": "habitaciones_vendidas", "header": "Hab. Vendidas", "width": 16},
    {"key": "habitaciones_disponibles", "header": "Hab. Disp.", "width": 14},
    {"key": "total_huespedes", "header": "Huéspedes", "width": 12},
    {"key": "estancia_media", "header": "Est. Media", "width": 12},
    {"key": "ingresos_por_huesped", "header": "Ing./Huésped", "width": 16},
]


@router.get("/ocupacion", response_model=list[ReporteOcupacion], dependencies=[Depends(ReportesModulo)])
def reporte_ocupacion(
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    total_habitaciones = db.query(func.count(Habitacion.id)).scalar() or 0
    if total_habitaciones == 0:
        return []

    from datetime import timedelta

    resultados = []
    fecha_actual = desde
    while fecha_actual <= hasta:
        ocupadas = (
            db.query(func.count(Reserva.id))
            .filter(
                Reserva.estado.in_(["PENDIENTE", "CONFIRMADA", "CHECKED_IN"]),
                Reserva.fecha_entrada <= fecha_actual,
                Reserva.fecha_salida > fecha_actual,
            )
            .scalar()
            or 0
        )
        disponibles = total_habitaciones - ocupadas
        porcentaje = round((ocupadas / total_habitaciones) * 100, 2) if total_habitaciones > 0 else 0

        resultados.append(
            ReporteOcupacion(
                fecha=fecha_actual,
                total_habitaciones=total_habitaciones,
                habitaciones_ocupadas=ocupadas,
                habitaciones_disponibles=disponibles,
                porcentaje_ocupacion=porcentaje,
            )
        )
        fecha_actual += timedelta(days=1)

    return resultados


@router.get("/exportar", dependencies=[Depends(ReportesModulo)])
def exportar_reporte(
    tipo: str = Query(..., description="ocupacion | ingresos"),
    formato: str = Query("xlsx", description="xlsx | pdf"),
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    if tipo == "ocupacion":
        datos_model = reporte_ocupacion(desde=desde, hasta=hasta, db=db, _=None)
        columnas = COLUMNAS_OCUPACION
        titulo = "Reporte de Ocupación"
        subtitulo = f"Período: {desde.strftime('%d/%m/%Y')} - {hasta.strftime('%d/%m/%Y')}"
    elif tipo == "ingresos":
        reporte = reporte_ingresos(desde=desde, hasta=hasta, db=db, _=None)
        datos_model = [
            {
                "fecha": f"{reporte.desde} - {reporte.hasta}",
                "total_ingresos": reporte.total_ingresos,
                "total_cargos": reporte.total_cargos,
                "total_pagos": reporte.total_pagos,
                "descuentos_aplicados": reporte.descuentos_aplicados,
                "impuestos_recaudados": reporte.impuestos_recaudados,
            }
        ]
        columnas = COLUMNAS_INGRESOS
        titulo = "Reporte de Ingresos"
        subtitulo = f"Período: {desde.strftime('%d/%m/%Y')} - {hasta.strftime('%d/%m/%Y')}"
    else:
        raise HTTPException(status_code=400, detail="Tipo de reporte no válido: ocupacion | ingresos")

    datos = [item.model_dump() if hasattr(item, "model_dump") else item for item in datos_model]

    if formato == "xlsx":
        contenido = exportar_excel(datos, columnas, titulo)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        extension = "xlsx"
    elif formato == "pdf":
        contenido = exportar_pdf(datos, columnas, titulo, subtitulo)
        media_type = "application/pdf"
        extension = "pdf"
    else:
        raise HTTPException(status_code=400, detail="Formato no válido: xlsx | pdf")

    filename = f"{tipo}_{desde.strftime('%Y%m%d')}_{hasta.strftime('%Y%m%d')}.{extension}"
    return StreamingResponse(
        BytesIO(contenido),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/ingresos", response_model=ReporteIngresos, dependencies=[Depends(DashboardModulo)])
def reporte_ingresos(
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    total_cargos = (
        db.query(func.coalesce(func.sum(Cargo.total), 0))
        .filter(cast(Cargo.fecha_cargo, Date) >= desde, cast(Cargo.fecha_cargo, Date) <= hasta)
        .scalar()
        or 0
    )

    total_pagos = (
        db.query(func.coalesce(func.sum(Pago.monto), 0))
        .filter(cast(Pago.pagado_en, Date) >= desde, cast(Pago.pagado_en, Date) <= hasta)
        .scalar()
        or 0
    )

    descuentos = (
        db.query(func.coalesce(func.sum(Reserva.descuento), 0))
        .filter(
            Reserva.creado_en >= desde,
            Reserva.creado_en <= hasta,
        )
        .scalar()
        or 0
    )

    impuestos = (
        db.query(func.coalesce(func.sum(Reserva.impuesto), 0))
        .filter(
            Reserva.creado_en >= desde,
            Reserva.creado_en <= hasta,
        )
        .scalar()
        or 0
    )

    total_ingresos = (
        db.query(func.coalesce(func.sum(Reserva.total), 0))
        .filter(
            Reserva.creado_en >= desde,
            Reserva.creado_en <= hasta,
        )
        .scalar()
        or 0
    )

    return ReporteIngresos(
        desde=desde,
        hasta=hasta,
        total_ingresos=float(total_ingresos),
        total_cargos=float(total_cargos),
        total_pagos=float(total_pagos),
        descuentos_aplicados=float(descuentos),
        impuestos_recaudados=float(impuestos),
    )


@router.get("/llegadas", response_model=list[dict], dependencies=[Depends(DashboardModulo)])
def llegadas_del_dia(
    fecha: date | None = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    dia = fecha or date.today()
    reservas = (
        db.query(Reserva)
        .filter(
            Reserva.fecha_entrada == dia,
            Reserva.estado.in_(["PENDIENTE", "CONFIRMADA", "CHECKED_IN"]),
        )
        .all()
    )
    resultado = []
    for r in reservas:
        nombre = f"{r.huesped.nombres} {r.huesped.apellidos}" if r.huesped else "N/A"
        resultado.append(
            {
                "id": r.id,
                "codigo_confirmacion": r.codigo_confirmacion,
                "huesped": nombre,
                "fecha_entrada": str(r.fecha_entrada),
                "fecha_salida": str(r.fecha_salida),
                "habitacion": r.habitacion_ref.numero if r.habitacion_ref else None,
                "tipo_habitacion_id": r.tipo_habitacion_id,
                "estado": r.estado,
            }
        )
    return resultado


@router.get("/notificaciones", response_model=list[dict], dependencies=[Depends(DashboardModulo)])
def notificaciones_operativas(
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    """Resume eventos operativos que requieren atención en recepción y gerencia."""
    hoy = date.today()
    limite = hoy + timedelta(days=7)
    notificaciones = []

    reservas = db.query(Reserva).filter(
        Reserva.estado.in_(["PENDIENTE", "CONFIRMADA", "CHECKED_IN"]),
        or_(Reserva.fecha_entrada.between(hoy, limite), Reserva.fecha_salida.between(hoy, limite)),
    ).order_by(Reserva.fecha_entrada, Reserva.fecha_salida).all()
    for reserva in reservas:
        nombre = f"{reserva.huesped.nombres} {reserva.huesped.apellidos}" if reserva.huesped else "Huésped"
        if reserva.fecha_entrada == hoy and reserva.estado != "CHECKED_IN":
            notificaciones.append({"id": f"llegada-{reserva.id}", "tipo": "llegada", "prioridad": "alta", "titulo": "Llegada hoy", "mensaje": f"{nombre} · {reserva.codigo_confirmacion}", "fecha": str(reserva.fecha_entrada), "href": "/reservas"})
        elif hoy < reserva.fecha_entrada <= limite:
            notificaciones.append({"id": f"llegada-{reserva.id}", "tipo": "llegada", "prioridad": "media", "titulo": "Próxima llegada", "mensaje": f"{nombre} · {reserva.fecha_entrada}", "fecha": str(reserva.fecha_entrada), "href": "/reservas"})
        if reserva.fecha_salida == hoy and reserva.estado == "CHECKED_IN":
            notificaciones.append({"id": f"salida-{reserva.id}", "tipo": "salida", "prioridad": "alta", "titulo": "Salida pendiente hoy", "mensaje": f"{nombre} · habitación {reserva.habitacion_ref.numero if reserva.habitacion_ref else 'sin asignar'}", "fecha": str(reserva.fecha_salida), "href": "/verificar-salida"})
        elif hoy < reserva.fecha_salida <= limite:
            notificaciones.append({"id": f"salida-{reserva.id}", "tipo": "salida", "prioridad": "media", "titulo": "Próxima salida", "mensaje": f"{nombre} · {reserva.fecha_salida}", "fecha": str(reserva.fecha_salida), "href": "/verificar-salida"})

    reservas_vencidas = db.query(Reserva).filter(Reserva.estado == "PENDIENTE", Reserva.fecha_entrada < hoy).count()
    if reservas_vencidas:
        notificaciones.append({"id": "reservas-vencidas", "tipo": "reserva", "prioridad": "alta", "titulo": "Reservas pendientes vencidas", "mensaje": f"{reservas_vencidas} reserva(s) requieren confirmación o cancelación", "fecha": str(hoy), "href": "/reservas"})

    tareas_pendientes = db.query(TareaLimpieza).filter(TareaLimpieza.estado.in_(["PENDIENTE", "EN_PROGRESO"]), TareaLimpieza.fecha_tarea <= hoy.isoformat()).count()
    if tareas_pendientes:
        notificaciones.append({"id": "limpieza-pendiente", "tipo": "limpieza", "prioridad": "alta", "titulo": "Limpieza pendiente", "mensaje": f"{tareas_pendientes} tarea(s) necesitan atención", "fecha": str(hoy), "href": "/housekeeping"})

    caja_abierta = db.query(SesionCaja).filter(SesionCaja.estado == "ABIERTA").count()
    if caja_abierta:
        notificaciones.append({"id": "caja-abierta", "tipo": "caja", "prioridad": "media", "titulo": "Caja abierta", "mensaje": f"{caja_abierta} sesión(es) de caja siguen abiertas", "fecha": str(hoy), "href": "/caja"})

    orden = {"alta": 0, "media": 1, "baja": 2}
    return sorted(notificaciones, key=lambda item: (orden[item["prioridad"]], item["fecha"]))[:100]


@router.get("/salidas", response_model=list[dict], dependencies=[Depends(DashboardModulo)])
def salidas_del_dia(
    fecha: date | None = Query(None),
    dias: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    """Devuelve salidas para el rango [fecha, fecha+dias). Por defecto: desde hoy hasta 7 días."""
    inicio = fecha or date.today()
    fin = inicio + timedelta(days=dias)
    reservas = (
        db.query(Reserva)
        .filter(
            Reserva.fecha_salida >= inicio,
            Reserva.fecha_salida < fin,
            Reserva.estado == "CHECKED_IN",
        )
        .order_by(Reserva.fecha_salida)
        .all()
    )
    resultado = []
    for r in reservas:
        nombre = f"{r.huesped.nombres} {r.huesped.apellidos}" if r.huesped else "N/A"
        resultado.append(
            {
                "id": r.id,
                "reserva_id": r.id,
                "codigo_confirmacion": r.codigo_confirmacion,
                "huesped": nombre,
                "fecha_entrada": str(r.fecha_entrada),
                "fecha_salida": str(r.fecha_salida),
                "habitacion": r.habitacion_ref.numero if r.habitacion_ref else None,
                "estado": r.estado,
                "total": float(r.total),
            }
        )
    return resultado


# ===== NUEVOS REPORTES FASE 2 =====

@router.get("/cuentas-por-cobrar", response_model=ReporteCuentasPorCobrar, dependencies=[Depends(ReportesModulo)])
def reporte_cuentas_por_cobrar(
    hasta: date = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    """Aging de cuentas por cobrar: reservas con saldo pendiente agrupadas por tramo de vencimiento."""
    fecha_limite = hasta or date.today()

    reservas_con_saldo = (
        db.query(Reserva)
        .filter(
            Reserva.estado.in_(["PENDIENTE", "CONFIRMADA", "CHECKED_IN", "CHECKED_OUT"]),
            Reserva.total > 0,
        )
        .all()
    )

    items = []
    por_tramo = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
    total_saldo = 0.0

    for r in reservas_con_saldo:
        pagos = db.query(func.coalesce(func.sum(Pago.monto), 0)).filter(Pago.reserva_id == r.id).scalar() or 0
        saldo = float(r.total or 0) - float(pagos)
        if saldo <= 0.01:
            continue

        dias_vencido = (fecha_limite - r.fecha_salida).days
        if dias_vencido < 0:
            dias_vencido = 0

        if dias_vencido <= 30:
            tramo = "0-30"
        elif dias_vencido <= 60:
            tramo = "31-60"
        elif dias_vencido <= 90:
            tramo = "61-90"
        else:
            tramo = "90+"

        nombre = f"{r.huesped.nombres} {r.huesped.apellidos}" if r.huesped else "N/A"

        items.append(CuentaPorCobrar(
            reserva_id=r.id,
            codigo_confirmacion=r.codigo_confirmacion,
            huesped=nombre,
            fecha_entrada=r.fecha_entrada,
            fecha_salida=r.fecha_salida,
            total_reserva=float(r.total or 0),
            pagado=float(pagos),
            saldo=round(saldo, 2),
            dias_vencido=dias_vencido,
            tramo=tramo,
        ))
        por_tramo[tramo] += round(saldo, 2)
        total_saldo += round(saldo, 2)

    return ReporteCuentasPorCobrar(
        items=items,
        total_saldo=round(total_saldo, 2),
        por_tramo=por_tramo,
    )


@router.get("/housekeeping", response_model=ReporteHousekeeping, dependencies=[Depends(ReportesModulo)])
def reporte_housekeeping(
    fecha: date = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    """Productividad de housekeeping por camarera en una fecha."""
    dia = fecha or date.today()

    tareas = db.query(TareaLimpieza).filter(TareaLimpieza.fecha_tarea == dia).all()

    total_tareas = len(tareas)
    completadas = sum(1 for t in tareas if t.estado == "COMPLETADA")
    en_progreso = sum(1 for t in tareas if t.estado == "EN_PROGRESO")
    pendientes = sum(1 for t in tareas if t.estado in ("PENDIENTE", "ASIGNADA"))
    inspecciones_fallidas = sum(1 for t in tareas if t.estado == "INSPECCION_FALLIDA")

    from collections import defaultdict
    por_camarera = defaultdict(lambda: {
        "asignadas": 0, "completadas": 0, "pendientes": 0, "en_progreso": 0,
        "tiempos": []
    })

    for t in tareas:
        camarera_id = t.asignada_a or "SIN_ASIGNAR"
        por_camarera[camarera_id]["asignadas"] += 1
        if t.estado == "COMPLETADA":
            por_camarera[camarera_id]["completadas"] += 1
            if t.iniciada_en and t.completada_en:
                duracion = (t.completada_en - t.iniciada_en).total_seconds() / 60
                por_camarera[camarera_id]["tiempos"].append(duracion)
        elif t.estado == "EN_PROGRESO":
            por_camarera[camarera_id]["en_progreso"] += 1
        else:
            por_camarera[camarera_id]["pendientes"] += 1

    camarera_ids = [cid for cid in por_camarera.keys() if cid != "SIN_ASIGNAR"]
    camareras = {}
    if camarera_ids:
        usuarios = db.query(Usuario).filter(Usuario.id.in_(camarera_ids)).all()
        camareras = {u.id: u.nombre_completo for u in usuarios}

    productividad = []
    for cid, stats in por_camarera.items():
        nombre = camareras.get(cid, "Sin asignar") if cid != "SIN_ASIGNAR" else "Sin asignar"
        pct = round((stats["completadas"] / stats["asignadas"] * 100), 1) if stats["asignadas"] > 0 else 0
        tiempo_prom = round(sum(stats["tiempos"]) / len(stats["tiempos"]), 1) if stats["tiempos"] else None

        productividad.append(ProductividadCamarera(
            camarera_id=cid,
            camarera_nombre=nombre,
            tareas_asignadas=stats["asignadas"],
            tareas_completadas=stats["completadas"],
            tareas_pendientes=stats["pendientes"],
            tareas_en_progreso=stats["en_progreso"],
            porcentaje_completado=pct,
            tiempo_promedio_minutos=tiempo_prom,
        ))

    return ReporteHousekeeping(
        fecha=dia,
        total_tareas=total_tareas,
        completadas=completadas,
        en_progreso=en_progreso,
        pendientes=pendientes,
        inspecciones_fallidas=inspecciones_fallidas,
        productividad_por_camarera=productividad,
    )


@router.get("/ingresos-detallado", response_model=ReporteIngresosDetallado, dependencies=[Depends(ReportesModulo)])
def reporte_ingresos_detallado(
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    """Ingresos desglosados por canal de venta y tipo de habitación."""
    reservas = db.query(Reserva).filter(
        Reserva.creado_en >= desde,
        Reserva.creado_en <= hasta,
        Reserva.estado.in_(["CONFIRMADA", "CHECKED_IN", "CHECKED_OUT"]),
    ).all()

    total_ingresos = sum(float(r.total or 0) for r in reservas)

    por_canal_dict = {}
    for r in reservas:
        canal = r.origen or "Sin especificar"
        if canal not in por_canal_dict:
            por_canal_dict[canal] = {"reservas": 0, "ingresos": 0.0}
        por_canal_dict[canal]["reservas"] += 1
        por_canal_dict[canal]["ingresos"] += float(r.total or 0)

    por_canal = []
    for canal, datos in por_canal_dict.items():
        adr = round(datos["ingresos"] / datos["reservas"], 2) if datos["reservas"] > 0 else 0
        pct = round(datos["ingresos"] / total_ingresos * 100, 1) if total_ingresos > 0 else 0
        por_canal.append(IngresoPorCanal(
            canal=canal,
            reservas=datos["reservas"],
            ingresos=round(datos["ingresos"], 2),
            adr=adr,
            porcentaje=pct,
        ))

    tipo_ids = list(set(r.tipo_habitacion_id for r in reservas if r.tipo_habitacion_id))
    tipos = {}
    if tipo_ids:
        tipos_db = db.query(TipoHabitacion).filter(TipoHabitacion.id.in_(tipo_ids)).all()
        tipos = {t.id: t.nombre for t in tipos_db}

    por_tipo_dict = {}
    for r in reservas:
        if not r.tipo_habitacion_id:
            continue
        tid = r.tipo_habitacion_id
        if tid not in por_tipo_dict:
            por_tipo_dict[tid] = {"reservas": 0, "ingresos": 0.0}
        por_tipo_dict[tid]["reservas"] += 1
        por_tipo_dict[tid]["ingresos"] += float(r.total or 0)

    habitaciones_por_tipo = db.query(
        TipoHabitacion.id, func.count(Habitacion.id)
    ).join(Habitacion, Habitacion.tipo_habitacion_id == TipoHabitacion.id).group_by(TipoHabitacion.id).all()
    hab_por_tipo = {tid: count for tid, count in habitaciones_por_tipo}

    dias_periodo = (hasta - desde).days + 1
    por_tipo = []
    for tid, datos in por_tipo_dict.items():
        nombre_tipo = tipos.get(tid, "Sin tipo")
        adr = round(datos["ingresos"] / datos["reservas"], 2) if datos["reservas"] > 0 else 0
        habitaciones = hab_por_tipo.get(tid, 1)
        capacidad_total = habitaciones * dias_periodo
        ocup_pct = round(min(100, (datos["reservas"] / capacidad_total * 100)) if capacidad_total > 0 else 0, 1)
        por_tipo.append(IngresoPorTipoHabitacion(
            tipo_habitacion=nombre_tipo,
            reservas=datos["reservas"],
            ingresos=round(datos["ingresos"], 2),
            adr=adr,
            ocupacion_pct=ocup_pct,
        ))

    return ReporteIngresosDetallado(
        desde=desde,
        hasta=hasta,
        total_ingresos=round(total_ingresos, 2),
        por_canal=por_canal,
        por_tipo_habitacion=por_tipo,
    )


@router.get("/forecast", response_model=ReporteForecast, dependencies=[Depends(ReportesModulo)])
def reporte_forecast(
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    """Forecast simple: ocupación e ingresos estimados basados en reservas confirmadas/pendientes."""
    reservas = db.query(Reserva).filter(
        Reserva.estado.in_(["PENDIENTE", "CONFIRMADA"]),
        Reserva.fecha_entrada <= hasta,
        Reserva.fecha_salida >= desde,
    ).all()

    total_habitaciones = db.query(func.count(Habitacion.id)).scalar() or 1

    items = []
    fecha_actual = desde
    while fecha_actual <= hasta:
        ocupadas_est = 0
        ingresos_est = 0.0
        for r in reservas:
            if r.fecha_entrada <= fecha_actual < r.fecha_salida:
                ocupadas_est += 1
                noches = (r.fecha_salida - r.fecha_entrada).days
                if noches > 0:
                    ingresos_est += float(r.total or 0) / noches

        pct = round((ocupadas_est / total_habitaciones) * 100, 1) if total_habitaciones > 0 else 0
        items.append(ForecastItem(
            fecha=fecha_actual,
            ocupacion_estimada_pct=pct,
            ingresos_estimados=round(ingresos_est, 2),
            habitaciones_ocupadas_estimadas=ocupadas_est,
        ))
        fecha_actual += timedelta(days=1)

    return ReporteForecast(
        desde=desde,
        hasta=hasta,
        items=items,
    )


# ===== FASE 3: CUMPLIMIENTO Y EJECUTIVO =====

@router.get("/ventas", response_model=ReporteVentas, dependencies=[Depends(ReportesModulo)])
def reporte_ventas(
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    inicio = datetime.combine(desde, datetime.min.time())
    fin = datetime.combine(hasta, datetime.max.time())
    ventas = db.query(VentaParticular).filter(
        VentaParticular.creado_en >= inicio,
        VentaParticular.creado_en <= fin,
    ).order_by(VentaParticular.creado_en.desc()).all()
    consumos = db.query(Consumo).filter(
        Consumo.creado_en >= inicio,
        Consumo.creado_en <= fin,
    ).order_by(Consumo.creado_en.desc()).all()

    items = []
    total_particulares = 0.0
    total_consumos = 0.0
    for venta in ventas:
        for item in json.loads(venta.items or "[]"):
            total_particulares += float(item.get("total", 0))
            items.append({
                "fecha": venta.creado_en.date(),
                "tipo": "Cliente particular",
                "cliente": venta.cliente_nombre,
                "habitacion": "-",
                "producto": item.get("nombre", "Producto"),
                "cantidad": item.get("cantidad", 0),
                "metodo_pago": venta.metodo_pago,
                "total": float(item.get("total", 0)),
            })
    for consumo in consumos:
        total_consumos += float(consumo.total or 0)
        reserva = consumo.reserva
        cliente = f"{reserva.huesped.nombres} {reserva.huesped.apellidos}" if reserva and reserva.huesped else "Huésped"
        habitacion = reserva.habitacion_ref.numero if reserva and reserva.habitacion_ref else "-"
        items.append({
            "fecha": consumo.creado_en.date(),
            "tipo": "Consumo habitación",
            "cliente": cliente,
            "habitacion": habitacion,
            "producto": consumo.producto.nombre if consumo.producto else "Producto",
            "cantidad": consumo.cantidad,
            "metodo_pago": "Pagado" if consumo.pagado else "Pendiente",
            "total": float(consumo.total or 0),
        })

    return ReporteVentas(
        desde=desde,
        hasta=hasta,
        total_ventas=round(total_particulares + total_consumos, 2),
        total_particulares=round(total_particulares, 2),
        total_consumos=round(total_consumos, 2),
        ventas_particulares=len(ventas),
        consumos=len(consumos),
        items=items,
    )

@router.get("/libro-huespedes", response_model=ReporteLibroHuespedes, dependencies=[Depends(ReportesModulo)])
def reporte_libro_huespedes(
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    """Libro de Huéspedes legal: registro numerado de todas las estancias en el período."""
    reservas = db.query(Reserva).filter(
        Reserva.fecha_entrada >= desde,
        Reserva.fecha_entrada <= hasta,
        Reserva.estado.in_(["CONFIRMADA", "CHECKED_IN", "CHECKED_OUT"]),
    ).order_by(Reserva.fecha_entrada, Reserva.creado_en).all()

    items = []
    for idx, r in enumerate(reservas, 1):
        huesped = r.huesped
        nombre = f"{huesped.nombres} {huesped.apellidos}" if huesped else "N/A"
        doc = huesped.numero_documento if huesped else None
        nac = huesped.nacionalidad if huesped else None
        dir_h = huesped.direccion if huesped else None
        hab = r.habitacion_ref.numero if r.habitacion_ref else "Sin asignar"

        items.append(LibroHuespedesItem(
            numero_registro=idx,
            fecha_registro=r.creado_en.date() if r.creado_en else r.fecha_entrada,
            codigo_confirmacion=r.codigo_confirmacion,
            huesped_nombre=nombre,
            huesped_documento=doc,
            huesped_nacionalidad=nac,
            huesped_direccion=dir_h,
            fecha_entrada=r.fecha_entrada,
            fecha_salida=r.fecha_salida,
            habitacion=hab,
            adultos=r.adultos or 1,
            ninos=r.ninos or 0,
            estado=r.estado,
            total=float(r.total or 0),
        ))

    return ReporteLibroHuespedes(
        desde=desde,
        hasta=hasta,
        total_registros=len(items),
        items=items,
    )


@router.get("/impuestos-turisticos", response_model=ReporteImpuestosTuristicos, dependencies=[Depends(ReportesModulo)])
def reporte_impuestos_turisticos(
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    """Impuesto turístico por huésped/noche (configurable % sobre tarifa base)."""
    # Usar el % de impuesto configurado (ej. 10% típico impuesto turístico)
    config = db.query(HotelConfig).first()
    pct_turistico = (config.impuesto_turistico if config and hasattr(config, 'impuesto_turistico') and config.impuesto_turistico else 10.0) / 100

    reservas = db.query(Reserva).filter(
        Reserva.fecha_entrada >= desde,
        Reserva.fecha_salida <= hasta,
        Reserva.estado.in_(["CHECKED_IN", "CHECKED_OUT"]),
    ).all()

    items = []
    total_noches = 0
    total_impuesto = 0.0

    for r in reservas:
        noches = (r.fecha_salida - r.fecha_entrada).days
        if noches <= 0:
            continue
        tarifa_noche = float(r.subtotal or 0) / max(noches, 1)
        impuesto_noche = round(tarifa_noche * pct_turistico, 2)
        impuesto_total = round(impuesto_noche * noches, 2)

        huesped = r.huesped
        nombre = f"{huesped.nombres} {huesped.apellidos}" if huesped else "N/A"

        items.append(ImpuestoTuristicoItem(
            reserva_id=r.id,
            codigo_confirmacion=r.codigo_confirmacion,
            huesped=nombre,
            fecha_entrada=r.fecha_entrada,
            fecha_salida=r.fecha_salida,
            noches=noches,
            tarifa_base=round(tarifa_noche, 2),
            impuesto_turistico=impuesto_total,
            total_con_impuesto=round(float(r.total or 0) + impuesto_total, 2),
        ))
        total_noches += noches
        total_impuesto += impuesto_total

    return ReporteImpuestosTuristicos(
        desde=desde,
        hasta=hasta,
        total_noches=total_noches,
        total_impuesto_turistico=round(total_impuesto, 2),
        items=items,
    )


@router.get("/conciliacion-caja", response_model=ReporteConciliacionCaja, dependencies=[Depends(ReportesModulo)])
def reporte_conciliacion_caja(
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    """Conciliación de caja: arqueos, diferencias y estado por sesión."""
    sesiones = db.query(SesionCaja).options(
        joinedload(SesionCaja.usuario)
    ).filter(
        SesionCaja.abierta_en >= desde,
        SesionCaja.abierta_en <= hasta,
    ).order_by(SesionCaja.abierta_en).all()

    items = []
    total_diferencias = 0.0
    cuadradas = 0
    con_diff = 0

    for s in sesiones:
        diferencia = float(s.diferencia or 0)
        if abs(diferencia) < 0.01:
            cuadradas += 1
        else:
            con_diff += 1
        total_diferencias += diferencia

        items.append(ConciliacionCajaItem(
            fecha=s.abierta_en.date() if s.abierta_en else date.today(),
            sesion_id=s.id,
            cajero=s.nombre_usuario or s.usuario_id[:8],
            monto_apertura=float(s.monto_apertura or 0),
            monto_esperado=float(s.monto_esperado or 0),
            monto_declarado=float(s.monto_declarado or 0),
            diferencia=round(diferencia, 2),
            estado=s.estado,
        ))

    return ReporteConciliacionCaja(
        desde=desde,
        hasta=hasta,
        total_sesiones=len(items),
        total_diferencias=round(total_diferencias, 2),
        sesiones_cuadradas=cuadradas,
        sesiones_con_diferencia=con_diff,
        items=items,
    )


@router.get("/ejecutivo", response_model=ReporteEjecutivo, dependencies=[Depends(ReportesModulo)])
def reporte_ejecutivo(
    desde: date = Query(...),
    hasta: date = Query(...),
    granularidad: str = Query("mensual", description="diario | semanal | mensual"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    """Dashboard ejecutivo: RevPAR, ADR, Ocupación, GOPPAR por período."""
    reservas = db.query(Reserva).filter(
        Reserva.creado_en >= desde,
        Reserva.creado_en <= hasta,
        Reserva.estado.in_(["CONFIRMADA", "CHECKED_IN", "CHECKED_OUT"]),
    ).all()

    total_habitaciones = db.query(func.count(Habitacion.id)).scalar() or 1
    dias_totales = (hasta - desde).days + 1

    # Agrupar según granularidad
    from collections import defaultdict
    buckets = defaultdict(lambda: {
        "ingresos": 0.0, "hab_vendidas": 0, "huespedes": 0,
        "noches_total": 0, "hab_disp_dias": 0
    })

    for r in reservas:
        inicio = max(r.fecha_entrada, desde)
        fin = min(r.fecha_salida, hasta)
        if inicio >= fin:
            continue
        noches = (fin - inicio).days
        if noches <= 0:
            continue

        # Clave según granularidad
        if granularidad == "diario":
            for d in range(noches):
                dia = inicio + timedelta(days=d)
                key = dia.strftime("%Y-%m-%d")
                buckets[key]["ingresos"] += float(r.total or 0) / max(noches, 1)
                buckets[key]["hab_vendidas"] += 1
                buckets[key]["huespedes"] += (r.adultos or 1) + (r.ninos or 0)
                buckets[key]["noches_total"] += 1
                buckets[key]["hab_disp_dias"] += total_habitaciones
        elif granularidad == "semanal":
            # ISO week
            key = inicio.strftime("%Y-W%V")
            buckets[key]["ingresos"] += float(r.total or 0)
            buckets[key]["hab_vendidas"] += 1
            buckets[key]["huespedes"] += (r.adultos or 1) + (r.ninos or 0)
            buckets[key]["noches_total"] += noches
            buckets[key]["hab_disp_dias"] += total_habitaciones * 7
        else:  # mensual
            key = inicio.strftime("%Y-%m")
            buckets[key]["ingresos"] += float(r.total or 0)
            buckets[key]["hab_vendidas"] += 1
            buckets[key]["huespedes"] += (r.adultos or 1) + (r.ninos or 0)
            buckets[key]["noches_total"] += noches
            dias_mes = 30  # aproximado
            buckets[key]["hab_disp_dias"] += total_habitaciones * dias_mes

    kpis = []
    total_ingresos = 0
    total_hab_vendidas = 0
    total_huespedes = 0
    total_noches = 0
    total_hab_disp = 0

    for key in sorted(buckets.keys()):
        b = buckets[key]
        adr = round(b["ingresos"] / b["hab_vendidas"], 2) if b["hab_vendidas"] > 0 else 0
        ocup = round((b["hab_vendidas"] / max(b["hab_disp_dias"], 1)) * 100, 1) if b["hab_disp_dias"] > 0 else 0
        revpar = round(adr * ocup / 100, 2)
        goppar = round(revpar * 0.7, 2) if revpar else None  # estimado 70% margen bruto
        estancia_media = round(b["noches_total"] / max(b["hab_vendidas"], 1), 1) if b["hab_vendidas"] > 0 else 0
        ing_por_huesp = round(b["ingresos"] / max(b["huespedes"], 1), 2) if b["huespedes"] > 0 else 0

        kpis.append(KPIEjecutivo(
            periodo=key,
            revpar=revpar,
            adr=adr,
            ocupacion_pct=ocup,
            goppar=goppar,
            ingresos_totales=round(b["ingresos"], 2),
            habitaciones_vendidas=b["hab_vendidas"],
            habitaciones_disponibles=total_habitaciones,
            total_huespedes=b["huespedes"],
            estancia_media=estancia_media,
            ingresos_por_huesped=ing_por_huesp,
        ))

        total_ingresos += b["ingresos"]
        total_hab_vendidas += b["hab_vendidas"]
        total_huespedes += b["huespedes"]
        total_noches += b["noches_total"]
        total_hab_disp += b["hab_disp_dias"]

    adr_global = round(total_ingresos / max(total_hab_vendidas, 1), 2)
    ocup_global = round((total_hab_vendidas / max(total_hab_disp, 1)) * 100, 1)
    revpar_global = round(adr_global * ocup_global / 100, 2)
    goppar_global = round(revpar_global * 0.7, 2)
    estancia_media_global = round(total_noches / max(total_hab_vendidas, 1), 1)
    ing_por_huesp_global = round(total_ingresos / max(total_huespedes, 1), 2)

    resumen = {
        "revpar": revpar_global,
        "adr": adr_global,
        "ocupacion_pct": ocup_global,
        "goppar": goppar_global,
        "ingresos_totales": round(total_ingresos, 2),
        "habitaciones_vendidas": total_hab_vendidas,
        "habitaciones_disponibles": total_habitaciones,
        "total_huespedes": total_huespedes,
        "estancia_media": estancia_media_global,
        "ingresos_por_huesped": ing_por_huesp_global,
    }

    return ReporteEjecutivo(
        desde=desde,
        hasta=hasta,
        kpis=kpis,
        resumen=resumen,
    )


# ===== EXPORTAR PARA NUEVOS REPORTES FASE 3 =====

def _exportar_generico(tipo: str, formato: str, desde: date, hasta: date, db: Session, _: Usuario):
    # Primero obtener los datos y columnas según el tipo
    if tipo == "cuentas-por-cobrar":
        reporte = reporte_cuentas_por_cobrar(hasta=hasta, db=db, _=_ )
        datos = [item.model_dump() for item in reporte.items]
        columnas = COLUMNAS_CUENTAS_COBRAR
        titulo = "Cuentas por Cobrar (Aging)"
        subtitulo = f"Al {hasta.strftime('%d/%m/%Y')}"
    elif tipo == "housekeeping":
        reporte = reporte_housekeeping(fecha=hasta, db=db, _=_ )
        datos = [item.model_dump() for item in reporte.productividad_por_camarera]
        columnas = COLUMNAS_HOUSEKEEPING
        titulo = "Productividad Housekeeping"
        subtitulo = f"Fecha: {hasta.strftime('%d/%m/%Y')}"
    elif tipo == "ingresos-detallado":
        reporte = reporte_ingresos_detallado(desde=desde, hasta=hasta, db=db, _=_ )
        if formato == "xlsx":
            wb = Workbook()
            ws1 = wb.active
            ws1.title = "Por Canal"
            _escribir_hoja_excel(ws1, [item.model_dump() for item in reporte.por_canal], COLUMNAS_CANAL, "Ingresos por Canal")
            ws2 = wb.create_sheet("Por Tipo Habitación")
            _escribir_hoja_excel(ws2, [item.model_dump() for item in reporte.por_tipo_habitacion], COLUMNAS_TIPO_HAB, "Ingresos por Tipo Habitación")
            output = BytesIO()
            wb.save(output)
            contenido = output.getvalue()
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            extension = "xlsx"
        else:
            from reportlab.platypus import PageBreak
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4)
            styles = getSampleStyleSheet()
            elementos = []
            titulo_pdf = "Ingresos Detallados"
            sub = f"Período: {desde.strftime('%d/%m/%Y')} - {hasta.strftime('%d/%m/%Y')}"
            elementos.append(Paragraph("Ingresos Detallados", styles["Title"]))
            elementos.append(Paragraph(sub, styles["Normal"]))
            elementos.append(Paragraph("<br/>", styles["Normal"]))
            datos_canal = [[col["header"] for col in COLUMNAS_CANAL]] + [[str(item.get(col["key"], "")) for col in COLUMNAS_CANAL] for item in [i.model_dump() for i in reporte.por_canal]]
            tabla1 = Table(datos_canal)
            tabla1.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
            ]))
            elementos.append(Paragraph("Ingresos por Canal", styles["Heading2"]))
            elementos.append(tabla1)
            elementos.append(PageBreak())
            datos_tipo = [[col["header"] for col in COLUMNAS_TIPO_HAB]] + [[str(item.get(col["key"], "")) for col in COLUMNAS_TIPO_HAB] for item in [i.model_dump() for i in reporte.por_tipo_habitacion]]
            tabla2 = Table(datos_tipo)
            tabla2.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F4F6")]),
            ]))
            elementos.append(Paragraph("Ingresos por Tipo Habitación", styles["Heading2"]))
            elementos.append(tabla2)
            doc = SimpleDocTemplate(buffer, pagesize=A4)
            doc.build(elementos)
            contenido = buffer.getvalue()
            media_type = "application/pdf"
            extension = "pdf"
        return StreamingResponse(
            BytesIO(contenido),
            media_type=media_type,
            headers={"Content-Disposition": f'attachment; filename="ingresos_detallado_{desde.strftime("%Y%m%d")}_{hasta.strftime("%Y%m%d")}.{extension}"'},
        )
    elif tipo == "forecast":
        reporte = reporte_forecast(desde=desde, hasta=hasta, db=db, _=_ )
        datos = [item.model_dump() for item in reporte.items]
        columnas = COLUMNAS_FORECAST
        titulo = "Forecast de Ocupación e Ingresos"
        subtitulo = f"Período: {desde.strftime('%d/%m/%Y')} - {hasta.strftime('%d/%m/%Y')}"
    elif tipo == "libro-huespedes":
        reporte = reporte_libro_huespedes(desde=desde, hasta=hasta, db=db, _=_ )
        datos = [item.model_dump() for item in reporte.items]
        columnas = COLUMNAS_LIBRO_HUESPEDES
        titulo = "Libro de Huéspedes"
        subtitulo = f"Período: {desde.strftime('%d/%m/%Y')} - {hasta.strftime('%d/%m/%Y')}"
    elif tipo == "impuestos-turisticos":
        reporte = reporte_impuestos_turisticos(desde=desde, hasta=hasta, db=db, _=_ )
        datos = [item.model_dump() for item in reporte.items]
        columnas = COLUMNAS_IMPUESTOS_TURISTICOS
        titulo = "Impuestos Turísticos"
        subtitulo = f"Período: {desde.strftime('%d/%m/%Y')} - {hasta.strftime('%d/%m/%Y')}"
    elif tipo == "ventas":
        reporte = reporte_ventas(desde=desde, hasta=hasta, db=db, _=_ )
        datos = reporte.items
        columnas = COLUMNAS_VENTAS
        titulo = "Reporte de Ventas"
        subtitulo = f"Período: {desde.strftime('%d/%m/%Y')} - {hasta.strftime('%d/%m/%Y')}"
    elif tipo == "conciliacion-caja":
        reporte = reporte_conciliacion_caja(desde=desde, hasta=hasta, db=db, _=_ )
        datos = [item.model_dump() for item in reporte.items]
        columnas = COLUMNAS_CONCILIACION_CAJA
        titulo = "Conciliación de Caja"
        subtitulo = f"Período: {desde.strftime('%d/%m/%Y')} - {hasta.strftime('%d/%m/%Y')}"
    elif tipo == "ejecutivo":
        reporte = reporte_ejecutivo(desde=desde, hasta=hasta, db=db, _=_ )
        datos = [item.model_dump() for item in reporte.kpis]
        columnas = COLUMNAS_EJECUTIVO
        titulo = "Dashboard Ejecutivo KPIs"
        subtitulo = f"Período: {desde.strftime('%d/%m/%Y')} - {hasta.strftime('%d/%m/%Y')}"
    else:
        raise HTTPException(status_code=400, detail="Tipo de reporte no válido")

    # Generar archivo
    if formato == "xlsx":
        contenido = exportar_excel(datos, columnas, titulo)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        extension = "xlsx"
    else:
        contenido = exportar_pdf(datos, columnas, titulo, subtitulo)
        media_type = "application/pdf"
        extension = "pdf"

    filename = f"{tipo}_{datetime.now().strftime('%Y%m%d')}.{extension}"
    return StreamingResponse(
        BytesIO(contenido),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _escribir_hoja_excel(ws, datos, columnas, titulo):
    ws.title = titulo[:31]
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(columnas))
    cell_titulo = ws.cell(row=1, column=1, value=titulo)
    cell_titulo.font = Font(bold=True, size=14)
    cell_titulo.alignment = Alignment(horizontal="center")
    ws.row_dimensions[1].height = 30
    for col_idx, col in enumerate(columnas, 1):
        cell = ws.cell(row=2, column=col_idx, value=col["header"])
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = HEADER_ALIGN
        cell.border = THIN_BORDER
        if "width" in col:
            ws.column_dimensions[cell.column_letter].width = col["width"]
    for row_idx, fila in enumerate(datos, 3):
        for col_idx, col in enumerate(columnas, 1):
            valor = _normalizar_valor(fila.get(col["key"], ""))
            cell = ws.cell(row=row_idx, column=col_idx, value=valor)
            cell.alignment = DATA_ALIGN
            cell.border = THIN_BORDER
            if isinstance(valor, float):
                cell.number_format = "#,##0.00"
    ws.auto_filter.ref = f"A2:{ws.cell(row=2, column=len(columnas)).coordinate}"


@router.get("/exportar", dependencies=[Depends(ReportesModulo)])
def exportar_reporte(
    tipo: str = Query(...),
    formato: str = Query("xlsx"),
    desde: date = Query(...),
    hasta: date = Query(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(GerenteUsuario),
):
    return _exportar_generico(tipo, formato, desde, hasta, db, _)
