from pydantic import BaseModel, Field

from app.modules.usuarios.esquemas import UsuarioResponse


class LoginRequest(BaseModel):
    identificador: str
    contrasena: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioResponse


class VerifyTokenRequest(BaseModel):
    token: str
