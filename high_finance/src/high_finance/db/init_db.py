from high_finance.db.base import Base
from high_finance.db.session import engine

# IMPORTANT: ensures all model modules are imported so Base knows about them
import high_finance.db.models  # noqa: F401

def main():
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created")

if __name__ == "__main__":
    main()
