import os
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

async def analyze_financials(ticker: str, financials: dict) -> str:
    """Generate AI analysis of financial statements."""
    
    # Extract key metrics for the prompt
    income = financials.get("income_statement", {})
    balance = financials.get("balance_sheet", {})
    cashflow = financials.get("cash_flow", {})
    
    # Get most recent year's data
    latest_income = next(iter(income.values()), {}) if income else {}
    latest_balance = next(iter(balance.values()), {}) if balance else {}
    latest_cashflow = next(iter(cashflow.values()), {}) if cashflow else {}
    prompt = f"""
Act as a Senior Equity Research Analyst. Perform a deep-dive financial health assessment for {ticker} using the provided data. 

### GOAL:
Determine if the company is fundamentally "High Quality," "Average," or "Distressed" and assign a conviction score from 1-10.

### ANALYSIS REQUIREMENTS:
1. **Profitability & Efficiency:** Calculate and interpret the Gross and EBITDA margins. Evaluate the 'Quality of Earnings' by comparing Net Income to Operating Cash Flow—is the profit backed by hard cash?
2. **Capital Structure & Solvency:** Calculate the Debt-to-Equity ratio and the Cash-to-Debt ratio. Can the company cover its obligations? Discuss the risk of the current leverage.
3. **Cash Flow Dynamics:** Analyze the FCF conversion (FCF / EBITDA). Is the company's CapEx sustainable relative to its operating cash? 
4. **The "Why":** Identify the single most compelling reason to be bullish or bearish based solely on these numbers.

### DATA INPUTS:
- INCOME STATEMENT: Revenue ${latest_income.get('Total Revenue', 0):,.0f}, Gross Profit ${latest_income.get('Gross Profit', 0):,.0f}, Operating Income ${latest_income.get('Operating Income', 0):,.0f}, Net Income ${latest_income.get('Net Income', 0):,.0f}, EBITDA ${latest_income.get('EBITDA', 0):,.0f}
- BALANCE SHEET: Assets ${latest_balance.get('Total Assets', 0):,.0f}, Debt ${latest_balance.get('Total Debt', 0):,.0f}, Cash ${latest_balance.get('Cash And Cash Equivalents', 0):,.0f}, Equity ${latest_balance.get('Total Equity Gross Minority Interest', 0):,.0f}
- CASH FLOW: Op. Cash Flow ${latest_cashflow.get('Operating Cash Flow', 0):,.0f}, FCF ${latest_cashflow.get('Free Cash Flow', 0):,.0f}, CapEx ${latest_cashflow.get('Capital Expenditure', 0):,.0f}

### OUTPUT FORMAT:
- **Executive Summary:** (2 sentences)
- **Financial Health Score:** (1-10)
- **Detailed Analysis:** (Bullet points for the 4 requirements above)
- **The Red Flag/Golden Star:** (One specific numerical reason for the score)
"""


    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a financial analyst providing clear, educational analysis for finance students. Be specific and reference actual numbers."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=800,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Analysis unavailable: {str(e)}"