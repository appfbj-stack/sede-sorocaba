from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Kairos Base"
    APP_SLUG: str = "kairos-base"

    DATABASE_URL: str = "sqlite:///./kairos.db"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 dias

    TENANT_NOME: str = "Empresa Exemplo"
    TENANT_SLUG: str = "empresa-exemplo"
    LICENCA_DIAS_TESTE: int = 14

    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@kairos.local"

    FRONTEND_URL: str = "http://localhost:5173"
    UPLOAD_DIR: str = "uploads"

    # Assistente IA (OpenRouter)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "google/gemini-flash-1.5"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    ASSISTENTE_MAX_TOKENS: int = 1024
    ASSISTENTE_HISTORICO_MAX: int = 20

    class Config:
        env_file = ".env"

settings = Settings()
