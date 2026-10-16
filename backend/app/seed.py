import uuid
from datetime import date, timedelta
from app.core.seguridad import hash_password
from app.core.database import SessionLocal, engine, Base
from app.modules.usuarios.modelos import Usuario
from app.modules.auditoria.modelos import RegistroAuditoria
from app.modules.habitaciones.modelos import TipoHabitacion, Habitacion
from app.modules.huespedes.modelos import Huesped
from app.modules.reservas.modelos import Reserva
from app.modules.estadias.modelos import Estadia
from app.modules.facturacion.modelos import Cargo, Pago
from app.modules.limpieza.modelos import TareaLimpieza
from app.modules.caja.modelos import SesionCaja
from app.modules.configuracion.modelos import HotelConfig
from app.modules.ventas.modelos import Consumo

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(Usuario).first():
        print("La base de datos ya tiene datos. Omitiendo seed.")
        db.close()
        return

    admin = Usuario(
        id=str(uuid.uuid4()),
        usuario="admin",
        email="admin@hotel.com",
        contrasena=hash_password("AdminHotel2026!"),
        nombre_completo="Administrador",
        rol="admin",
        estado="activo",
        es_superadmin=True,
    )
    gerente = Usuario(
        id=str(uuid.uuid4()),
        usuario="gerente",
        email="gerente@hotel.com",
        contrasena=hash_password("GerenteHotel2026!"),
        nombre_completo="Gerente General",
        rol="gerente",
        estado="activo",
    )
    recepcion = Usuario(
        id=str(uuid.uuid4()),
        usuario="recepcion",
        email="recepcion@hotel.com",
        contrasena=hash_password("RecepcionHotel2026!"),
        nombre_completo="Recepcionista",
        rol="recepcionista",
        estado="activo",
    )
    usuarios = [admin, gerente, recepcion]
    db.add_all(usuarios)
    db.flush()

    individual = TipoHabitacion(
        id=str(uuid.uuid4()), codigo="IND", nombre="Individual",
        descripcion="Habitación para una persona", capacidad_base=1, capacidad_maxima=1,
        precio_base=600, comodidades="TV, WiFi, A/C, Baño privado",
    )
    doble = TipoHabitacion(
        id=str(uuid.uuid4()), codigo="DOB", nombre="Doble",
        descripcion="Habitación para dos personas", capacidad_base=2, capacidad_maxima=2,
        precio_base=900, comodidades="TV, WiFi, A/C, Baño privado, Balcón",
    )
    triple = TipoHabitacion(
        id=str(uuid.uuid4()), codigo="TRIP", nombre="Triple",
        descripcion="Habitación para tres personas", capacidad_base=3, capacidad_maxima=3,
        precio_base=1200, comodidades="TV, WiFi, A/C, Baño privado, Balcón, Refrigeradora",
    )
    familiar = TipoHabitacion(
        id=str(uuid.uuid4()), codigo="FAM", nombre="Familiar",
        descripcion="Habitación familiar amplia", capacidad_base=4, capacidad_maxima=5,
        precio_base=1600, comodidades="TV, WiFi, A/C, Baño privado, Balcón, Refrigeradora, Sala",
    )
    tipos_habitacion = [individual, doble, triple, familiar]
    db.add_all(tipos_habitacion)
    db.flush()

    datos_habitaciones = [
        (individual, "101", "1"), (individual, "102", "1"), (individual, "103", "1"),
        (doble, "201", "2"), (doble, "202", "2"), (doble, "203", "2"),
        (triple, "301", "3"), (triple, "302", "3"),
        (familiar, "401", "4"), (familiar, "402", "4"),
    ]
    habitaciones = []
    for tipo, num, piso in datos_habitaciones:
        habitaciones.append(Habitacion(
            tipo_habitacion_id=tipo.id, numero=num, piso=piso,
            estado_operativo="DISPONIBLE", estado_limpieza="LIMPIA",
        ))
    db.add_all(habitaciones)
    db.flush()

    datos_huespedes = [
        ("Juan", "Pérez", "DNI", "0801-1990-12345", "juan@email.com", "+504 9999-0001"),
        ("María", "García", "DNI", "0801-1992-67890", "maria@email.com", "+504 9999-0002"),
        ("Carlos", "López", "Pasaporte", "AB123456", "carlos@email.com", "+504 9999-0003"),
        ("Ana", "Martínez", "DNI", "0801-1988-11111", "ana@email.com", "+504 9999-0004"),
        ("Pedro", "Ramírez", "DNI", "0801-1995-22222", "pedro@email.com", "+504 9999-0005"),
    ]
    huespedes = []
    for nom, ape, td, nd, em, tel in datos_huespedes:
        huespedes.append(Huesped(nombres=nom, apellidos=ape, tipo_documento=td, numero_documento=nd, email=em, telefono=tel))
    db.add_all(huespedes)
    db.flush()

    hoy = date.today()
    datos_reservas = [
        (huespedes[0], doble, habitaciones[3], hoy, hoy + timedelta(days=2), "CONFIRMADA", 2, 0, 900, 0, 135, 1035),
        (huespedes[1], individual, habitaciones[0], hoy, hoy + timedelta(days=1), "CHECKED_IN", 1, 0, 600, 0, 90, 690),
        (huespedes[2], triple, habitaciones[6], hoy + timedelta(days=1), hoy + timedelta(days=4), "PENDIENTE", 3, 0, 1200, 0, 180, 1380),
        (huespedes[3], familiar, habitaciones[8], hoy + timedelta(days=2), hoy + timedelta(days=5), "PENDIENTE", 2, 2, 1600, 0, 240, 1840),
        (huespedes[4], doble, habitaciones[4], hoy - timedelta(days=3), hoy, "CHECKED_OUT", 2, 0, 900, 0, 135, 1035),
    ]
    reservas = []
    for huesped, tipo, hab, entrada, salida, est, ad, nin, sub, desc, imp, tot in datos_reservas:
        res = Reserva(
            codigo_confirmacion=f"RES-{uuid.uuid4().hex[:8].upper()}",
            huesped_id=huesped.id, tipo_habitacion_id=tipo.id, habitacion_id=hab.id,
            creada_por=recepcion.id, fecha_entrada=entrada, fecha_salida=salida,
            adultos=ad, ninos=nin, estado=est, origen="Walk-in",
            subtotal=sub, descuento=desc, impuesto=imp, total=tot,
        )
        reservas.append(res)
    db.add_all(reservas)
    db.flush()

    estadias_data = [
        (reservas[1], recepcion.id, None),
        (reservas[4], recepcion.id, gerente.id),
    ]
    for res, check_in_por, check_out_por in estadias_data:
        db.add(Estadia(
            reserva_id=res.id,
            check_in_real=res.fecha_entrada,
            check_out_real=None if not check_out_por else res.fecha_salida,
            check_in_realizado_por=check_in_por,
            check_out_realizado_por=check_out_por,
            estado="ACTIVA" if not check_out_por else "COMPLETADA",
        ))

    db.flush()

    for res in reservas[:4]:
        db.add(Cargo(
            reserva_id=res.id, descripcion="Alojamiento",
            cantidad=1, precio_unitario=res.total, total=res.total,
            creado_por=recepcion.id,
        ))

    db.add(Pago(
        reserva_id=reservas[4].id, monto=1035,
        metodo_pago="Efectivo", referencia="PAG-001",
        recibido_por=recepcion.id,
    ))

    for i, habitacion in enumerate(habitaciones[:3]):
        db.add(TareaLimpieza(
            habitacion_id=habitacion.id, asignada_a=recepcion.id,
            fecha_tarea=hoy, prioridad="alta" if i == 0 else "normal",
            estado="PENDIENTE", notas="Limpieza general",
        ))

    db.add(SesionCaja(
        usuario_id=recepcion.id, monto_apertura=500,
        estado="ABIERTA",
    ))

    db.add(HotelConfig(
        nombre="Hotel Paredes",
        direccion="",
        telefono="",
        email="",
        rtn="",
        impuesto=15.0,
        moneda="HNL",
    ))

    db.commit()
    db.close()
    print("Base de datos creada exitosamente!")
    print("Credenciales iniciales: consulta README.md y cambia estas contraseñas al ingresar.")


if __name__ == "__main__":
    seed()
