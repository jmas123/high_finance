from structlog import get_logger, wrap_logger
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

logger = wrap_logger(get_logger())