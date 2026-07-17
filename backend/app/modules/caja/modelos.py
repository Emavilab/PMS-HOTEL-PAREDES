import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class SesionCaja(Base):
    __tablename__ = "sesiones_caja"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    usuario_id: Mapped[str] = mapped_column(String, ForeignKey("usuarios.id"), nullable=False)
    monto_apertura: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    monto_esperado: Mapped[float] = mapped_column(Float, nullable=True)
    monto_declarado: Mapped[float] = mapped_column(Float, nullable=True)
    diferencia: Mapped[float] = mapped_column(Float, nullable=True)
    abierta_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    cerrada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    estado: Mapped[str] = mapped_column(String(50), nullable=False, default="ABIERTA")
