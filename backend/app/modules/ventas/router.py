from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.dependencies import PersonalUsuario
from app.modules.ventas.modelos import Producto, Consumo
from app.modules.ventas.esquemas import (
    ProductoCrear, ProductoActualizar, ProductoResponse,
    ConsumoCrear, ConsumoResponse, VerificacionSalidaResponse,
)
from app.modules.reservas.modelos import Reserva
from app.modules.facturacion.modelos import Pago
from app.modules.estadias.modelos import Estadia
from app.modules.habitaciones.modelos import Habitacion
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/ventas", tags=["Ventas"])


@router.get("/productos", response_model=list[ProductoResponse])
def listar_productos(
    categoria: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    consulta = db.query(Producto).filter(Producto.estado == "activo")
    if categoria:
        consulta = consulta.filter(Producto.categoria == categoria)
    return consulta.order_by(Producto.nombre).all()


@router.post("/productos", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED)
def crear_producto(
    datos: ProductoCrear,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    producto = Producto(**datos.model_dump())
    db.add(producto)
    db.commit()
    db.refresh(producto)
    return producto


@router.put("/productos/{producto_id}", response_model=ProductoResponse)
def actualizar_producto(
    producto_id: str,
    datos: ProductoActualizar,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    for key, val in datos.model_dump(exclude_unset=True).items():
        setattr(producto, key, val)
    db.commit()
    db.refresh(producto)
    return producto


@router.delete("/productos/{producto_id}", status_code=204)
def eliminar_producto(
    producto_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    producto.estado = "inactivo"
    db.commit()


@router.get("/ocupadas", response_model=list[dict])
def habitaciones_ocupadas(
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    reservas = (
        db.query(Reserva)
        .filter(Reserva.estado == "CHECKED_IN")
        .all()
    )
    resultado = []
    for r in reservas:
        nombre = f"{r.huesped.nombres} {r.huesped.apellidos}" if r.huesped else "N/A"
        num_hab = r.habitacion_ref.numero if r.habitacion_ref else None
        tipo_hab = r.habitacion_ref.tipo_habitacion.nombre if r.habitacion_ref and r.habitacion_ref.tipo_habitacion else None
        resultado.append({
            "reserva_id": r.id,
            "codigo_confirmacion": r.codigo_confirmacion,
            "habitacion_id": r.habitacion_id,
            "huesped": nombre,
            "habitacion_numero": num_hab,
            "habitacion_tipo": tipo_hab,
            "fecha_entrada": str(r.fecha_entrada),
            "fecha_salida": str(r.fecha_salida),
            "adultos": r.adultos,
            "ninos": r.ninos,
            "total": r.total,
            "tiene_vehiculo": r.tiene_vehiculo,
            "detalle_vehiculo": r.detalle_vehiculo,
        })
    return resultado


@router.get("/habitaciones/{habitacion_id}/ocupacion", response_model=dict)
def detalle_ocupacion_habitacion(
    habitacion_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    reserva = (
        db.query(Reserva)
        .filter(Reserva.habitacion_id == habitacion_id, Reserva.estado == "CHECKED_IN")
        .first()
    )
    if not reserva:
        raise HTTPException(status_code=404, detail="La habitacion no tiene una estadia activa")

    huesped = reserva.huesped
    habitacion = reserva.habitacion_ref
    estadia = reserva.estadia

    return {
        "reserva_id": reserva.id,
        "codigo_confirmacion": reserva.codigo_confirmacion,
        "estado": reserva.estado,
        "fecha_entrada": str(reserva.fecha_entrada),
        "fecha_salida": str(reserva.fecha_salida),
        "adultos": reserva.adultos,
        "ninos": reserva.ninos,
        "subtotal": reserva.subtotal,
        "descuento": reserva.descuento,
        "impuesto": reserva.impuesto,
        "total": reserva.total,
        "tiene_vehiculo": reserva.tiene_vehiculo,
        "detalle_vehiculo": reserva.detalle_vehiculo,
        "check_in_real": estadia.check_in_real.isoformat() if estadia and estadia.check_in_real else None,
        "habitacion": {
            "id": habitacion.id if habitacion else None,
            "numero": habitacion.numero if habitacion else None,
            "piso": habitacion.piso if habitacion else None,
            "tipo": habitacion.tipo_habitacion.nombre if habitacion and habitacion.tipo_habitacion else None,
            "estado_limpieza": habitacion.estado_limpieza if habitacion else None,
        },
        "huesped": {
            "id": huesped.id if huesped else None,
            "nombre": f"{huesped.nombres} {huesped.apellidos}" if huesped else "N/A",
            "tipo_documento": huesped.tipo_documento if huesped else None,
            "numero_documento": huesped.numero_documento if huesped else None,
            "telefono": huesped.telefono if huesped else None,
            "email": huesped.email if huesped else None,
            "nacionalidad": huesped.nacionalidad if huesped else None,
            "direccion": huesped.direccion if huesped else None,
        },
    }


@router.post("/reservas/{reserva_id}/consumos", response_model=list[ConsumoResponse], status_code=201)
def agregar_consumos(
    reserva_id: str,
    datos: list[ConsumoCrear],
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    creados = []
    for item in datos:
        producto = db.query(Producto).filter(Producto.id == item.producto_id).first()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {item.producto_id} no encontrado")
        total = producto.precio_unitario * item.cantidad
        consumo = Consumo(
            reserva_id=reserva_id,
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_unitario=producto.precio_unitario,
            total=total,
            pagado=item.pagado,
        )
        db.add(consumo)
        creados.append(consumo)

    db.commit()
    for c in creados:
        db.refresh(c)
    return [
        ConsumoResponse(
            id=c.id,
            reserva_id=c.reserva_id,
            producto_id=c.producto_id,
            producto_nombre=c.producto.nombre if c.producto else None,
            cantidad=c.cantidad,
            precio_unitario=c.precio_unitario,
            total=c.total,
            pagado=c.pagado,
            creado_en=c.creado_en,
        )
        for c in creados
    ]


@router.get("/reservas/{reserva_id}/consumos", response_model=list[ConsumoResponse])
def listar_consumos(
    reserva_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    consumos = db.query(Consumo).filter(Consumo.reserva_id == reserva_id).order_by(Consumo.creado_en.desc()).all()
    return [
        ConsumoResponse(
            id=c.id,
            reserva_id=c.reserva_id,
            producto_id=c.producto_id,
            producto_nombre=c.producto.nombre if c.producto else None,
            cantidad=c.cantidad,
            precio_unitario=c.precio_unitario,
            total=c.total,
            pagado=c.pagado,
            creado_en=c.creado_en,
        )
        for c in consumos
    ]


@router.get("/reservas/{reserva_id}/verificar-salida", response_model=VerificacionSalidaResponse)
def verificar_salida(
    reserva_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    noches = (reserva.fecha_salida - reserva.fecha_entrada).days
    hoy = date.today()
    mora = 0
    if hoy > reserva.fecha_salida:
        dias_mora = (hoy - reserva.fecha_salida).days
        mora = round((reserva.subtotal / noches) * 0.5 * dias_mora, 2) if noches > 0 else 0

    consumos = db.query(Consumo).filter(Consumo.reserva_id == reserva_id).all()
    consumos_resp = []
    total_consumos = 0
    total_consumos_pendientes = 0
    for c in consumos:
        total_consumos += c.total
        if not c.pagado:
            total_consumos_pendientes += c.total
        consumos_resp.append(ConsumoResponse(
            id=c.id, reserva_id=c.reserva_id, producto_id=c.producto_id,
            producto_nombre=c.producto.nombre if c.producto else None,
            cantidad=c.cantidad, precio_unitario=c.precio_unitario,
            total=c.total, pagado=c.pagado, creado_en=c.creado_en,
        ))

    total_pagado = db.query(func.coalesce(func.sum(Pago.monto), 0)).filter(
        Pago.reserva_id == reserva_id
    ).scalar() or 0

    total_a_pagar = (reserva.total or 0) + total_consumos_pendientes + mora - float(total_pagado)
    if total_a_pagar < 0:
        total_a_pagar = 0

    nombre = f"{reserva.huesped.nombres} {reserva.huesped.apellidos}" if reserva.huesped else "N/A"
    doc = reserva.huesped.numero_documento if reserva.huesped else None
    num_hab = reserva.habitacion_ref.numero if reserva.habitacion_ref else None
    tipo_hab = reserva.habitacion_ref.tipo_habitacion.nombre if reserva.habitacion_ref and reserva.habitacion_ref.tipo_habitacion else None

    return VerificacionSalidaResponse(
        reserva_id=reserva.id,
        codigo_confirmacion=reserva.codigo_confirmacion,
        huesped_nombre=nombre,
        huesped_documento=doc,
        habitacion_numero=num_hab,
        habitacion_tipo=tipo_hab,
        fecha_entrada=reserva.fecha_entrada,
        fecha_salida=reserva.fecha_salida,
        noches=noches,
        subtotal=reserva.subtotal or 0,
        descuento=reserva.descuento or 0,
        impuesto=reserva.impuesto or 0,
        total_habitacion=reserva.total or 0,
        consumos=consumos_resp,
        total_consumos=total_consumos,
        total_consumos_pendientes=total_consumos_pendientes,
        total_pagado=float(total_pagado),
        mora_penalidad=mora,
        total_a_pagar=total_a_pagar,
    )


@router.post("/reservas/{reserva_id}/culminar-salida")
def culminar_salida(
    reserva_id: str,
    metodo_pago: str = Query(...),
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.estado not in ("CHECKED_IN", "CONFIRMADA"):
        raise HTTPException(status_code=400, detail=f"La reserva está en estado {reserva.estado}")

    consumos_pendientes = db.query(Consumo).filter(
        Consumo.reserva_id == reserva_id, Consumo.pagado == False
    ).all()

    for c in consumos_pendientes:
        c.pagado = True

    total_consumos_pendientes = sum(c.total for c in consumos_pendientes)

    hoy = date.today()
    noches = (reserva.fecha_salida - reserva.fecha_entrada).days
    mora = 0
    if hoy > reserva.fecha_salida:
        dias_mora = (hoy - reserva.fecha_salida).days
        mora = round((reserva.subtotal / noches) * 0.5 * dias_mora, 2) if noches > 0 else 0

    total_pagado = db.query(func.coalesce(func.sum(Pago.monto), 0)).filter(
        Pago.reserva_id == reserva_id
    ).scalar() or 0

    saldo = (reserva.total or 0) + total_consumos_pendientes + mora - float(total_pagado)
    if saldo > 0:
        pago = Pago(
            reserva_id=reserva_id,
            monto=saldo,
            metodo_pago=metodo_pago,
            referencia=f"Check-out - {metodo_pago}",
            recibido_por=usuario_actual.id,
        )
        db.add(pago)

    reserva.estado = "CHECKED_OUT"

    if reserva.habitacion_id:
        habitacion = db.query(Habitacion).filter(Habitacion.id == reserva.habitacion_id).first()
        if habitacion:
            habitacion.estado_operativo = "DISPONIBLE"
            habitacion.estado_limpieza = "SUCIA"

    estadia = db.query(Estadia).filter(Estadia.reserva_id == reserva_id).first()
    if estadia:
        estadia.check_out_real = datetime.now(timezone.utc)
        estadia.check_out_realizado_por = usuario_actual.id
        estadia.estado = "COMPLETADA"

    db.commit()

    return {"mensaje": "Salida culminada exitosamente", "total_cobrado": float(saldo)}
