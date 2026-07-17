import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import AdminUsuario
from app.modules.configuracion.modelos import HotelConfig
from app.modules.configuracion.esquemas import ConfigCrear, ConfigActualizar, ConfigResponse
from app.modules.usuarios.modelos import Usuario

router = APIRouter(prefix="/configuracion", tags=["Configuración"])

UPLOAD_DIR = Path("uploads/logos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _obtener_o_crear_config(db: Session) -> HotelConfig:
    config = db.query(HotelConfig).first()
    if not config:
        config = HotelConfig(nombre="Hotel Paredes", impuesto=15.0)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("", response_model=ConfigResponse)
def obtener_config(db: Session = Depends(get_db)):
    return _obtener_o_crear_config(db)


@router.put("", response_model=ConfigResponse)
def actualizar_config(
    datos: ConfigActualizar,
    db: Session = Depends(get_db),
    _: Usuario = Depends(AdminUsuario),
):
    config = _obtener_o_crear_config(db)
    for key, val in datos.model_dump(exclude_unset=True).items():
        setattr(config, key, val)
    db.commit()
    db.refresh(config)
    return config


@router.post("/logo", response_model=ConfigResponse)
def subir_logo(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(AdminUsuario),
):
    ext = os.path.splitext(archivo.filename or "logo.png")[1]
    nombre = f"logo_{uuid.uuid4().hex}{ext}"
    ruta = UPLOAD_DIR / nombre
    with open(ruta, "wb") as f:
        shutil.copyfileobj(archivo.file, f)
    config = _obtener_o_crear_config(db)
    config.logo_url = f"/uploads/logos/{nombre}"
    db.commit()
    db.refresh(config)
    return config


@router.delete("/logo", response_model=ConfigResponse)
def eliminar_logo(
    db: Session = Depends(get_db),
    _: Usuario = Depends(AdminUsuario),
):
    config = _obtener_o_crear_config(db)
    if config.logo_url:
        ruta = Path(config.logo_url.lstrip("/"))
        if ruta.exists():
            ruta.unlink()
    config.logo_url = ""
    db.commit()
    db.refresh(config)
    return config


@router.post("/fondo-login", response_model=ConfigResponse)
def subir_fondo_login(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: Usuario = Depends(AdminUsuario),
):
    ext = os.path.splitext(archivo.filename or "fondo.png")[1]
    nombre = f"fondo_{uuid.uuid4().hex}{ext}"
    ruta = UPLOAD_DIR / nombre
    with open(ruta, "wb") as f:
        shutil.copyfileobj(archivo.file, f)
    config = _obtener_o_crear_config(db)
    if config.login_fondo_url:
        ruta_vieja = Path(config.login_fondo_url.lstrip("/"))
        if ruta_vieja.exists():
            ruta_vieja.unlink()
    config.login_fondo_url = f"/uploads/logos/{nombre}"
    db.commit()
    db.refresh(config)
    return config


@router.delete("/fondo-login", response_model=ConfigResponse)
def eliminar_fondo_login(
    db: Session = Depends(get_db),
    _: Usuario = Depends(AdminUsuario),
):
    config = _obtener_o_crear_config(db)
    if config.login_fondo_url:
        ruta = Path(config.login_fondo_url.lstrip("/"))
        if ruta.exists():
            ruta.unlink()
    config.login_fondo_url = ""
    db.commit()
    db.refresh(config)
    return config
