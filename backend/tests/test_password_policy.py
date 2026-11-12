import pytest
from pydantic import ValidationError

from app.modules.usuarios.esquemas import UsuarioCrear


def build_user(password: str) -> dict[str, str]:
    return {
        "usuario": "nuevo_usuario",
        "email": "nuevo@example.com",
        "contrasena": password,
        "nombre_completo": "Usuario Nuevo",
    }


@pytest.mark.parametrize(
    "password",
    [
        "abcdefghijkl1",
        "Abcdefghijkl1",
        "Abcdefghijkl!",
        "Abcdefghijkl1! ",
    ],
)
def test_rejects_weak_passwords(password: str):
    with pytest.raises(ValidationError):
        UsuarioCrear(**build_user(password))


def test_accepts_password_with_all_required_character_classes():
    usuario = UsuarioCrear(**build_user("HotelParedes2026!"))

    assert usuario.contrasena == "HotelParedes2026!"
