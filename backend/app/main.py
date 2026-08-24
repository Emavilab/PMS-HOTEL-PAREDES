from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from sqlalchemy import inspect, text

from app.core.database import Base, engine
from app.modules.auth.router import router as auth_router
from app.modules.usuarios.router import router as usuarios_router
from app.modules.habitaciones.router import router_tipos, router_habitaciones
from app.modules.huespedes.router import router as huespedes_router
from app.modules.reservas.router import router as reservas_router, router_disponibilidad
from app.modules.estadias.router import router as estadias_router
from app.modules.limpieza.router import router as limpieza_router
from app.modules.facturacion.router import router as facturacion_router, router_facturas
from app.modules.caja.router import router as caja_router
from app.modules.reportes.router import router as reportes_router
from app.modules.auditoria.router import router as auditoria_router
from app.modules.ventas.router import router as ventas_router
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


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    agregar_columnas_reserva_si_faltan()


def agregar_columnas_reserva_si_faltan():
    columnas = {col["name"] for col in inspect(engine).get_columns("reservas")}
    alteraciones = []
    if "tiene_vehiculo" not in columnas:
        alteraciones.append("ALTER TABLE reservas ADD COLUMN tiene_vehiculo BOOLEAN NOT NULL DEFAULT 0")
    if "detalle_vehiculo" not in columnas:
        alteraciones.append("ALTER TABLE reservas ADD COLUMN detalle_vehiculo TEXT")
    if "motivo_cancelacion" not in columnas:
        alteraciones.append("ALTER TABLE reservas ADD COLUMN motivo_cancelacion TEXT")

    if not alteraciones:
        return

    with engine.begin() as conn:
        for alteracion in alteraciones:
            conn.execute(text(alteracion))


@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}
