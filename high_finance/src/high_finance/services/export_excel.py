"""
Excel Export Service
====================
Generates professional tearsheet Excel files for projects and tickers.

Two modes:
1. Full Tearsheet (from Project): Summary, DCF Model, Financials, Scenarios
2. Quick Export (from Ticker View): Valuation Overview, DCF Model, Scenarios
"""

import logging
import re
from datetime import date, datetime
from io import BytesIO
from typing import Any, Dict, List, Optional

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session

from high_finance.services.valuation import get_valuation_bundle
from high_finance.services.financials import get_financial_statements
from high_finance.services.project import get_project
from high_finance.utils.safe_math import safe_div, safe_pct_change

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# STYLING CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

YELLOW_FILL = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
LIGHT_BLUE_FILL = PatternFill(start_color="E6F3FF", end_color="E6F3FF", fill_type="solid")
HEADER_FILL = PatternFill(start_color="2C3E50", end_color="2C3E50", fill_type="solid")
GREEN_FILL = PatternFill(start_color="D4EDDA", end_color="D4EDDA", fill_type="solid")
RED_FILL = PatternFill(start_color="F8D7DA", end_color="F8D7DA", fill_type="solid")

BLUE_FONT = Font(color="0066CC")
RED_FONT = Font(color="FF0000")
WHITE_FONT = Font(color="FFFFFF", bold=True)
BOLD_FONT = Font(bold=True)
HEADER_FONT = Font(color="FFFFFF", bold=True, size=11)

THIN_BORDER = Border(
    left=Side(style="thin", color="CCCCCC"),
    right=Side(style="thin", color="CCCCCC"),
    top=Side(style="thin", color="CCCCCC"),
    bottom=Side(style="thin", color="CCCCCC"),
)


# ═══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def sanitize_filename(ticker: str) -> str:
    """Remove any chars that could be path injection."""
    return re.sub(r'[^A-Z0-9]', '', ticker.upper())[:10]


def _format_large_number(value: float) -> str:
    """Format large numbers with abbreviation."""
    if value is None:
        return "N/A"
    if abs(value) >= 1e12:
        return f"${value/1e12:.1f}T"
    elif abs(value) >= 1e9:
        return f"${value/1e9:.1f}B"
    elif abs(value) >= 1e6:
        return f"${value/1e6:.1f}M"
    elif abs(value) >= 1e3:
        return f"${value/1e3:.1f}K"
    else:
        return f"${value:,.2f}"


def _format_currency(value: Optional[float]) -> str:
    """Format as currency."""
    if value is None:
        return "N/A"
    return f"${value:,.2f}"


def _format_percent(value: Optional[float], as_decimal: bool = True) -> str:
    """Format as percentage."""
    if value is None:
        return "N/A"
    if as_decimal:
        return f"{value * 100:.1f}%"
    return f"{value:.1f}%"


def _format_negative_accounting(value: Optional[float]) -> str:
    """Format negative values in accounting format (parentheses)."""
    if value is None:
        return "N/A"
    if value < 0:
        return f"(${abs(value):,.2f})"
    return f"${value:,.2f}"


def _set_cell_value_with_comment(ws, row: int, col: int, display: str, exact_value: Optional[float]):
    """Set cell value with exact value in comment."""
    cell = ws.cell(row=row, column=col, value=display)
    if exact_value is not None:
        cell.comment = Comment(f"Exact: {exact_value:,.2f}", "High Finance")
    return cell


def _auto_width_columns(ws):
    """Auto-size columns based on content."""
    for column_cells in ws.columns:
        max_length = 0
        column = column_cells[0].column_letter
        for cell in column_cells:
            try:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column].width = adjusted_width


def _add_header_row(ws, row: int, headers: List[str]):
    """Add a styled header row."""
    for col, header in enumerate(headers, start=1):
        cell = ws.cell(row=row, column=col, value=header)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = THIN_BORDER


# ═══════════════════════════════════════════════════════════════════════════════
# SHEET CREATION FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _create_summary_sheet(wb: Workbook, project: Any, valuation: Dict, snapshot: Optional[Any] = None):
    """Create Summary tab for full project tearsheet."""
    ws = wb.active
    ws.title = "Summary"

    row = 1

    # Header
    ws.cell(row=row, column=1, value=f"{project.ticker} Research Summary").font = Font(bold=True, size=16)
    row += 1
    ws.cell(row=row, column=1, value=f"Generated: {datetime.now().strftime('%B %d, %Y')}").font = Font(italic=True, color="666666")
    row += 2

    # Project Details
    ws.cell(row=row, column=1, value="Project Details").font = BOLD_FONT
    row += 1

    details = [
        ("Title", project.title),
        ("Ticker", project.ticker),
        ("Status", project.status.capitalize() if project.status else "Active"),
        ("Position", (project.position_type or "Watching").capitalize()),
        ("Conviction", (project.conviction or "Not set").capitalize()),
    ]

    for label, value in details:
        ws.cell(row=row, column=1, value=label)
        ws.cell(row=row, column=2, value=value)
        row += 1

    row += 1

    # Valuation Summary
    ws.cell(row=row, column=1, value="Valuation Summary").font = BOLD_FONT
    row += 1

    current_price = valuation.get("facts", {}).get("current_price")
    fair_value = valuation.get("fair_value_per_share_est")
    upside = valuation.get("upside_downside", {})

    val_data = [
        ("Current Price", _format_currency(current_price)),
        ("DCF Fair Value", _format_currency(fair_value)),
        ("Upside/Downside", _format_percent(upside.get("upside_pct")) if upside else "N/A"),
    ]

    # Add scenario values if available
    scenarios = valuation.get("scenarios", {})
    if scenarios and not scenarios.get("error"):
        val_data.extend([
            ("Bear Case", _format_currency(scenarios.get("bear", {}).get("fair_value_per_share"))),
            ("Base Case", _format_currency(scenarios.get("base", {}).get("fair_value_per_share"))),
            ("Bull Case", _format_currency(scenarios.get("bull", {}).get("fair_value_per_share"))),
        ])

    for label, value in val_data:
        ws.cell(row=row, column=1, value=label)
        cell = ws.cell(row=row, column=2, value=value)
        # Color code upside/downside
        if "Upside" in label and upside:
            pct = upside.get("upside_pct")
            if pct is not None:
                cell.font = Font(color="22C55E" if pct >= 0 else "EF4444", bold=True)
        row += 1

    row += 1

    # Thesis
    ws.cell(row=row, column=1, value="Investment Thesis").font = BOLD_FONT
    row += 1

    bullets = project.thesis_bullets if hasattr(project, 'thesis_bullets') else []
    if bullets:
        for i, bullet in enumerate(sorted(bullets, key=lambda b: b.sort_order)[:50]):
            ws.cell(row=row, column=1, value=f"{i+1}. {bullet.text}")
            row += 1
        if len(bullets) > 50:
            ws.cell(row=row, column=1, value=f"({len(bullets) - 50} additional items not shown)").font = Font(italic=True, color="888888")
            row += 1
    else:
        ws.cell(row=row, column=1, value="Not specified").font = Font(italic=True, color="888888")
        row += 1

    row += 1

    # Risks
    ws.cell(row=row, column=1, value="Key Risks").font = BOLD_FONT
    row += 1

    risks = project.risks if hasattr(project, 'risks') else []
    if risks:
        for i, risk in enumerate(risks[:20]):
            severity_color = {"high": "EF4444", "medium": "F59E0B", "low": "22C55E"}.get(risk.severity, "888888")
            ws.cell(row=row, column=1, value=f"{i+1}. [{risk.severity.upper()}] {risk.title}")
            ws.cell(row=row, column=1).font = Font(color=severity_color)
            if risk.description:
                ws.cell(row=row, column=2, value=risk.description)
            row += 1
        if len(risks) > 20:
            ws.cell(row=row, column=1, value=f"({len(risks) - 20} additional risks not shown)").font = Font(italic=True, color="888888")
            row += 1
    else:
        ws.cell(row=row, column=1, value="Not specified").font = Font(italic=True, color="888888")
        row += 1

    row += 1

    # Catalysts
    ws.cell(row=row, column=1, value="Catalysts").font = BOLD_FONT
    row += 1

    catalysts = project.catalysts if hasattr(project, 'catalysts') else []
    if catalysts:
        for i, cat in enumerate(catalysts[:20]):
            status_icon = {"pending": "", "occurred": "", "missed": ""}.get(cat.status, "")
            ws.cell(row=row, column=1, value=f"{i+1}. {status_icon} {cat.title}")
            if cat.expected_date:
                ws.cell(row=row, column=2, value=f"Expected: {cat.expected_date}")
            row += 1
    else:
        ws.cell(row=row, column=1, value="Not specified").font = Font(italic=True, color="888888")
        row += 1

    row += 2

    # Snapshot disclaimer if using saved snapshot
    if snapshot:
        ws.cell(row=row, column=1,
                value=f"Note: DCF based on snapshot from {snapshot.created_at.strftime('%b %d, %Y')}. Live data may differ.").font = Font(italic=True, color="888888")

    _auto_width_columns(ws)


def _create_valuation_overview_sheet(wb: Workbook, ticker: str, valuation: Dict):
    """Create Valuation Overview tab for quick ticker export."""
    ws = wb.create_sheet("Valuation Overview")

    row = 1

    # Header
    ws.cell(row=row, column=1, value=f"{ticker} Valuation Overview").font = Font(bold=True, size=16)
    row += 1
    ws.cell(row=row, column=1, value=f"Generated: {datetime.now().strftime('%B %d, %Y')}").font = Font(italic=True, color="666666")
    row += 2

    # Company Facts
    ws.cell(row=row, column=1, value="Company Facts").font = BOLD_FONT
    row += 1

    facts = valuation.get("facts", {})
    benchmarks = valuation.get("benchmarks", {})

    fact_data = [
        ("Sector", benchmarks.get("sector", "N/A")),
        ("Industry", benchmarks.get("industry", "N/A")),
        ("Current Price", _format_currency(facts.get("current_price"))),
        ("Revenue (LTM)", _format_large_number(facts.get("revenue0"))),
        ("EBITDA", _format_large_number(facts.get("ebitda"))),
        ("Net Income", _format_large_number(facts.get("net_income"))),
        ("Net Debt", _format_large_number(facts.get("net_debt_est"))),
        ("Shares Outstanding", f"{facts.get('shares_outstanding', 0):,.0f}" if facts.get("shares_outstanding") else "N/A"),
    ]

    for label, value in fact_data:
        ws.cell(row=row, column=1, value=label)
        ws.cell(row=row, column=2, value=value)
        row += 1

    row += 1

    # Valuation Result
    ws.cell(row=row, column=1, value="DCF Valuation").font = BOLD_FONT
    row += 1

    fair_value = valuation.get("fair_value_per_share_est")
    current_price = facts.get("current_price")
    upside = valuation.get("upside_downside", {})

    val_data = [
        ("DCF Fair Value", _format_currency(fair_value)),
        ("Current Price", _format_currency(current_price)),
        ("Upside/Downside", _format_percent(upside.get("upside_pct")) if upside else "N/A"),
        ("Absolute Difference", _format_currency(upside.get("absolute_diff")) if upside else "N/A"),
    ]

    for label, value in val_data:
        ws.cell(row=row, column=1, value=label)
        cell = ws.cell(row=row, column=2, value=value)
        if "Upside" in label and upside:
            pct = upside.get("upside_pct")
            if pct is not None:
                cell.font = Font(color="22C55E" if pct >= 0 else "EF4444", bold=True)
        row += 1

    row += 1

    # Analyst Consensus
    analyst = valuation.get("analyst_consensus", {})
    if analyst.get("target_mean"):
        ws.cell(row=row, column=1, value="Analyst Consensus").font = BOLD_FONT
        row += 1

        analyst_data = [
            ("Mean Target", _format_currency(analyst.get("target_mean"))),
            ("Low Target", _format_currency(analyst.get("target_low"))),
            ("High Target", _format_currency(analyst.get("target_high"))),
            ("# Analysts", str(analyst.get("num_analysts", "N/A"))),
            ("Recommendation", (analyst.get("recommendation") or "N/A").upper()),
        ]

        for label, value in analyst_data:
            ws.cell(row=row, column=1, value=label)
            ws.cell(row=row, column=2, value=value)
            row += 1

    _auto_width_columns(ws)


def _create_dcf_sheet(wb: Workbook, valuation: Dict, inputs: Dict):
    """Create DCF Model tab."""
    ws = wb.create_sheet("DCF Model")

    row = 1

    # Header
    ws.cell(row=row, column=1, value="Discounted Cash Flow Model").font = Font(bold=True, size=16)
    row += 2

    # Assumptions (yellow background - user inputs)
    ws.cell(row=row, column=1, value="Model Assumptions").font = BOLD_FONT
    row += 1

    # Use provided inputs or fall back to valuation inputs
    model_inputs = inputs if inputs else valuation.get("inputs", {})

    assumptions = [
        ("Revenue Growth (5Y CAGR)", _format_percent(model_inputs.get("growth")), "growth"),
        ("Operating Margin", _format_percent(model_inputs.get("margin")), "margin"),
        ("Tax Rate", _format_percent(model_inputs.get("tax")), "tax"),
        ("WACC (Discount Rate)", _format_percent(model_inputs.get("wacc")), "wacc"),
        ("Terminal Growth Rate", _format_percent(model_inputs.get("terminal_g")), "terminal_g"),
    ]

    _add_header_row(ws, row, ["Assumption", "Value", ""])
    row += 1

    for label, value, key in assumptions:
        ws.cell(row=row, column=1, value=label)
        cell = ws.cell(row=row, column=2, value=value)
        cell.fill = YELLOW_FILL  # User assumptions in yellow
        cell.border = THIN_BORDER
        row += 1

    row += 1

    # DCF Results
    ws.cell(row=row, column=1, value="DCF Results").font = BOLD_FONT
    row += 1

    dcf = valuation.get("dcf", {})
    facts = valuation.get("facts", {})

    # FCFF Projections
    fcff = dcf.get("fcff_projection", [])
    if fcff:
        _add_header_row(ws, row, ["Year"] + [f"Year {i+1}" for i in range(len(fcff))])
        row += 1
        ws.cell(row=row, column=1, value="FCFF")
        for col, value in enumerate(fcff, start=2):
            cell = ws.cell(row=row, column=col, value=_format_large_number(value))
            cell.fill = LIGHT_BLUE_FILL  # Calculated values in blue
            cell.border = THIN_BORDER
        row += 2

    # Summary values
    dcf_results = [
        ("PV of Explicit Period", _format_large_number(dcf.get("pv_explicit")), dcf.get("pv_explicit")),
        ("Terminal Value", _format_large_number(dcf.get("terminal_value")), dcf.get("terminal_value")),
        ("PV of Terminal Value", _format_large_number(dcf.get("pv_terminal")), dcf.get("pv_terminal")),
        ("Enterprise Value", _format_large_number(dcf.get("enterprise_value")), dcf.get("enterprise_value")),
        ("Less: Net Debt", _format_large_number(facts.get("net_debt_est")), facts.get("net_debt_est")),
        ("Equity Value", _format_large_number(valuation.get("equity_value_est")), valuation.get("equity_value_est")),
        ("Shares Outstanding", f"{facts.get('shares_outstanding', 0):,.0f}" if facts.get("shares_outstanding") else "N/A", None),
        ("Fair Value per Share", _format_currency(valuation.get("fair_value_per_share_est")), valuation.get("fair_value_per_share_est")),
    ]

    for label, display, exact in dcf_results:
        ws.cell(row=row, column=1, value=label)
        cell = ws.cell(row=row, column=2, value=display)
        cell.fill = LIGHT_BLUE_FILL
        cell.border = THIN_BORDER
        if exact is not None:
            cell.comment = Comment(f"Exact: {exact:,.2f}", "High Finance")
        row += 1

    row += 1

    # Terminal value warning
    tv_pct = dcf.get("terminal_pct_of_ev")
    if tv_pct is not None:
        tv_warning = f"Note: Terminal value represents {tv_pct*100:.1f}% of Enterprise Value"
        if tv_pct > 0.70:
            tv_warning += " (high reliance on long-term assumptions)"
        ws.cell(row=row, column=1, value=tv_warning).font = Font(italic=True, color="888888")

    _auto_width_columns(ws)


def _create_financials_sheet(wb: Workbook, financials: Dict):
    """Create Financials tab with income statement."""
    ws = wb.create_sheet("Financials")

    row = 1

    ws.cell(row=row, column=1, value="Income Statement (Annual)").font = Font(bold=True, size=16)
    row += 2

    annual_is = financials.get("annual", {}).get("income_statement", {})

    if not annual_is:
        ws.cell(row=row, column=1, value="No financial data available").font = Font(italic=True, color="888888")
        return

    # Get sorted columns (years)
    columns = sorted(annual_is.keys(), reverse=True)[:5]  # Last 5 years

    # Header
    _add_header_row(ws, row, ["Line Item"] + columns)
    row += 1

    # Key line items to display
    line_items = [
        ("Total Revenue", ["Total Revenue", "TotalRevenue", "Revenue"]),
        ("Cost of Revenue", ["Cost Of Revenue", "CostOfRevenue"]),
        ("Gross Profit", ["Gross Profit", "GrossProfit"]),
        ("Operating Expenses", ["Operating Expense", "OperatingExpense", "Operating Expenses"]),
        ("Operating Income", ["Operating Income", "OperatingIncome", "EBIT"]),
        ("Interest Expense", ["Interest Expense", "InterestExpense"]),
        ("Pretax Income", ["Pretax Income", "Income Before Tax", "EBT"]),
        ("Tax Expense", ["Tax Provision", "Income Tax Expense"]),
        ("Net Income", ["Net Income", "NetIncome", "Net Income Common Stockholders"]),
        ("EBITDA", ["EBITDA", "Ebitda"]),
        ("EPS (Basic)", ["Basic EPS", "BasicEPS"]),
    ]

    for label, keys in line_items:
        ws.cell(row=row, column=1, value=label)
        for col_idx, year in enumerate(columns, start=2):
            year_data = annual_is.get(year, {})
            value = None
            for key in keys:
                if key in year_data:
                    value = year_data[key]
                    break

            if value is not None:
                cell = ws.cell(row=row, column=col_idx, value=_format_large_number(value))
                if value < 0:
                    cell.font = RED_FONT
                cell.border = THIN_BORDER
            else:
                ws.cell(row=row, column=col_idx, value="—").font = Font(color="888888")
        row += 1

    _auto_width_columns(ws)


def _create_scenarios_sheet(wb: Workbook, valuation: Dict):
    """Create Scenarios tab with Bear/Base/Bull analysis."""
    scenarios = valuation.get("scenarios", {})

    if not scenarios or scenarios.get("error"):
        return  # Don't create tab if no scenarios

    ws = wb.create_sheet("Scenarios")

    row = 1

    ws.cell(row=row, column=1, value="Scenario Analysis").font = Font(bold=True, size=16)
    row += 1
    ws.cell(row=row, column=1, value="Bear, Base, and Bull case valuations").font = Font(italic=True, color="666666")
    row += 2

    current_price = valuation.get("facts", {}).get("current_price")

    # Headers
    _add_header_row(ws, row, ["Metric", "Bear Case", "Base Case", "Bull Case"])
    row += 1

    scenario_order = ["bear", "base", "bull"]
    colors = {"bear": RED_FILL, "base": LIGHT_BLUE_FILL, "bull": GREEN_FILL}

    # Fair Value row
    ws.cell(row=row, column=1, value="Fair Value per Share")
    for col_idx, scenario in enumerate(scenario_order, start=2):
        s = scenarios.get(scenario, {})
        fv = s.get("fair_value_per_share")
        cell = ws.cell(row=row, column=col_idx, value=_format_currency(fv))
        cell.fill = colors[scenario]
        cell.font = BOLD_FONT
        cell.border = THIN_BORDER
    row += 1

    # Upside/Downside row
    if current_price:
        ws.cell(row=row, column=1, value="Upside/Downside vs Current")
        for col_idx, scenario in enumerate(scenario_order, start=2):
            s = scenarios.get(scenario, {})
            fv = s.get("fair_value_per_share")
            if fv and current_price > 0:
                upside = (fv - current_price) / current_price
                cell = ws.cell(row=row, column=col_idx, value=_format_percent(upside))
                cell.font = Font(color="22C55E" if upside >= 0 else "EF4444", bold=True)
                cell.border = THIN_BORDER
        row += 1

    # Enterprise Value row
    ws.cell(row=row, column=1, value="Enterprise Value")
    for col_idx, scenario in enumerate(scenario_order, start=2):
        s = scenarios.get(scenario, {})
        cell = ws.cell(row=row, column=col_idx, value=_format_large_number(s.get("enterprise_value")))
        cell.border = THIN_BORDER
    row += 1

    # Equity Value row
    ws.cell(row=row, column=1, value="Equity Value")
    for col_idx, scenario in enumerate(scenario_order, start=2):
        s = scenarios.get(scenario, {})
        cell = ws.cell(row=row, column=col_idx, value=_format_large_number(s.get("equity_value")))
        cell.border = THIN_BORDER
    row += 2

    # Assumptions section
    ws.cell(row=row, column=1, value="Scenario Assumptions").font = BOLD_FONT
    row += 1

    _add_header_row(ws, row, ["Assumption", "Bear Case", "Base Case", "Bull Case"])
    row += 1

    assumption_labels = [
        ("Growth Rate", "growth"),
        ("Operating Margin", "margin"),
        ("Tax Rate", "tax"),
        ("WACC", "wacc"),
        ("Terminal Growth", "terminal_g"),
    ]

    for label, key in assumption_labels:
        ws.cell(row=row, column=1, value=label)
        for col_idx, scenario in enumerate(scenario_order, start=2):
            s = scenarios.get(scenario, {})
            inputs = s.get("inputs", {})
            value = inputs.get(key)
            cell = ws.cell(row=row, column=col_idx, value=_format_percent(value))
            cell.fill = YELLOW_FILL
            cell.border = THIN_BORDER
        row += 1

    _auto_width_columns(ws)


def _workbook_to_bytes(wb: Workbook) -> BytesIO:
    """Convert workbook to BytesIO for streaming response."""
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN EXPORT FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

async def generate_project_tearsheet(
    project_id: int,
    user_id: str,
    db: Session,
) -> BytesIO:
    """
    Generate full tearsheet Excel for a research project.

    Creates 4 tabs:
    1. Summary - Project details, thesis, risks, catalysts
    2. DCF Model - Assumptions and calculations
    3. Financials - Income statement history
    4. Scenarios - Bear/Base/Bull analysis (if available)
    """
    # Get project
    project = await get_project(db, project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")

    # Get latest DCF snapshot inputs or use defaults
    snapshot = None
    inputs = {}
    if project.dcf_snapshots:
        snapshot = project.dcf_snapshots[0]  # Most recent
        inputs = {
            "growth": snapshot.growth,
            "margin": snapshot.margin,
            "tax": snapshot.tax,
            "wacc": snapshot.wacc,
            "terminal_g": snapshot.terminal_g,
        }

    # Get valuation data
    valuation = await get_valuation_bundle(
        project.ticker,
        growth=inputs.get("growth"),
        margin=inputs.get("margin"),
        tax=inputs.get("tax"),
        wacc=inputs.get("wacc"),
        terminal_g=inputs.get("terminal_g"),
    )

    if valuation.get("error"):
        raise ValueError(f"Valuation error: {valuation['error']}")

    # Get financials
    financials = await get_financial_statements(project.ticker)

    # Create workbook
    wb = Workbook()

    # Create sheets
    _create_summary_sheet(wb, project, valuation, snapshot)
    _create_dcf_sheet(wb, valuation, inputs)
    _create_financials_sheet(wb, financials)

    # Only create scenarios sheet if data is available
    if valuation.get("scenarios") and not valuation.get("scenarios", {}).get("error"):
        _create_scenarios_sheet(wb, valuation)

    logger.info(f"Generated tearsheet for project {project_id} ticker={project.ticker} user={user_id}")

    return _workbook_to_bytes(wb)


async def generate_ticker_export(
    ticker: str,
    inputs: Dict[str, Optional[float]],
    user_id: str,
    db: Session,
) -> BytesIO:
    """
    Generate quick export Excel for a ticker.

    Creates 3 tabs:
    1. Valuation Overview - Key facts and DCF result
    2. DCF Model - Assumptions and calculations
    3. Scenarios - Bear/Base/Bull analysis (if available)
    """
    # Get valuation with provided inputs (None values use smart defaults)
    valuation = await get_valuation_bundle(
        ticker,
        growth=inputs.get("growth"),
        margin=inputs.get("margin"),
        tax=inputs.get("tax"),
        wacc=inputs.get("wacc"),
        terminal_g=inputs.get("terminal_g"),
    )

    if valuation.get("error"):
        raise ValueError(f"Ticker '{ticker}' not found or delisted. Export unavailable.")

    # Create workbook
    wb = Workbook()

    # Remove default sheet and create our tabs
    wb.remove(wb.active)

    _create_valuation_overview_sheet(wb, ticker, valuation)
    _create_dcf_sheet(wb, valuation, inputs)

    # Only create scenarios sheet if data is available
    if valuation.get("scenarios") and not valuation.get("scenarios", {}).get("error"):
        _create_scenarios_sheet(wb, valuation)

    # Move Valuation Overview to first position
    ws_overview = wb["Valuation Overview"]
    wb.move_sheet(ws_overview, offset=-len(wb.sheetnames)+1)

    logger.info(f"Generated ticker export for {ticker} user={user_id}")

    return _workbook_to_bytes(wb)
