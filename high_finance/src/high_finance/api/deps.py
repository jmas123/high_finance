from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, HTTPException, status
from high_finance.db.session import get_db  # <-- correct location

async def get_database_session() -> AsyncSession:
    db: AsyncSession = Depends(get_db)
    if db is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database connection error")
    return db