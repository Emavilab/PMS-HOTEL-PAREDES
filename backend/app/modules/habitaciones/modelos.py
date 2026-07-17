import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Float, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class TipoHabitacion(Base):
    __tablename__ = "tipos_habitacion"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    codigo: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=True)
    capacidad_base: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    capacidad_maxima: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    precio_base: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    comodidades: Mapped[str] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column(String(50), nullable=False, default="activo")
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        "updated_at", DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    habitaciones = relationship("Habitacion", back_populates="tipo_habitacion")
    reservas = relationship("Reserva", back_populates="tipo_habitacion_ref")


class Habitacion(Base):
    __tablename__ = "habitaciones"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tipo_habitacion_id: Mapped[str] = mapped_column(String, ForeignKey("tipos_habitacion.id"), nullable=False)
    numero: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    piso: Mapped[str] = mapped_column(String(10), nullable=True)
    estado_operativo: Mapped[str] = mapped_column(
        "operational_status", String(50), nullable=False, default="DISPONIBLE"
    )
    estado_limpieza: Mapped[str] = mapped_column(
        "housekeeping_status", String(50), nullable=False, default="LIMPIA"
    )
    notas: Mapped[str] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        "updated_at", DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    tipo_habitacion = relationship("TipoHabitacion", back_populates="habitaciones")
    reservas = relationship("Reserva", back_populates="habitacion_ref")
    tareas_limpieza = relationship("TareaLimpieza", back_populates="habitacion")
