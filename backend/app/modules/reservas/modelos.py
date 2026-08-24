import uuid
from datetime import datetime, date, timezone
from sqlalchemy import Column, String, Text, Float, Integer, Date, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Reserva(Base):
    __tablename__ = "reservas"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    codigo_confirmacion: Mapped[str] = mapped_column(
        "confirmation_code", String(50), unique=True, nullable=False, index=True
    )
    huesped_id: Mapped[str] = mapped_column(String, ForeignKey("huespedes.id"), nullable=False)
    tipo_habitacion_id: Mapped[str] = mapped_column(
        String, ForeignKey("tipos_habitacion.id"), nullable=True
    )
    habitacion_id: Mapped[str] = mapped_column(String, ForeignKey("habitaciones.id"), nullable=True)
    creada_por: Mapped[str] = mapped_column(String, ForeignKey("usuarios.id"), nullable=False)
    fecha_entrada: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    fecha_salida: Mapped[date] = mapped_column(Date, nullable=False)
    adultos: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    ninos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estado: Mapped[str] = mapped_column(
        String(50), nullable=False, default="PENDIENTE", index=True
    )
    origen: Mapped[str] = mapped_column(String(100), nullable=True)
    subtotal: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    descuento: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    impuesto: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    total: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    tiene_vehiculo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    detalle_vehiculo: Mapped[str] = mapped_column(Text, nullable=True)
    solicitudes_especiales: Mapped[str] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        "updated_at", DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    huesped = relationship("Huesped", back_populates="reservas")
    tipo_habitacion_ref = relationship("TipoHabitacion", back_populates="reservas")
    habitacion_ref = relationship("Habitacion", back_populates="reservas")
    creador = relationship("Usuario", back_populates="reservas")
    estadia = relationship("Estadia", back_populates="reserva", uselist=False)
    cargos = relationship("Cargo", back_populates="reserva")
    pagos = relationship("Pago", back_populates="reserva")
    consumos = relationship("Consumo", back_populates="reserva")
