import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class HotelConfig(Base):
    __tablename__ = "configuracion"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre: Mapped[str] = mapped_column(String(255), nullable=False, default="Hotel Paredes")
    direccion: Mapped[str] = mapped_column(Text, nullable=True, default="")
    telefono: Mapped[str] = mapped_column(String(50), nullable=True, default="")
    email: Mapped[str] = mapped_column(String(255), nullable=True, default="")
    rtn: Mapped[str] = mapped_column(String(50), nullable=True, default="")
    impuesto: Mapped[float] = mapped_column(Float, nullable=False, default=15.0)
    impuesto_turistico: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    moneda: Mapped[str] = mapped_column(String(10), nullable=False, default="HNL")
    logo_url: Mapped[str] = mapped_column(String(500), nullable=True, default="")
    login_fondo_url: Mapped[str] = mapped_column(String(500), nullable=True, default="")
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        "updated_at", DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
