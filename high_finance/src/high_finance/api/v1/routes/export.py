"""
Export Routes
=============
Excel export endpoints for projects and tickers.

Security:
- Project exports require authentication and ownership verification
- Ticker exports allow optional authentication (anonymous allowed)
- Rate limited to prevent abuse
- Input validation with bounds checking
- Filename sanitization to prevent path injection
"""

import asyncio
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from high_finance.db.session import get_db
from high_finance.core.security import (
    get_current_user,
    get_current_user_optional,
    verify_resource_ownership,
    User,
)
from high_finance.core.rate_limit import limiter
from high_finance.services.export_excel import (
    generate_project_tearsheet,
    generate_ticker_export,
    generate_financials_export,
    sanitize_filename,
)
from high_finance.services.financials import get_financial_statements
from high_finance.services.project import get_project_or_404

logger = logging.getLogger(__name__)
router = APIRouter()

EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# Timeout for export generation (30 seconds)
EXPORT_TIMEOUT_SECONDS = 30


@router.get("/projects/{project_id}/export/excel")
@limiter.limit("10/minute")
async def export_project_excel(
    request: Request,
    project_id: int = Path(..., gt=0, description="Project ID"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Export a research project as a professional tearsheet Excel file.

    Generates a 4-tab workbook:
    - Summary: Project details, thesis, risks, catalysts
    - DCF Model: Assumptions and calculations
    - Financials: Income statement history
    - Scenarios: Bear/Base/Bull analysis

    Requires authentication and project ownership.
    """
    # Get project and verify ownership
    project = await get_project_or_404(db, project_id)
    verify_resource_ownership(user, project.owner_id)

    try:
        # Generate with timeout
        excel_bytes = await asyncio.wait_for(
            generate_project_tearsheet(project_id, user.id, db),
            timeout=EXPORT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.warning(f"Export timeout: project={project_id} user={user.id}")
        raise HTTPException(504, "Export timed out. Try with fewer items.")
    except ValueError as e:
        logger.error(f"Export value error: project={project_id} error={e}")
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.exception(f"Export failed: project={project_id} error={e}")
        raise HTTPException(422, "Unable to generate export. Please try again.")

    # Generate safe filename
    safe_ticker = sanitize_filename(project.ticker)
    filename = f"{safe_ticker}_Tearsheet_{date.today().isoformat()}.xlsx"

    logger.info(f"Export: user={user.id} project={project_id} type=tearsheet ticker={project.ticker}")

    return StreamingResponse(
        excel_bytes,
        media_type=EXCEL_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/{ticker}/excel")
@limiter.limit("10/minute")
async def export_ticker_excel(
    request: Request,
    ticker: str = Path(
        ...,
        min_length=1,
        max_length=5,
        pattern=r"^[A-Za-z]{1,5}$",
        description="Stock ticker symbol (1-5 letters)",
    ),
    growth: Optional[float] = Query(
        default=None,
        ge=-0.5,
        le=1.0,
        description="Revenue growth rate (-50% to 100%)",
    ),
    margin: Optional[float] = Query(
        default=None,
        ge=-0.5,
        le=0.8,
        description="Operating margin (-50% to 80%)",
    ),
    wacc: Optional[float] = Query(
        default=None,
        ge=0.01,
        le=0.50,
        description="Discount rate (1% to 50%)",
    ),
    tax: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=0.5,
        description="Tax rate (0% to 50%)",
    ),
    terminal_g: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=0.05,
        description="Terminal growth rate (0% to 5%)",
    ),
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Export a ticker valuation as a quick Excel file.

    Generates a 3-tab workbook:
    - Valuation Overview: Key facts and DCF result
    - DCF Model: Assumptions and calculations
    - Scenarios: Bear/Base/Bull analysis

    Parameters are optional - if not provided, smart defaults from
    actual financials will be used.

    Authentication is optional (allows anonymous exports).
    """
    # Validate WACC > terminal_g if both provided
    if wacc is not None and terminal_g is not None:
        if abs(wacc - terminal_g) < 0.001:
            raise HTTPException(
                400,
                "WACC must be greater than terminal growth rate",
            )
        if wacc <= terminal_g:
            raise HTTPException(
                400,
                "WACC must be greater than terminal growth rate",
            )

    user_id = user.id if user else "anonymous"
    ticker_upper = ticker.upper()

    try:
        # Generate with timeout
        excel_bytes = await asyncio.wait_for(
            generate_ticker_export(
                ticker_upper,
                {
                    "growth": growth,
                    "margin": margin,
                    "wacc": wacc,
                    "tax": tax,
                    "terminal_g": terminal_g,
                },
                user_id,
                db,
            ),
            timeout=EXPORT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.warning(f"Export timeout: ticker={ticker_upper} user={user_id}")
        raise HTTPException(504, "Export timed out.")
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower() or "delisted" in error_msg.lower():
            raise HTTPException(404, error_msg)
        logger.error(f"Export value error: ticker={ticker_upper} error={e}")
        raise HTTPException(422, str(e))
    except Exception as e:
        logger.exception(f"Export failed: ticker={ticker_upper} error={e}")
        raise HTTPException(422, "Unable to generate export. Please try again.")

    # Generate safe filename
    safe_ticker = sanitize_filename(ticker)
    filename = f"{safe_ticker}_DCF_{date.today().isoformat()}.xlsx"

    logger.info(f"Export: user={user_id} ticker={ticker_upper} type=dcf")

    return StreamingResponse(
        excel_bytes,
        media_type=EXCEL_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/financials/{ticker}/excel")
@limiter.limit("10/minute")
async def export_financials_excel(
    request: Request,
    ticker: str = Path(
        ...,
        min_length=1,
        max_length=5,
        pattern=r"^[A-Za-z]{1,5}$",
        description="Stock ticker symbol (1-5 letters)",
    ),
    user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Export financial statements as an Excel file.

    Generates a 6-tab workbook:
    - Income Statement (Annual)
    - Income Statement (Quarterly)
    - Balance Sheet (Annual)
    - Balance Sheet (Quarterly)
    - Cash Flow (Annual)
    - Cash Flow (Quarterly)

    Authentication is optional (allows anonymous exports).
    """
    user_id = user.id if user else "anonymous"
    ticker_upper = ticker.upper()

    try:
        # Get financial statements
        financials = await get_financial_statements(ticker_upper)

        if not financials:
            raise HTTPException(404, f"No financial data found for {ticker_upper}")

        # Generate with timeout
        excel_bytes = await asyncio.wait_for(
            generate_financials_export(ticker_upper, financials),
            timeout=EXPORT_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.warning(f"Financials export timeout: ticker={ticker_upper} user={user_id}")
        raise HTTPException(504, "Export timed out.")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Financials export failed: ticker={ticker_upper} error={e}")
        raise HTTPException(422, "Unable to generate export. Please try again.")

    # Generate safe filename
    safe_ticker = sanitize_filename(ticker)
    filename = f"{safe_ticker}_Financials_{date.today().isoformat()}.xlsx"

    logger.info(f"Export: user={user_id} ticker={ticker_upper} type=financials")

    return StreamingResponse(
        excel_bytes,
        media_type=EXCEL_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
