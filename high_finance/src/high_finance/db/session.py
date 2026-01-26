from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from high_finance.core.config import settings

# Create the SQLAlchemy engine
engine = create_engine(settings.DATABASE_URL)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a scoped session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()