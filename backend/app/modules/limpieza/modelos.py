import uuid
from datetime import datetime, date, timezone
from sqlalchemy import Column, String, Text, Integer, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class TareaLimpieza(Base):
    __tablename__ = "tareas_limpieza"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    habitacion_id: Mapped[str] = mapped_column(String, ForeignKey("habitaciones.id"), nullable=False)
    asignada_a: Mapped[str] = mapped_column(String, ForeignKey("usuarios.id"), nullable=True)
    fecha_tarea: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    prioridad: Mapped[str] = mapped_column(String(50), nullable=False, default="normal")
    estado: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDIENTE")
    notas: Mapped[str] = mapped_column(Text, nullable=True)
    iniciada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    completada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        "updated_at", DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    habitacion = relationship("Habitacion", back_populates="tareas_limpieza")
