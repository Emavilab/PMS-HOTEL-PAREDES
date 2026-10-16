import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class RegistroAuditoria(Base):
    __tablename__ = "registros_auditoria"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    usuario_id: Mapped[str] = mapped_column(String, ForeignKey("usuarios.id"), nullable=True)
    accion: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    tipo_entidad: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entidad_id: Mapped[str] = mapped_column(String, nullable=True)
    valores_anteriores: Mapped[str] = mapped_column(Text, nullable=True)
    valores_nuevos: Mapped[str] = mapped_column(Text, nullable=True)
    direccion_ip: Mapped[str] = mapped_column(String(50), nullable=True)
    nombre_usuario: Mapped[str] = mapped_column(String(255), nullable=True)
    rol_usuario: Mapped[str] = mapped_column(String(50), nullable=True)
    metodo_http: Mapped[str] = mapped_column(String(10), nullable=True)
    ruta: Mapped[str] = mapped_column(String(500), nullable=True)
    estado_http: Mapped[int] = mapped_column(nullable=True)
    agente_usuario: Mapped[str] = mapped_column(String(500), nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    usuario = relationship("Usuario", back_populates="registros_auditoria")
