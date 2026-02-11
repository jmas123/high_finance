from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from high_finance.core.config import settings

# Create the SQLAlchemy engine with connection pooling
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=5,          # persistent connections per worker
    max_overflow=5,       # burst capacity above pool_size (max 10 per worker)
    pool_pre_ping=True,   # verify connections before use (handles DB restarts)
    pool_timeout=30,      # wait time for a connection from pool
    pool_recycle=1800,    # recycle connections after 30 min (avoid stale connections)
    connect_args={
        "connect_timeout": 10,                      # TCP connect timeout (seconds)
        "options": "-c statement_timeout=30000",     # query timeout 30s (milliseconds)
    },
)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a scoped session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
