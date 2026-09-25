from datetime import datetime, timezone
from datetime import date

from app.core.database import get_db
from app.core.seguridad import obtener_usuario_actual
from app.modules.auditoria.modelos import RegistroAuditoria
from app.modules.usuarios.modelos import Usuario
from tests.conftest import TestingSessionLocal


def preparar_datos():
    db = TestingSessionLocal()
    usuario = Usuario(
        email="auditoria@test.local",
        contrasena="hash",
        nombre_completo="Administrador Auditoría",
        rol="gerente",
        estado="activo",
    )
    db.add(usuario)
    db.flush()
    db.add_all([
        RegistroAuditoria(
            usuario_id=usuario.id,
            accion="ACTUALIZAR",
            tipo_entidad="RESERVA",
            entidad_id="reserva-1",
            valores_anteriores='{"estado":"PENDIENTE"}',
            valores_nuevos='{"estado":"CONFIRMADA"}',
            creado_en=datetime(2026, 9, 11, 23, 30, tzinfo=timezone.utc),
        ),
        RegistroAuditoria(
            usuario_id=usuario.id,
            accion="CREAR",
            tipo_entidad="PRODUCTO",
            entidad_id="producto-1",
            creado_en=datetime(2026, 9, 10, 10, 0, tzinfo=timezone.utc),
        ),
    ])
    db.commit()
    db.close()


def test_auditoria_pagina_y_filtro_hasta_incluyen_el_dia(client):
    preparar_datos()
    app = client.app
    app.dependency_overrides[obtener_usuario_actual] = lambda: TestingSessionLocal().query(Usuario).filter_by(email="auditoria@test.local").first()
    try:
        response = client.get("/registros-auditoria?hasta=2026-09-11&tamano=1")
        assert response.status_code == 200
        payload = response.json()
        assert payload["total"] == 2
        assert len(payload["items"]) == 1
        assert payload["items"][0]["nombre_usuario"] == "Administrador Auditoría"
    finally:
        app.dependency_overrides.pop(obtener_usuario_actual, None)


def test_auditoria_exporta_excel(client):
    preparar_datos()
    app = client.app
    app.dependency_overrides[obtener_usuario_actual] = lambda: TestingSessionLocal().query(Usuario).filter_by(email="auditoria@test.local").first()
    try:
        response = client.get("/registros-auditoria/exportar?formato=xlsx")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/vnd.openxmlformats")
        assert response.headers["content-disposition"] == f'attachment; filename="auditoria_{date.today().isoformat()}.xlsx"'
        assert response.content[:2] == b"PK"
    finally:
        app.dependency_overrides.pop(obtener_usuario_actual, None)