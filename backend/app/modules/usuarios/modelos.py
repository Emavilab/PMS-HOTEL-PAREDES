import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    usuario: Mapped[str] = mapped_column(String(100), unique=True, nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    contrasena: Mapped[str] = mapped_column("password", String(255), nullable=False)
    nombre_completo: Mapped[str] = mapped_column(String(255), nullable=False)
    telefono: Mapped[str] = mapped_column(String(50), nullable=True)
    rol: Mapped[str] = mapped_column(String(50), nullable=False, default="recepcionista")
    estado: Mapped[str] = mapped_column(String(50), nullable=False, default="activo")
    es_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)
    permisos: Mapped[str] = mapped_column(Text, nullable=True, default="[]")
    ultimo_acceso: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        "updated_at", DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    reservas = relationship("Reserva", back_populates="creador")
    registros_auditoria = relationship("RegistroAuditoria", back_populates="usuario")
