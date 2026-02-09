"""
Shared Anthropic LLM client singleton.

Lazy-imports anthropic so we don't pay the import cost at startup
and don't crash if the package isn't installed (non-AI deployments).
"""

from high_finance.core.config import settings

_client = None

HAIKU_MODEL = "claude-haiku-4-5-20251001"


def get_anthropic_client():
    """Return the shared AsyncAnthropic client (created once, reused forever)."""
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client
