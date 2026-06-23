import smtplib
from email.message import EmailMessage
from app.core.config import settings

def send_email(to: str, subject: str, body: str) -> None:
    """Envia e-mail via SMTP se configurado; caso contrário, apenas loga (ambiente de desenvolvimento)."""
    if not settings.SMTP_HOST:
        print(f"📧 [email simulado] Para: {to} | Assunto: {subject}\n{body}")
        return

    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)

def send_password_reset_email(to: str, reset_url: str) -> None:
    send_email(
        to=to,
        subject="Recuperação de senha",
        body=f"Use o link abaixo para redefinir sua senha (válido por 1 hora):\n\n{reset_url}",
    )
