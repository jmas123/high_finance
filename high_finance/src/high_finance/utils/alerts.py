"""
Alerts Utility
==============
Send alerts for job failures and other important events.
"""

import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)


def send_slack_alert(message: str, channel: Optional[str] = None) -> bool:
    """
    Send an alert message to Slack via webhook.

    Args:
        message: The message text to send.
        channel: Optional channel override (webhook default used if not specified).

    Returns:
        True if message was sent successfully, False otherwise.
    """
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")

    if not webhook_url:
        logger.debug("SLACK_WEBHOOK_URL not configured, skipping alert")
        return False

    payload = {"text": message}
    if channel:
        payload["channel"] = channel

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=10,
        )
        response.raise_for_status()
        logger.info(f"Slack alert sent: {message[:50]}...")
        return True
    except requests.RequestException as e:
        logger.error(f"Failed to send Slack alert: {e}")
        return False


def send_job_failure_alert(job_name: str, job_id: str, error: str) -> bool:
    """
    Send a formatted alert for a failed job.

    Args:
        job_name: Name of the job that failed.
        job_id: Unique job identifier.
        error: Error message or traceback.

    Returns:
        True if alert was sent successfully.
    """
    message = (
        f":x: *Job Failed*\n"
        f"*Job:* `{job_name}`\n"
        f"*ID:* `{job_id}`\n"
        f"*Error:*\n```{error[:500]}```"  # Truncate long errors
    )
    return send_slack_alert(message)


def send_job_success_alert(job_name: str, job_id: str, summary: dict) -> bool:
    """
    Send a formatted alert for a successful job (optional, for important jobs).

    Args:
        job_name: Name of the job that succeeded.
        job_id: Unique job identifier.
        summary: Job result summary dict.

    Returns:
        True if alert was sent successfully.
    """
    # Only send success alerts if explicitly enabled
    if not os.getenv("SLACK_ALERT_ON_SUCCESS", "").lower() == "true":
        return False

    summary_str = ", ".join(f"{k}: {v}" for k, v in summary.items() if k != "status")
    message = (
        f":white_check_mark: *Job Completed*\n"
        f"*Job:* `{job_name}`\n"
        f"*ID:* `{job_id}`\n"
        f"*Summary:* {summary_str}"
    )
    return send_slack_alert(message)
