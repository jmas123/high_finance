// ═══════════════════════════════════════════════════════════════════════════════
// Centralized tooltip text for every domain in High Finance
// ═══════════════════════════════════════════════════════════════════════════════

// ── Valuation / DCF ──────────────────────────────────────────────────────────

export const VALUATION_TIPS: Record<string, string> = {
  dcf_fair_value:
    "Discounted Cash Flow fair value — the estimated intrinsic price based on projected future cash flows discounted back to today.",
  wacc:
    "Weighted Average Cost of Capital — the blended rate a company pays to finance its operations (debt + equity). Used as the discount rate in DCF. Lower WACC = higher present value.",
  cagr:
    "Compound Annual Growth Rate — the smoothed annual rate at which a metric (like revenue) grew over a period. Removes year-to-year noise.",
  ebitda:
    "Earnings Before Interest, Taxes, Depreciation & Amortization — a proxy for operating cash flow. Strips out financing and accounting decisions so you can compare companies.",
  terminal_growth:
    "The rate at which free cash flows grow forever after the projection period. Usually 2-3% (roughly GDP growth). Higher values dramatically increase valuation.",
  enterprise_value:
    "Total company value = market cap + debt − cash. What an acquirer would pay. Used in EV/EBITDA and other relative metrics.",
  net_debt:
    "Total debt minus cash & equivalents. Negative net debt means the company has more cash than debt — a strong balance sheet signal.",
  ltm:
    "Last Twelve Months — trailing 12-month figures. More current than annual reports since they include the most recent quarters.",
  operating_margin:
    "Operating income ÷ revenue. Shows what percentage of each dollar of revenue becomes profit from core operations, before interest and taxes.",
  sensitivity:
    "Shows how fair value changes when you adjust two key assumptions simultaneously (e.g., WACC and terminal growth). Helps you see which assumptions matter most.",
  multiples:
    "Valuation ratios (like EV/EBITDA, P/E) compared to industry peers. Quick sanity check — if your DCF implies 50x earnings but peers trade at 15x, investigate why.",
  scenario_analysis:
    "Bear/Base/Bull scenarios with different growth and margin assumptions. Shows the range of possible fair values, not just a single point estimate.",
  bear_scenario:
    "Pessimistic case — lower growth, compressed margins. Represents a downside scenario such as recession or competitive pressure.",
  base_scenario:
    "Most likely case — uses current assumptions. Should be your best estimate of reality.",
  bull_scenario:
    "Optimistic case — higher growth, margin expansion. Represents accelerated revenue or successful new products.",
  terminal_pct_ev:
    "What percentage of enterprise value comes from the terminal value (cash flows beyond year 5). If this exceeds 80%, the valuation is very sensitive to terminal assumptions.",
  revenue_ltm:
    "Trailing 12-month revenue — the most recent four quarters of total sales.",
  street_consensus:
    "The average analyst price target from Wall Street. Useful as a benchmark but remember: consensus is often wrong at extremes.",
  fcf_yield:
    "Free Cash Flow ÷ Market Cap. How much cash the business generates relative to its price. Higher = cheaper. Think of it like an earnings yield but using actual cash.",
};

// ── Risk / Monte Carlo ───────────────────────────────────────────────────────

export const RISK_TIPS: Record<string, string> = {
  monte_carlo:
    "Monte Carlo simulation runs thousands of random price paths based on historical volatility to estimate the probability distribution of future returns.",
  var_95:
    "Value at Risk (95%) — the loss you'd expect to exceed only 5% of the time. If VaR 95% is −12%, there's a 5% chance of losing more than 12%.",
  var_99:
    "Value at Risk (99%) — the loss exceeded only 1% of the time. More extreme than VaR 95. Used for tail risk assessment.",
  p5: "5th percentile — only 5% of simulated outcomes are worse than this. A severe downside scenario.",
  p10: "10th percentile — 10% of outcomes are worse. A moderately pessimistic scenario.",
  p50: "50th percentile (median) — half of outcomes are better, half are worse. The 'expected' outcome.",
  p90: "90th percentile — only 10% of outcomes are better. A moderately optimistic scenario.",
  p95: "95th percentile — only 5% of outcomes are better. An extremely optimistic scenario.",
  vol_multiplier:
    "Scales the historical volatility used in simulations. 1.0x = historical vol. 1.5x = 50% more volatile (stress test). 0.5x = calmer than history.",
  max_drawdown:
    "The largest peak-to-trough decline in a simulated or historical price series. Shows worst-case pain. −20% means at worst you'd be down 20% from the peak.",
  daily_vol:
    "Daily volatility — standard deviation of daily returns. 2% daily vol means on a typical day, the stock moves ±2%.",
  annualized_vol:
    "Daily volatility × √252 (trading days/year). Approximates the range of annual returns. 30% annual vol = wide range of outcomes.",
  earnings_shock:
    "Simulates a sudden one-day price drop (like a bad earnings report) at a random point during the simulation. Tests how your portfolio handles gap risk.",
  drawdown_alert:
    "Sets a threshold for maximum drawdown. If simulations show drawdown exceeding this level, it triggers a warning.",
  fan_chart:
    "Shows the range of simulated price paths over time. Wider fan = more uncertainty. The dark center band is the most likely range (p25–p75).",
  distribution:
    "Histogram of simulated terminal returns. Shows the full range of possible outcomes and their relative likelihood.",
  simulations:
    "Number of random price paths generated. More simulations = smoother, more stable results. 10,000 is usually enough; 50,000 for precision.",
  data_period:
    "Historical window used to estimate volatility and drift. 6M captures recent behavior; 2Y provides more statistical stability but may include outdated regimes.",
};

// ── Screener ─────────────────────────────────────────────────────────────────

export const SCREENER_TIPS: Record<string, string> = {
  pe:
    "Price-to-Earnings ratio — stock price ÷ earnings per share. Lower P/E may indicate a bargain (or low growth). Higher P/E may indicate optimism (or overvaluation).",
  fwd_pe:
    "Forward P/E — price ÷ estimated next-year earnings. Uses analyst estimates, so it reflects expectations rather than trailing results.",
  pb:
    "Price-to-Book — market price ÷ book value per share. Below 1.0 means the stock trades below the accounting value of its assets.",
  ev_ebitda:
    "Enterprise Value ÷ EBITDA — a capital-structure-neutral valuation multiple. Lower = cheaper. More comparable across companies than P/E because it ignores debt differences.",
  roe:
    "Return on Equity — net income ÷ shareholders' equity. Measures how efficiently a company uses investor capital to generate profit. 15%+ is generally strong.",
  margin:
    "Net profit margin — net income ÷ revenue. What percentage of each dollar of revenue the company keeps as profit after all expenses.",
  de:
    "Debt-to-Equity ratio — total debt ÷ shareholders' equity. Higher = more leverage. Above 2.0 is considered highly leveraged for most industries.",
  fcf_yield:
    "Free Cash Flow Yield — FCF per share ÷ price. Shows how much cash the business generates relative to its market price. Higher = better value.",
  beta:
    "Measures stock volatility relative to the market. Beta 1.0 = moves with the market. >1 = more volatile. <1 = less volatile. Negative = inverse.",
  rev_growth:
    "Revenue growth rate (year-over-year). Shows how fast the company's top line is growing. Negative = revenue declining.",
  div_yield:
    "Annual dividend ÷ stock price. The cash return from dividends alone. 2-4% is typical for dividend stocks.",
  insider_net:
    "Net insider buying — purchases minus sales by executives and directors. Positive = insiders are buying (bullish signal). Negative = selling.",
  mkt_cap:
    "Market Capitalization — share price × shares outstanding. The total market value of a company. Mega (>$200B), Large (>$10B), Mid (>$2B), Small (<$2B).",
  one_day_chg:
    "Today's percentage price change. Green = up, red = down.",
};

// ── Congress / Politicians ───────────────────────────────────────────────────

export const CONGRESS_TIPS: Record<string, string> = {
  backtest:
    "Simulates what would have happened if you copied a politician's stock trades with a delay. Uses actual disclosed trades and real historical prices.",
  copy_delay:
    "Days after the trade date before you 'copy' the trade. Members must disclose within 45 days, so realistic delays are 1–45 days.",
  hold_period:
    "How long you hold each copied position before selling. Shorter = more trading. Longer = more exposure to the member's conviction.",
  win_rate:
    "Percentage of trades that were profitable when closed. 50%+ is better than a coin flip, but also depends on how big the wins vs losses are.",
  recent_hit_rate:
    "Percentage of the last 10 buy trades with positive returns within 30 days of the transaction date. Only includes purchases — sells are excluded because their signal is ambiguous.",
  alpha_vs_spy:
    "Excess return above the S&P 500 over the same period. Positive alpha = the politician's trades beat the market. Negative = underperformed.",
  max_dd:
    "Maximum drawdown — the largest peak-to-trough loss during the backtest period. Shows worst-case pain from copying this politician.",
  ann_return:
    "Annualized return — the compound annual growth rate of the backtest portfolio. Allows comparison across different time periods.",
  equity_curve:
    "A line chart showing the portfolio value over time starting from $10,000. Steeper slope = better returns. Dips = drawdowns.",
  cohort:
    "The group of trades used in the backtest. Filtered by date range, party, chamber, or other criteria.",
  sharpe_ratio:
    "Risk-adjusted return = (Return − Risk Free Rate) ÷ Volatility. >1 is good, >2 is excellent. Measures return per unit of risk taken.",
  grade:
    "A letter grade (A–F) summarizing backtest performance. Based on alpha, win rate, Sharpe ratio, and consistency.",
  short_history:
    "This member has fewer than 20 disclosed trades, so backtest statistics may not be reliable. Take results with a grain of salt.",
  disclosure_date:
    "The date the trade was publicly disclosed (filed with Congress). Can be up to 45 days after the actual trade date.",
  trade_date:
    "The actual date the trade was executed. Not the same as disclosure date — there's often a reporting lag.",
  cohort_return:
    "The return of all trades in this cohort (group). Compares the politician's picks to a buy-and-hold benchmark.",
  data_quality:
    "Shows how many raw trades survive each filtering step: valid tickers → price data available → clean enough for backtest.",
  capitol_activity:
    "Recent stock trades disclosed by this member of Congress under the STOCK Act.",
};

// ── Earnings ─────────────────────────────────────────────────────────────────

export const EARNINGS_TIPS: Record<string, string> = {
  item_2_02:
    "SEC 8-K Item 2.02 — 'Results of Operations and Financial Condition.' Companies file this form to announce quarterly earnings. It's the official disclosure.",
  beat:
    "The company reported earnings above analyst consensus estimates. Typically a positive signal, though the stock reaction depends on the size of the beat and forward guidance.",
  miss:
    "Earnings came in below analyst estimates. Often triggers a sell-off, but reaction depends on the magnitude and whether guidance was raised.",
  inline:
    "Earnings matched analyst expectations (within a small margin). Stock reaction usually depends more on forward guidance than the in-line result.",
  surprise_pct:
    "How far actual earnings deviated from consensus estimates, as a percentage. +5% = beat by 5%. Larger surprises tend to cause bigger price moves.",
  yoy:
    "Year-over-Year — compares this quarter's result to the same quarter last year. Removes seasonal effects (Q4 is naturally higher for retail, for example).",
  forward_guidance:
    "Management's outlook for future quarters. Often moves the stock more than the current quarter's results because markets are forward-looking.",
  guidance_tone:
    "Whether management's commentary was optimistic, cautious, or neutral. Derived from the language used in the earnings call or press release.",
  sentiment:
    "AI-analyzed sentiment of the earnings report and call transcript. Positive/Negative/Neutral based on language patterns.",
  confidence:
    "How confident the AI model is in its sentiment assessment. Based on the strength and consistency of language signals in the report.",
};

// ── Dashboard ────────────────────────────────────────────────────────────────

export const DASHBOARD_TIPS: Record<string, string> = {
  long:
    "Stocks you own or plan to buy. Your bullish positions — you profit when the price goes up.",
  short:
    "Stocks you're betting against (or want to track as potential sells). You'd profit if the price goes down.",
  watch:
    "Stocks you're monitoring but haven't committed to a position on yet. Your research pipeline.",
  active_research:
    "Tickers you've recently viewed or run analyses on. Quick links to continue your research.",
};

// ── Navigation ───────────────────────────────────────────────────────────────

export const NAV_TIPS: Record<string, string> = {
  screener:
    "Filter stocks by fundamentals (P/E, growth, margins, etc.) to find investment candidates that match your criteria.",
  congress:
    "Track and backtest stock trades disclosed by members of Congress under the STOCK Act.",
  signals:
    "Alerts and notifications — news for your watchlist, portfolio updates, and recent congressional trade disclosures.",
};

// ── Prediction / ML ──────────────────────────────────────────────────────────

export const PREDICTION_TIPS: Record<string, string> = {
  direction_accuracy:
    "Percentage of times the model correctly predicted whether the stock would go up or down over the forecast horizon.",
  baseline_accuracy:
    "Accuracy if the model always predicted the majority outcome (usually UP). The model must beat this to be useful.",
  accuracy_vs_baseline:
    "How much better (or worse) the model is vs. always predicting UP. Positive = model adds value over naive baseline.",
  gated_accuracy:
    "Accuracy only on days where the model had a clear signal (probability above 58% or below 42%). This is the model's accuracy when it's most confident.",
  information_coefficient:
    "Rank correlation between predicted probabilities and actual returns. IC > 0.05 is meaningful. IC > 0.10 is excellent. This is the gold-standard metric in quantitative finance.",
  r_squared:
    "R² measures how well the model explains variance in returns. 0 = no power, 1 = perfect. In finance, even 0.01-0.05 can be meaningful.",
  sharpe_ratio:
    "Risk-adjusted return = (Return − Risk Free Rate) ÷ Volatility. >1 is good, >2 is very good. Measures return per unit of risk.",
  calmar_ratio:
    "Annualized return divided by max drawdown. Measures how much return you get per unit of worst-case pain. More intuitive than Sharpe for most people.",
  annual_return:
    "Strategy's projected yearly return based on backtest. Assumes similar market conditions continue.",
  annual_volatility:
    "Standard deviation of returns annualized. Higher = more risk.",
  max_drawdown:
    "Largest peak-to-trough decline during backtest. −10% means at worst you'd be down 10% from your high point.",
  win_rate:
    "Percentage of trading days that were profitable. >50% needed for profit, but depends on avg win vs avg loss size.",
  selectivity:
    "Percentage of days the model actually takes a position (vs. sitting flat). Lower selectivity = model is more selective, only trading when confident.",
  buy_hold_sharpe:
    "Sharpe ratio if you simply bought and held. Compare to strategy Sharpe to see if the model adds value.",
  buy_hold_return:
    "Total return from buying at start of test period and holding. The benchmark for any active strategy.",
  alpha:
    "Excess return vs buy-and-hold. Positive alpha = strategy beat passive investing.",
  signal:
    "Model's current conviction. BULLISH (>58% probability UP), BEARISH (<42% UP), NEUTRAL (42-58% — model says 'I don't know').",
  probability:
    "The model's estimated probability that the stock goes UP over the forecast horizon. Based on calibrated GBM classifier probabilities.",
  walk_forward:
    "Walk-forward validation trains on expanding windows and tests on subsequent periods with a purge gap to prevent look-ahead bias. Shows how the model performs across different market regimes.",
  bootstrap_ci:
    "Bootstrap resampling of the test set to estimate the statistical uncertainty of direction accuracy. The 95% CI tells you the range where the true accuracy likely falls.",
  factor_attribution:
    "Decomposes strategy returns into market exposure (beta) and genuine skill (alpha). Most ML strategies' 'alpha' is actually just leveraged beta.",
  factor_alpha:
    "Annualized return after removing market exposure. Positive alpha = the model adds value beyond just following the market.",
  factor_beta:
    "Market exposure of the strategy. Beta = 1.0 means it moves 1:1 with SPY.",
  feature_importance:
    "How much each input contributes to predictions. Higher % = model relies more on this indicator.",
  backtest:
    "Simulates how the confidence-gated strategy would have performed historically. Includes transaction costs and weekly rebalancing.",
  model_health:
    "Key metadata about the model: what it was trained on, its prediction horizon, and the current market regime.",
  rsi:
    "Relative Strength Index (0-100). >70 = overbought (may fall), <30 = oversold (may rise).",
  macd:
    "Moving Average Convergence Divergence. Positive = bullish momentum, Negative = bearish.",
  trend:
    "Based on 50-day vs 200-day moving average. Bullish = 50 > 200 (golden cross).",
  volatility:
    "20-day rolling standard deviation of returns. Higher = bigger price swings.",
  ma_ratio:
    "Current price relative to moving average. Positive = trading above average (bullish).",
  volume_ratio:
    "Current volume vs 20-day average. >1 = higher than normal activity.",
  bb_position:
    "Bollinger Band position. 0 = at the middle band. +1/−1 = at upper/lower band. Beyond ±1 = extreme.",
  vol_regime:
    "20-day vol / 60-day vol. >1.3 = volatility expanding, <0.7 = compressing.",
};
