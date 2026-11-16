"""Punto de entrada de la API FastAPI del PMS Hotel Paredes.

Registra middleware, routers, archivos estáticos y compatibilidad de esquema
para instalaciones existentes mientras se consolidan las migraciones formales.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from datetime import datetime, timezone
import uuid

from app.core.config import settings
from sqlalchemy import inspect, text

from app.core.database import Base, engine, SessionLocal
from app.common.auditoria import establecer_contexto_request, limpiar_contexto_request
from app.modules.auth.router import router as auth_router
from app.modules.usuarios.router import router as usuarios_router
from app.modules.habitaciones.router import router_tipos, router_habitaciones, router_pisos, router_pagos
from app.modules.huespedes.router import router as huespedes_router
from app.modules.reservas.router import router as reservas_router, router_disponibilidad
from app.modules.estadias.router import router as estadias_router
from app.modules.limpieza.router import router as limpieza_router
from app.modules.facturacion.router import router as facturacion_router, router_facturas
from app.modules.caja.router import router as caja_router
from app.modules.reportes.router import router as reportes_router
from app.modules.auditoria.router import router as auditoria_router
from app.modules.ventas.router import router as ventas_router
from app.modules.ventas.modelos import Producto, CategoriaProducto
from app.modules.configuracion.router import router as configuracion_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(usuarios_router)
app.include_router(router_tipos)
app.include_router(router_habitaciones)
app.include_router(router_pisos)
app.include_router(router_pagos)
app.include_router(huespedes_router)
app.include_router(reservas_router)
app.include_router(router_disponibilidad)
app.include_router(estadias_router)
app.include_router(limpieza_router)
app.include_router(facturacion_router)
app.include_router(router_facturas)
app.include_router(caja_router)
app.include_router(reportes_router)
app.include_router(auditoria_router)
app.include_router(ventas_router)
app.include_router(configuracion_router)

uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.middleware("http")
async def contexto_auditoria(request, call_next):
    """Hace disponible el contexto HTTP para cada registro de auditoría."""
    token = establecer_contexto_request(request)
    try:
        return await call_next(request)
    finally:
        limpiar_contexto_request(token)


@app.on_event("startup")
def on_startup():
    """Inicializa tablas y aplica ajustes de compatibilidad al arrancar."""
    Base.metadata.create_all(bind=engine)
    agregar_columnas_reserva_si_faltan()
    migrar_pisos_habitaciones()
    migrar_categorias_productos()
    agregar_columnas_auditoria()


def agregar_columnas_auditoria():
    """Añade columnas de contexto a instalaciones anteriores del sistema."""
    columnas = {col["name"] for col in inspect(engine).get_columns("registros_auditoria")}
    nuevas = {
        "nombre_usuario": "VARCHAR(255)",
        "rol_usuario": "VARCHAR(50)",
        "metodo_http": "VARCHAR(10)",
        "ruta": "VARCHAR(500)",
        "estado_http": "INTEGER",
        "agente_usuario": "VARCHAR(500)",
    }
    with engine.begin() as conn:
        for nombre, tipo in nuevas.items():
            if nombre not in columnas:
                conn.execute(text(f"ALTER TABLE registros_auditoria ADD COLUMN {nombre} {tipo}"))


def agregar_columnas_reserva_si_faltan():
    """Completa columnas introducidas por las versiones recientes del PMS."""
    columnas = {col["name"] for col in inspect(engine).get_columns("reservas")}
    alteraciones = []
    if "tiene_vehiculo" not in columnas:
        alteraciones.append("ALTER TABLE reservas ADD COLUMN tiene_vehiculo BOOLEAN NOT NULL DEFAULT 0")
    if "detalle_vehiculo" not in columnas:
        alteraciones.append("ALTER TABLE reservas ADD COLUMN detalle_vehiculo TEXT")
    if "motivo_cancelacion" not in columnas:
        alteraciones.append("ALTER TABLE reservas ADD COLUMN motivo_cancelacion TEXT")

    if alteraciones:
        with engine.begin() as conn:
            for alteracion in alteraciones:
                conn.execute(text(alteracion))

    columnas_configuracion = {col["name"] for col in inspect(engine).get_columns("configuracion")}
    alteraciones_configuracion = {
        "cai": "VARCHAR(100)",
        "rango_autorizado": "VARCHAR(255)",
        "fecha_limite_emision": "VARCHAR(20)",
        "impuesto_turistico": "FLOAT NOT NULL DEFAULT 4.0",
    }
    with engine.begin() as conn:
        for nombre, tipo in alteraciones_configuracion.items():
            if nombre not in columnas_configuracion:
                conn.execute(text(f"ALTER TABLE configuracion ADD COLUMN {nombre} {tipo}"))

    columnas_usuarios = {col["name"] for col in inspect(engine).get_columns("usuarios")}
    if "usuario" not in columnas_usuarios:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE usuarios ADD COLUMN usuario VARCHAR(100)"))
            existentes = conn.execute(text("SELECT id, email FROM usuarios ORDER BY created_at, id")).all()
            usados: set[str] = set()
            for usuario_id, email in existentes:
                base = str(email).split("@", 1)[0].lower()
                candidato = base
                sufijo = 2
                while candidato in usados:
                    candidato = f"{base}{sufijo}"
                    sufijo += 1
                usados.add(candidato)
                conn.execute(text("UPDATE usuarios SET usuario = :usuario WHERE id = :id"), {"usuario": candidato, "id": usuario_id})
    with engine.begin() as conn:
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_usuarios_usuario ON usuarios (usuario)"))
    if "permisos" not in columnas_usuarios:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE usuarios ADD COLUMN permisos TEXT DEFAULT '[]'"))
    if "ultima_actividad" not in columnas_usuarios:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE usuarios ADD COLUMN ultima_actividad DATETIME"))
    if "version_sesion" not in columnas_usuarios:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE usuarios ADD COLUMN version_sesion INTEGER NOT NULL DEFAULT 0"))

    columnas_limpieza = {col["name"] for col in inspect(engine).get_columns("tareas_limpieza")}
    if "tipo_limpieza" not in columnas_limpieza:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE tareas_limpieza ADD COLUMN tipo_limpieza VARCHAR(50) NOT NULL DEFAULT 'GENERAL'"
            ))


def migrar_pisos_habitaciones():
    columnas_habitaciones = {col["name"] for col in inspect(engine).get_columns("habitaciones")}
    if "piso_id" in columnas_habitaciones:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE habitaciones ADD COLUMN piso_id VARCHAR"))
        pisos_legacy = conn.execute(
            text("SELECT DISTINCT piso FROM habitaciones WHERE piso IS NOT NULL AND TRIM(piso) != ''")
        ).scalars().all()

        for nombre in pisos_legacy:
            piso_id = conn.execute(
                text("SELECT id FROM pisos WHERE nombre = :nombre"),
                {"nombre": str(nombre)},
            ).scalar_one_or_none()
            if piso_id is None:
                piso_id = str(uuid.uuid4())
                ahora = datetime.now(timezone.utc)
                conn.execute(
                    text(
                        "INSERT INTO pisos "
                        "(id, nombre, estado, created_at, updated_at) "
                        "VALUES (:id, :nombre, 'ACTIVO', :ahora, :ahora)"
                    ),
                    {"id": piso_id, "nombre": str(nombre), "ahora": ahora},
                )

            conn.execute(
                text("UPDATE habitaciones SET piso_id = :piso_id WHERE piso = :nombre"),
                {"piso_id": piso_id, "nombre": str(nombre)},
            )


def migrar_categorias_productos():
    db = SessionLocal()
    try:
        nombres = db.query(Producto.categoria).filter(
            Producto.categoria.isnot(None), Producto.categoria != ""
        ).distinct().all()
        for (nombre,) in nombres:
            if not db.query(CategoriaProducto).filter(CategoriaProducto.nombre == nombre).first():
                db.add(CategoriaProducto(nombre=nombre))
        db.commit()
    finally:
        db.close()


@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
