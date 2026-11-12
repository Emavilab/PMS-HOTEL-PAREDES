from datetime import date

from app.modules.reservas.modelos import Reserva
from app.modules.reservas.router import _tiene_conflicto


def test_detects_overlapping_reservation_for_same_room(db_session):
    reservation = Reserva(
        id="reservation-1",
        codigo_confirmacion="RES-CONFLICT-1",
        huesped_id="guest-1",
        creada_por="user-1",
        habitacion_id="room-1",
        fecha_entrada=date(2026, 11, 12),
        fecha_salida=date(2026, 11, 15),
        estado="CONFIRMADA",
        subtotal=0,
        descuento=0,
        impuesto=0,
        total=0,
    )
    db_session.add(reservation)
    db_session.commit()

    assert _tiene_conflicto(
        db_session,
        date(2026, 11, 14),
        date(2026, 11, 16),
        habitacion_id="room-1",
    )
    assert not _tiene_conflicto(
        db_session,
        date(2026, 11, 15),
        date(2026, 11, 16),
        habitacion_id="room-1",
    )
