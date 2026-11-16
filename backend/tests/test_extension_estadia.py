from datetime import date, timedelta

from app.core.dependencies import PersonalUsuario, ReservasModulo, VentasModulo
from app.modules.configuracion.modelos import HotelConfig
from app.modules.estadias.modelos import Estadia
from app.modules.facturacion.modelos import Cargo, Pago
from app.modules.habitaciones.modelos import Habitacion, Piso, TipoHabitacion
from app.modules.huespedes.modelos import Huesped
from app.modules.reservas.modelos import Reserva
from app.modules.reservas.router import _recalcular_totales
from app.modules.usuarios.modelos import Usuario
from tests.conftest import TestingSessionLocal


def crear_estadia_activa():
    db = TestingSessionLocal()
    usuario = Usuario(
        email="recepcion@test.local",
        contrasena="hash",
        nombre_completo="Recepción",
        rol="recepcionista",
        estado="activo",
    )
    huesped = Huesped(nombres="Ana", apellidos="Paredes")
    tipo = TipoHabitacion(
        codigo="DOBLE-TEST",
        nombre="Doble",
        capacidad_base=1,
        capacidad_maxima=2,
        precio_base=100,
    )
    piso = Piso(nombre="Piso de prueba")
    habitacion = Habitacion(
        tipo_habitacion=tipo,
        piso=piso,
        numero="T-01",
        estado_operativo="OCUPADA",
        estado_limpieza="LIMPIA",
    )
    entrada = date.today()
    salida = entrada + timedelta(days=1)
    reserva = Reserva(
        codigo_confirmacion="RES-TEST-001",
        huesped=huesped,
        tipo_habitacion_ref=tipo,
        habitacion_ref=habitacion,
        creador=usuario,
        fecha_entrada=entrada,
        fecha_salida=salida,
        estado="CHECKED_IN",
        subtotal=100,
        impuesto=15,
        total=115,
    )
    estadia = Estadia(reserva=reserva, estado="ACTIVA")
    db.add_all([usuario, huesped, tipo, habitacion, reserva, estadia])
    db.flush()
    pago = Pago(
        reserva=reserva,
        monto=115,
        metodo_pago="Efectivo",
        recibido_por=usuario.id,
    )
    db.add(pago)
    db.add(HotelConfig(impuesto=15))
    db.commit()
    db.refresh(reserva)
    db.refresh(usuario)
    return db, usuario, reserva


def preparar_cliente(client, usuario):
    client.app.dependency_overrides[PersonalUsuario] = lambda: usuario
    client.app.dependency_overrides[ReservasModulo] = lambda: usuario
    client.app.dependency_overrides[VentasModulo] = lambda: usuario
    return client


def limpiar_override(client):
    client.app.dependency_overrides.pop(PersonalUsuario, None)
    client.app.dependency_overrides.pop(ReservasModulo, None)
    client.app.dependency_overrides.pop(VentasModulo, None)


def test_extender_estadia_conserva_pago_y_actualiza_saldo(client):
    db, usuario, reserva = crear_estadia_activa()
    try:
        respuesta = preparar_cliente(client, usuario).post(
            f"/reservas/{reserva.id}/extender-estadia",
            json={"nueva_fecha_salida": str(reserva.fecha_salida + timedelta(days=2))},
        )

        assert respuesta.status_code == 200
        datos = respuesta.json()
        assert datos["noches_adicionales"] == 2
        assert datos["total_adicional"] == 230
        assert datos["nuevo_total"] == 345
        assert datos["saldo_pendiente"] == 230

        db.expire_all()
        reserva_actualizada = db.get(Reserva, reserva.id)
        assert reserva_actualizada.fecha_salida == date.today() + timedelta(days=3)
        assert db.query(Pago).filter(Pago.reserva_id == reserva.id).count() == 1
        cargo = db.query(Cargo).filter(Cargo.reserva_id == reserva.id).one()
        assert cargo.cantidad == 2
        assert cargo.total == 200
    finally:
        limpiar_override(client)
        db.close()


def test_recalcular_totales_respeta_impuesto_en_cero():
    db, _, reserva = crear_estadia_activa()
    try:
        db.query(HotelConfig).one().impuesto = 0
        _recalcular_totales(db, reserva)

        assert reserva.impuesto == 0
        assert reserva.total == 100
    finally:
        db.close()


def test_extender_estadia_respeta_impuesto_en_cero(client):
    db, usuario, reserva = crear_estadia_activa()
    try:
        config = db.query(HotelConfig).one()
        config.impuesto = 0
        config.impuesto_turistico = 0
        db.commit()
        respuesta = preparar_cliente(client, usuario).post(
            f"/reservas/{reserva.id}/extender-estadia",
            json={"nueva_fecha_salida": str(reserva.fecha_salida + timedelta(days=1))},
        )

        assert respuesta.status_code == 200
        datos = respuesta.json()
        assert datos["total_adicional"] == 100
        assert datos["nuevo_total"] == 215
    finally:
        limpiar_override(client)
        db.close()


def test_verificar_salida_recalcula_impuesto_vigente(client):
    db, usuario, reserva = crear_estadia_activa()
    try:
        db.query(HotelConfig).one().impuesto = 0
        db.commit()
        respuesta = preparar_cliente(client, usuario).get(
            f"/ventas/reservas/{reserva.id}/verificar-salida",
        )

        assert respuesta.status_code == 200
        datos = respuesta.json()
        assert datos["impuesto"] == 0
        assert datos["total_habitacion"] == 100
        assert datos["total_a_pagar"] == 0
    finally:
        limpiar_override(client)
        db.close()


def test_extender_estadia_rechaza_fecha_no_mayor(client):
    db, usuario, reserva = crear_estadia_activa()
    try:
        respuesta = preparar_cliente(client, usuario).post(
            f"/reservas/{reserva.id}/extender-estadia",
            json={"nueva_fecha_salida": str(reserva.fecha_salida)},
        )

        assert respuesta.status_code == 400
        assert "posterior" in respuesta.json()["detail"]
    finally:
        limpiar_override(client)
        db.close()


def test_extender_estadia_rechaza_conflicto_de_habitacion(client):
    db, usuario, reserva = crear_estadia_activa()
    conflicto = Reserva(
        codigo_confirmacion="RES-TEST-002",
        huesped_id=reserva.huesped_id,
        tipo_habitacion_id=reserva.tipo_habitacion_id,
        habitacion_id=reserva.habitacion_id,
        creada_por=usuario.id,
        fecha_entrada=reserva.fecha_salida,
        fecha_salida=reserva.fecha_salida + timedelta(days=1),
        estado="CONFIRMADA",
        subtotal=100,
        impuesto=15,
        total=115,
    )
    db.add(conflicto)
    db.commit()
    try:
        respuesta = preparar_cliente(client, usuario).post(
            f"/reservas/{reserva.id}/extender-estadia",
            json={"nueva_fecha_salida": str(reserva.fecha_salida + timedelta(days=2))},
        )

        assert respuesta.status_code == 409
        assert "disponible" in respuesta.json()["detail"]
    finally:
        limpiar_override(client)
        db.close()
