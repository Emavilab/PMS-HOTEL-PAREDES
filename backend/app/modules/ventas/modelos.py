import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Producto(Base):
    __tablename__ = "productos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=True)
    precio_unitario: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    categoria: Mapped[str] = mapped_column(String(100), nullable=True)
    estado: Mapped[str] = mapped_column(String(50), nullable=False, default="activo")
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        "updated_at", DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    consumos = relationship("Consumo", back_populates="producto")


class CategoriaProducto(Base):
    __tablename__ = "categorias_productos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        "updated_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )


class Consumo(Base):
    __tablename__ = "consumos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reserva_id: Mapped[str] = mapped_column(String, ForeignKey("reservas.id"), nullable=False, index=True)
    producto_id: Mapped[str] = mapped_column(String, ForeignKey("productos.id"), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    precio_unitario: Mapped[float] = mapped_column(Float, nullable=False)
    total: Mapped[float] = mapped_column(Float, nullable=False)
    pagado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    producto = relationship("Producto", back_populates="consumos")
    reserva = relationship("Reserva", back_populates="consumos")


class VentaParticular(Base):
    __tablename__ = "ventas_particulares"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    numero: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    cliente_nombre: Mapped[str] = mapped_column(String(255), nullable=False, default="Cliente particular")
    items: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    subtotal: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    total: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    metodo_pago: Mapped[str] = mapped_column(String(50), nullable=False)
    efectivo_recibido: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    cambio: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    creado_por: Mapped[str] = mapped_column(String, ForeignKey("usuarios.id"), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
