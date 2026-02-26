"""
Email notification service for JegsMedLab using SendGrid.
Sends critical lab alerts and welcome emails.
"""
import os
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, HtmlContent, To

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "alerts@jegsmedlab.com")
FROM_NAME = os.getenv("FROM_NAME", "JegsMedLab")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def is_email_configured() -> bool:
    return bool(SENDGRID_API_KEY and SENDGRID_API_KEY.startswith("SG."))


def _send(to_email: str, subject: str, html: str) -> bool:
    if not is_email_configured():
        logger.info(f"Email not configured — skipping send to {to_email}: {subject}")
        return False
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        message = Mail(
            from_email=(FROM_EMAIL, FROM_NAME),
            to_emails=To(to_email),
            subject=subject,
            html_content=HtmlContent(html),
        )
        sg.send(message)
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"SendGrid error: {e}")
        return False


def send_welcome_email(to_email: str, full_name: str) -> bool:
    name = full_name or "there"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 40px 20px;">
      <div style="background: linear-gradient(135deg, #1d4ed8, #4338ca); border-radius: 16px; padding: 40px; text-align: center; margin-bottom: 24px;">
        <h1 style="color: white; font-size: 28px; margin: 0 0 8px;">Welcome to JegsMedLab</h1>
        <p style="color: #bfdbfe; margin: 0; font-size: 16px;">Your personal health intelligence platform</p>
      </div>
      <div style="background: white; border-radius: 16px; padding: 32px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
        <h2 style="color: #1e293b; margin: 0 0 16px;">Hi {name} 👋</h2>
        <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
          You're all set! JegsMedLab uses Claude Opus 4.6 AI with medical RAG retrieval to help you
          understand your lab results in plain English.
        </p>
        <h3 style="color: #1e293b; margin: 24px 0 12px;">Get started in 3 steps:</h3>
        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0 0 10px; color: #334155;"><strong>1.</strong> Upload your first lab report (PDF or image)</p>
          <p style="margin: 0 0 10px; color: #334155;"><strong>2.</strong> Get instant AI-powered interpretation</p>
          <p style="margin: 0; color: #334155;"><strong>3.</strong> Ask follow-up questions in plain English</p>
        </div>
        <a href="{FRONTEND_URL}/app" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 12px; font-size: 16px;">
          Open JegsMedLab →
        </a>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin: 0;">
        JegsMedLab is for educational purposes only. Not a substitute for professional medical advice.
        <br>© 2025 JegsMedLab
      </p>
    </div>
    """
    return _send(to_email, "Welcome to JegsMedLab 🧬", html)


def send_critical_alert_email(to_email: str, full_name: str, alerts: list[dict]) -> bool:
    name = full_name or "there"
    alert_rows = ""
    for a in alerts:
        status_color = "#dc2626" if "critical" in a.get("status", "") else "#d97706"
        alert_rows += f"""
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600;">{a.get('test_name', '')}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; color: {status_color}; font-weight: 700;">{a.get('value', '')} {a.get('unit', '')}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; color: #64748b;">{a.get('message', '')}</td>
        </tr>
        """

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 40px 20px;">
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 16px; padding: 24px; margin-bottom: 24px; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
        <h1 style="color: #991b1b; font-size: 22px; margin: 0 0 8px;">Critical Lab Values Detected</h1>
        <p style="color: #b91c1c; margin: 0;">Immediate attention may be required</p>
      </div>
      <div style="background: white; border-radius: 16px; padding: 32px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
        <p style="color: #475569; margin: 0 0 24px;">Hi {name}, your latest lab report contains values that may require attention. Please review and consult your healthcare provider.</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 12px 16px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">Test</th>
              <th style="padding: 12px 16px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">Value</th>
              <th style="padding: 12px 16px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">Notes</th>
            </tr>
          </thead>
          <tbody>{alert_rows}</tbody>
        </table>
        <a href="{FRONTEND_URL}/app" style="display: inline-block; background: #dc2626; color: white; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 12px; font-size: 16px;">
          View Full Report →
        </a>
      </div>
      <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <p style="color: #92400e; margin: 0; font-size: 13px;">
          <strong>Important:</strong> This is an automated alert from JegsMedLab for educational purposes.
          Always consult your healthcare provider for medical advice and treatment decisions.
        </p>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin: 0;">© 2025 JegsMedLab</p>
    </div>
    """
    return _send(to_email, f"⚠️ Critical Lab Values Detected — Action Required", html)


def send_report_ready_email(to_email: str, full_name: str, report_summary: str) -> bool:
    name = full_name or "there"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 40px 20px;">
      <div style="background: linear-gradient(135deg, #1d4ed8, #4338ca); border-radius: 16px; padding: 32px; margin-bottom: 24px;">
        <h1 style="color: white; font-size: 22px; margin: 0 0 8px;">✅ Your Lab Report is Ready</h1>
        <p style="color: #bfdbfe; margin: 0;">AI analysis complete</p>
      </div>
      <div style="background: white; border-radius: 16px; padding: 32px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
        <p style="color: #475569; margin: 0 0 16px;">Hi {name}, your lab report has been analyzed.</p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
          <p style="color: #334155; margin: 0; line-height: 1.6; font-size: 14px;">{report_summary[:400]}{"..." if len(report_summary) > 400 else ""}</p>
        </div>
        <a href="{FRONTEND_URL}/app" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; font-weight: 600; padding: 14px 32px; border-radius: 12px; font-size: 16px;">
          View Full Analysis →
        </a>
      </div>
      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin: 0;">© 2025 JegsMedLab · Educational purposes only</p>
    </div>
    """
    return _send(to_email, "Your Lab Report Analysis is Ready 🧬", html)
