from datetime import date, datetime, timezone
from typing import Optional
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.dependencies import PersonalUsuario, AdminUsuario, VentasModulo
from app.common.auditoria import crear_registro_auditoria
from app.modules.ventas.modelos import Producto, Consumo, VentaParticular, CategoriaProducto
from app.modules.ventas.esquemas import (
    ProductoCrear, ProductoActualizar, ProductoResponse,
    ConsumoCrear, ConsumoResponse, VerificacionSalidaResponse,
    VentaParticularCrear, VentaParticularResponse,
    CategoriaProductoCrear, CategoriaProductoActualizar, CategoriaProductoResponse,
)
from app.modules.reservas.modelos import Reserva
from app.modules.facturacion.modelos import Pago, Factura
from app.modules.estadias.modelos import Estadia
from app.modules.habitaciones.modelos import Habitacion
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/ventas", tags=["Ventas"])


@router.get("/categorias", response_model=list[CategoriaProductoResponse], dependencies=[Depends(VentasModulo)])
def listar_categorias_productos(
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    return db.query(CategoriaProducto).filter(CategoriaProducto.activo == True).order_by(CategoriaProducto.nombre).all()


@router.get("/categorias/todas", response_model=list[CategoriaProductoResponse], dependencies=[Depends(VentasModulo)])
def listar_todas_categorias_productos(
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    return db.query(CategoriaProducto).order_by(CategoriaProducto.nombre).all()


@router.post("/categorias", response_model=CategoriaProductoResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(VentasModulo)])
def crear_categoria_producto(
    datos: CategoriaProductoCrear,
    db: Session = Depends(get_db),
    _: Usuario = Depends(AdminUsuario),
):
    nombre = datos.nombre.strip()
    if db.query(CategoriaProducto).filter(CategoriaProducto.nombre.ilike(nombre)).first():
        raise HTTPException(status_code=400, detail="La categoría ya existe")
    categoria = CategoriaProducto(nombre=nombre, descripcion=datos.descripcion, activo=datos.activo)
    db.add(categoria)
    db.commit()
    db.refresh(categoria)
    crear_registro_auditoria(db, usuario_actual.id, "CREAR", "CATEGORIA_PRODUCTO", categoria.id, None, datos.model_dump())
    return categoria


@router.put("/categorias/{categoria_id}", response_model=CategoriaProductoResponse, dependencies=[Depends(VentasModulo)])
def actualizar_categoria_producto(
    categoria_id: str,
    datos: CategoriaProductoActualizar,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    categoria = db.query(CategoriaProducto).filter(CategoriaProducto.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    cambios = datos.model_dump(exclude_unset=True)
    anteriores = {campo: getattr(categoria, campo) for campo in cambios}
    if "nombre" in cambios:
        cambios["nombre"] = cambios["nombre"].strip()
        existe = db.query(CategoriaProducto).filter(CategoriaProducto.nombre.ilike(cambios["nombre"]), CategoriaProducto.id != categoria_id).first()
        if existe:
            raise HTTPException(status_code=400, detail="La categoría ya existe")
    for campo, valor in cambios.items():
        setattr(categoria, campo, valor)
    db.commit()
    db.refresh(categoria)
    crear_registro_auditoria(db, usuario_actual.id, "ACTUALIZAR", "CATEGORIA_PRODUCTO", categoria.id, anteriores, cambios)
    return categoria


@router.delete("/categorias/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(VentasModulo)])
def eliminar_categoria_producto(
    categoria_id: str,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(AdminUsuario),
):
    categoria = db.query(CategoriaProducto).filter(CategoriaProducto.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    categoria.activo = False
    db.commit()
    crear_registro_auditoria(db, usuario_actual.id, "DESACTIVAR", "CATEGORIA_PRODUCTO", categoria.id, {"activo": True}, {"activo": False})


@router.post("/particulares", response_model=VentaParticularResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(VentasModulo)])
def crear_venta_particular(
    datos: VentaParticularCrear,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    if not datos.items:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos un producto")

    items = []
    subtotal = 0.0
    for item in datos.items:
        producto = db.query(Producto).filter(Producto.id == item.get("producto_id"), Producto.estado == "activo").first()
        cantidad = int(item.get("cantidad", 0))
        if not producto or cantidad < 1:
            raise HTTPException(status_code=400, detail="Producto o cantidad no validos")
        total_item = round(float(producto.precio_unitario) * cantidad, 2)
        subtotal += total_item
        items.append({
            "producto_id": producto.id,
            "nombre": producto.nombre,
            "cantidad": cantidad,
            "precio_unitario": float(producto.precio_unitario),
            "total": total_item,
        })

    subtotal = round(subtotal, 2)
    es_efectivo = datos.metodo_pago.strip().lower() == "efectivo"
    recibido = round(float(datos.efectivo_recibido), 2) if es_efectivo and datos.efectivo_recibido is not None else subtotal
    cambio = round(recibido - subtotal, 2) if es_efectivo else 0
    if es_efectivo and datos.efectivo_recibido is None:
        raise HTTPException(status_code=400, detail="Indique el dinero recibido")
    if es_efectivo and cambio < 0:
        raise HTTPException(status_code=400, detail="El dinero recibido no cubre el total")

    venta = VentaParticular(
        numero=f"VP-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:4].upper()}",
        cliente_nombre=datos.cliente_nombre.strip() or "Cliente particular",
        items=json.dumps(items),
        subtotal=subtotal,
        total=subtotal,
        metodo_pago=datos.metodo_pago,
        efectivo_recibido=recibido,
        cambio=cambio,
        creado_por=usuario_actual.id,
    )
    db.add(venta)
    db.commit()
    db.refresh(venta)
    crear_registro_auditoria(db, usuario_actual.id, "CREAR", "VENTA_PARTICULAR", venta.id, None, {"numero": venta.numero, "total": venta.total, "metodo_pago": venta.metodo_pago, "items": items})
    return {
        "id": venta.id,
        "numero": venta.numero,
        "cliente_nombre": venta.cliente_nombre,
        "items": items,
        "subtotal": venta.subtotal,
        "total": venta.total,
        "metodo_pago": venta.metodo_pago,
        "efectivo_recibido": venta.efectivo_recibido,
        "cambio": venta.cambio,
        "creado_en": venta.creado_en,
    }


@router.get("/productos", response_model=list[ProductoResponse], dependencies=[Depends(VentasModulo)])
def listar_productos(
    categoria: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    consulta = db.query(Producto).filter(Producto.estado == "activo")
    if categoria:
        consulta = consulta.filter(Producto.categoria == categoria)
    return consulta.order_by(Producto.nombre).all()


@router.post("/productos", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(VentasModulo)])
def crear_producto(
    datos: ProductoCrear,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    producto = Producto(**datos.model_dump())
    db.add(producto)
    db.commit()
    db.refresh(producto)
    crear_registro_auditoria(db, usuario_actual.id, "CREAR", "PRODUCTO", producto.id, None, datos.model_dump())
    return producto


@router.put("/productos/{producto_id}", response_model=ProductoResponse, dependencies=[Depends(VentasModulo)])
def actualizar_producto(
    producto_id: str,
    datos: ProductoActualizar,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    cambios = datos.model_dump(exclude_unset=True)
    anteriores = {key: getattr(producto, key) for key in cambios}
    for key, val in cambios.items():
        setattr(producto, key, val)
    db.commit()
    db.refresh(producto)
    crear_registro_auditoria(db, usuario_actual.id, "ACTUALIZAR", "PRODUCTO", producto.id, anteriores, cambios)
    return producto


@router.delete("/productos/{producto_id}", status_code=204, dependencies=[Depends(VentasModulo)])
def eliminar_producto(
    producto_id: str,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    producto.estado = "inactivo"
    db.commit()
    crear_registro_auditoria(db, usuario_actual.id, "DESACTIVAR", "PRODUCTO", producto.id, {"estado": "activo"}, {"estado": "inactivo"})


@router.get("/ocupadas", response_model=list[dict], dependencies=[Depends(VentasModulo)])
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
            "piso": r.habitacion_ref.piso.nombre if r.habitacion_ref and r.habitacion_ref.piso else None,
            "fecha_entrada": str(r.fecha_entrada),
            "fecha_salida": str(r.fecha_salida),
            "adultos": r.adultos,
            "ninos": r.ninos,
            "total": r.total,
            "tiene_vehiculo": r.tiene_vehiculo,
            "detalle_vehiculo": r.detalle_vehiculo,
            "telefono_huesped": r.huesped.telefono if r.huesped else None,
        })
    return resultado


@router.get("/habitaciones/{habitacion_id}/ocupacion", response_model=dict, dependencies=[Depends(VentasModulo)])
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
            "piso": habitacion.piso.nombre if habitacion and habitacion.piso else None,
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


@router.post("/reservas/{reserva_id}/consumos", response_model=list[ConsumoResponse], status_code=201, dependencies=[Depends(VentasModulo)])
def agregar_consumos(
    reserva_id: str,
    datos: list[ConsumoCrear],
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    creados = []
    total_pagado_ahora = 0.0
    metodo_pago = next((item.metodo_pago for item in datos if item.pagado and item.metodo_pago), None)
    efectivo_recibido = next((item.efectivo_recibido for item in datos if item.pagado and item.efectivo_recibido is not None), None)
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
        if item.pagado:
            total_pagado_ahora += total

    if total_pagado_ahora > 0:
        metodo_pago = metodo_pago or "Efectivo"
        if metodo_pago.strip().lower() == "efectivo":
            recibido = float(efectivo_recibido) if efectivo_recibido is not None else total_pagado_ahora
            if recibido < total_pagado_ahora:
                raise HTTPException(status_code=400, detail="El dinero recibido no cubre el total del consumo")
        db.add(Pago(
            reserva_id=reserva_id,
            monto=round(total_pagado_ahora, 2),
            metodo_pago=metodo_pago,
            referencia="Consumo pagado en Ventas",
            recibido_por=usuario_actual.id,
        ))

    db.commit()
    for c in creados:
        db.refresh(c)
    crear_registro_auditoria(
        db,
        usuario_actual.id,
        "CREAR",
        "CONSUMO",
        reserva_id,
        None,
        {
            "consumos": [{"id": c.id, "producto_id": c.producto_id, "cantidad": c.cantidad, "total": c.total} for c in creados],
            "total_pagado": round(total_pagado_ahora, 2),
            "metodo_pago": metodo_pago,
        },
    )
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


@router.get("/reservas/{reserva_id}/consumos", response_model=list[ConsumoResponse], dependencies=[Depends(VentasModulo)])
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


@router.get("/reservas/{reserva_id}/verificar-salida", response_model=VerificacionSalidaResponse, dependencies=[Depends(VentasModulo)])
def verificar_salida(
    reserva_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.estado != "CHECKED_IN":
        raise HTTPException(status_code=400, detail=f"La reserva está en estado {reserva.estado}; no tiene una estadía activa")

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


@router.post("/reservas/{reserva_id}/culminar-salida", dependencies=[Depends(VentasModulo)])
def culminar_salida(
    reserva_id: str,
    metodo_pago: str = Query(...),
    efectivo_recibido: float | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(PersonalUsuario),
):
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.estado != "CHECKED_IN":
        raise HTTPException(status_code=400, detail=f"La reserva está en estado {reserva.estado}")

    consumos_pendientes = db.query(Consumo).filter(
        Consumo.reserva_id == reserva_id, Consumo.pagado == False
    ).all()
    consumos = db.query(Consumo).filter(Consumo.reserva_id == reserva_id).all()
    consumos_pagados_previamente = sum(c.total for c in consumos if c.pagado)

    for c in consumos_pendientes:
        c.pagado = True

    total_consumos_pendientes = sum(c.total for c in consumos_pendientes)
    total_consumos = sum(c.total for c in consumos)

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
    es_efectivo = metodo_pago.strip().lower() == "efectivo"
    monto_recibido = round(float(efectivo_recibido), 2) if es_efectivo and efectivo_recibido is not None else (round(float(saldo), 2) if saldo > 0 else 0)
    cambio = round(monto_recibido - float(saldo), 2) if es_efectivo and saldo > 0 else 0
    if es_efectivo and saldo > 0 and efectivo_recibido is None:
        raise HTTPException(status_code=400, detail="Debe indicar el dinero recibido en efectivo")
    if es_efectivo and cambio < 0:
        raise HTTPException(status_code=400, detail="El dinero recibido no cubre el total a pagar")
    pago_checkout = None
    if saldo > 0:
        pago = Pago(
            reserva_id=reserva_id,
            monto=saldo,
            metodo_pago=metodo_pago,
            referencia=f"Check-out - {metodo_pago}",
            recibido_por=usuario_actual.id,
        )
        db.add(pago)
        pago_checkout = pago

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
    if pago_checkout:
        db.refresh(pago_checkout)

    pagos = db.query(Pago).filter(Pago.reserva_id == reserva_id).order_by(Pago.pagado_en).all()
    total_pagado = sum(p.monto for p in pagos)
    total_factura = (reserva.total or 0) + total_consumos + mora
    total_cubierto = float(total_pagado) + float(consumos_pagados_previamente)
    saldo_final = total_factura - total_cubierto
    if saldo_final < 0:
        saldo_final = 0

    huesped = reserva.huesped
    habitacion = reserva.habitacion_ref
    precio_noche = round((reserva.subtotal or 0) / noches, 2) if noches > 0 else 0
    factura = {
        "numero": f"FAC-{reserva.codigo_confirmacion}",
        "fecha": datetime.now(timezone.utc).isoformat(),
        "reserva_id": reserva.id,
        "codigo_confirmacion": reserva.codigo_confirmacion,
        "huesped_nombre": f"{huesped.nombres} {huesped.apellidos}" if huesped else "N/A",
        "huesped_documento": huesped.numero_documento if huesped else None,
        "habitacion_numero": habitacion.numero if habitacion else None,
        "habitacion_tipo": habitacion.tipo_habitacion.nombre if habitacion and habitacion.tipo_habitacion else None,
        "fecha_entrada": str(reserva.fecha_entrada),
        "fecha_salida": str(reserva.fecha_salida),
        "noches": noches,
        "items": [
            {
                "descripcion": f"Hospedaje habitacion {habitacion.numero if habitacion else ''}{f' ({habitacion.tipo_habitacion.nombre})' if habitacion and habitacion.tipo_habitacion else ''}",
                "cantidad": noches,
                "precio_unitario": float(precio_noche),
                "total": float(reserva.subtotal or 0),
            },
            *[
                {
                    "descripcion": f"{c.producto.nombre if c.producto else 'Consumo'} x{c.cantidad}",
                    "cantidad": c.cantidad,
                    "precio_unitario": float(c.precio_unitario),
                    "total": float(c.total),
                }
                for c in consumos
            ],
            *([
                {
                    "descripcion": "Mora/Penalidad por salida tardia",
                    "cantidad": 1,
                    "precio_unitario": float(mora),
                    "total": float(mora),
                }
            ] if mora > 0 else []),
        ],
        "resumen": {
            "subtotal_habitacion": float(reserva.subtotal or 0),
            "descuento": float(reserva.descuento or 0),
            "impuesto": float(reserva.impuesto or 0),
            "total_habitacion": float(reserva.total or 0),
            "total_consumos": float(total_consumos),
            "consumos_pagados_previamente": float(consumos_pagados_previamente),
            "mora_penalidad": float(mora),
            "total_factura": float(total_factura),
            "total_pagado": float(total_pagado),
            "total_cobrado_checkout": float(saldo if saldo > 0 else 0),
            "efectivo_recibido": float(monto_recibido),
            "cambio": float(cambio),
            "saldo": float(saldo_final),
        },
        "pagos": [
            {
                "id": p.id,
                "monto": float(p.monto),
                "metodo_pago": p.metodo_pago,
                "referencia": p.referencia,
                "pagado_en": p.pagado_en.isoformat() if p.pagado_en else None,
            }
            for p in pagos
        ],
    }

    factura_db = Factura(
        reserva_id=reserva_id,
        numero=factura["numero"],
        fecha_emision=datetime.now(timezone.utc),
        datos=json.dumps(factura, default=str),
    )
    db.add(factura_db)
    db.commit()
    db.refresh(factura_db)
    factura["id"] = factura_db.id

    crear_registro_auditoria(
        db=db,
        usuario_id=usuario_actual.id,
        accion="CULMINAR_SALIDA",
        tipo_entidad="RESERVA",
        entidad_id=reserva.id,
        valores_anteriores={"estado": "CHECKED_IN"},
        valores_nuevos={
            "estado": "CHECKED_OUT",
            "factura_id": factura_db.id,
            "factura_numero": factura_db.numero,
            "metodo_pago": metodo_pago,
            "total_factura": float(total_factura),
            "total_pagado": float(total_pagado),
            "saldo_final": float(saldo_final),
            "mora_penalidad": float(mora),
            "consumos_cobrados": float(total_consumos_pendientes),
        },
    )

    return {
        "mensaje": "Salida culminada exitosamente",
        "total_cobrado": float(saldo if saldo > 0 else 0),
        "factura": factura,
    }
