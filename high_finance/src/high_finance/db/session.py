from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from high_finance.core.config import settings

# Create the SQLAlchemy engine with connection pooling
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,         # persistent connections per worker
    max_overflow=10,      # burst capacity above pool_size
    pool_pre_ping=True,   # verify connections before use (handles DB restarts)
    pool_timeout=30,      # wait time for a connection from pool
    pool_recycle=1800,    # recycle connections after 30 min (avoid stale connections)
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