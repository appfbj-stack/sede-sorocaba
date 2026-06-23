from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Kairos Base"
    APP_SLUG: str = "kairos-base"

    DATABASE_URL: str = "sqlite:///./kairos.db"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 dias

    # Licença / tenant inicial (criados automaticamente no primeiro start)
    TENANT_NOME: str = "Empresa Exemplo"
    TENANT_SLUG: str = "empresa-exemplo"
    LICENCA_DIAS_TESTE: int = 14

    # Master inicial (criado automaticamente no primeiro start)
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

    # Login com Google (OAuth2) — opcional, além do login por e-mail/senha
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""

    # E-mail (recuperação de senha) — se vazio, o link é apenas logado no console
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@kairos.local"

    FRONTEND_URL: str = "http://localhost:5173"

    UPLOAD_DIR: str = "uploads"

    class Config:
        env_file = ".env"

settings = Settings()
