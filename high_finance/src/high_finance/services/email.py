"""
Email Service
=============
Sends transactional emails (e.g. password reset).
Uses Python stdlib smtplib — no extra dependencies.

If SMTP is not configured, logs the email content to console
so dev/test flows still work.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from high_finance.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


def send_password_reset_email(to_email: str, reset_link: str) -> None:
    """
    Send a password reset email.

    If SMTP is not configured, logs the reset link instead of sending.
    This keeps dev workflows functional without an SMTP server.
    """
    if not _smtp_configured():
        logger.warning(
            "SMTP not configured — printing reset link to console.\n"
            "  To: %s\n"
            "  Reset link: %s",
            to_email,
            reset_link,
        )
        return

    sender = settings.EMAIL_FROM or settings.SMTP_USER

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your High Finance password"
    msg["From"] = sender
    msg["To"] = to_email

    text_body = (
        "You requested a password reset for your High Finance account.\n\n"
        f"Click the link below to set a new password (expires in 30 minutes):\n\n"
        f"{reset_link}\n\n"
        "If you didn't request this, you can safely ignore this email.\n"
    )

    html_body = f"""\
<html>
<body style="font-family: system-ui, sans-serif; background: #111; color: #fff; padding: 40px;">
  <div style="max-width: 480px; margin: 0 auto; background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 32px;">
    <h2 style="margin-top: 0; color: #fff;">Reset Your Password</h2>
    <p style="color: #ccc;">You requested a password reset for your High Finance account.</p>
    <p style="color: #ccc;">Click the button below to set a new password. This link expires in 30 minutes.</p>
    <a href="{reset_link}"
       style="display: inline-block; padding: 12px 28px; background: #3b82f6; color: #fff;
              border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
      Reset Password
    </a>
    <p style="color: #666; font-size: 13px; margin-top: 24px;">
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>"""

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(sender, [to_email], msg.as_string())
        logger.info("Password reset email sent to %s", to_email)
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
