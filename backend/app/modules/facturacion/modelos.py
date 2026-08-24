import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Cargo(Base):
    __tablename__ = "cargos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reserva_id: Mapped[str] = mapped_column(
        String, ForeignKey("reservas.id"), nullable=False, index=True
    )
    descripcion: Mapped[str] = mapped_column(String(255), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    precio_unitario: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    total: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    fecha_cargo: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    creado_por: Mapped[str] = mapped_column(String, ForeignKey("usuarios.id"), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    reserva = relationship("Reserva", back_populates="cargos")


class Pago(Base):
    __tablename__ = "pagos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reserva_id: Mapped[str] = mapped_column(
        String, ForeignKey("reservas.id"), nullable=False, index=True
    )
    monto: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    metodo_pago: Mapped[str] = mapped_column(String(50), nullable=False)
    referencia: Mapped[str] = mapped_column(String(255), nullable=True)
    estado: Mapped[str] = mapped_column(String(50), nullable=False, default="completado")
    recibido_por: Mapped[str] = mapped_column(String, ForeignKey("usuarios.id"), nullable=False)
    pagado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    reserva = relationship("Reserva", back_populates="pagos")


class Factura(Base):
    __tablename__ = "facturas"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reserva_id: Mapped[str] = mapped_column(
        String, ForeignKey("reservas.id"), nullable=False, index=True
    )
    numero: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    fecha_emision: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    datos: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
