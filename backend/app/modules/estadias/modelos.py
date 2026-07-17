import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Estadia(Base):
    __tablename__ = "estadias"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reserva_id: Mapped[str] = mapped_column(
        String, ForeignKey("reservas.id"), unique=True, nullable=False
    )
    check_in_real: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    check_out_real: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    check_in_realizado_por: Mapped[str] = mapped_column(String, ForeignKey("usuarios.id"), nullable=True)
    check_out_realizado_por: Mapped[str] = mapped_column(String, ForeignKey("usuarios.id"), nullable=True)
    estado: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDIENTE")
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        "updated_at", DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    reserva = relationship("Reserva", back_populates="estadia")
