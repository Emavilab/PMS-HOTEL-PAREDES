import uuid
from datetime import datetime, date, timezone
from sqlalchemy import Column, String, Text, Date, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Huesped(Base):
    __tablename__ = "huespedes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nombres: Mapped[str] = mapped_column(String(255), nullable=False)
    apellidos: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo_documento: Mapped[str] = mapped_column(String(50), nullable=True)
    numero_documento: Mapped[str] = mapped_column(String(100), nullable=True, index=True)
    telefono: Mapped[str] = mapped_column(String(50), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    nacionalidad: Mapped[str] = mapped_column(String(100), nullable=True)
    direccion: Mapped[str] = mapped_column(Text, nullable=True)
    fecha_nacimiento: Mapped[date] = mapped_column(Date, nullable=True)
    notas: Mapped[str] = mapped_column(Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        "updated_at", DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    reservas = relationship("Reserva", back_populates="huesped")
