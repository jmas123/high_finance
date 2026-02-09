import { useState } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "../../lib/useIsMobile";

// ── Accordion Section Data ───────────────────────────────────────────────────
type Section = {
  id: string;
  emoji: string;
  title: string;
  whatItDoes: string;
  controls: { name: string; description: string }[];
  tips: string[];
  tryIt: { label: string; to: string };
};

const SECTIONS: Section[] = [
  {
    id: "dcf",
    emoji: "\uD83D\uDCCA",
    title: "DCF Valuation",
    whatItDoes:
      "Discounted Cash Flow (DCF) estimates what a company is worth today based on projected future cash flows. " +
      "You adjust assumptions with sliders and the model recalculates a fair value per share in real time. " +
      "A divergence banner appears when your assumptions differ significantly from what the market price implies.",
    controls: [
      { name: "Revenue Growth (%)", description: "How fast you expect top-line revenue to grow annually over the next 5 years." },
      { name: "Operating Margin (%)", description: "What fraction of revenue converts to operating profit. Higher = more efficient." },
      { name: "Tax Rate (%)", description: "Effective corporate tax rate applied to operating income." },
      { name: "WACC (%)", description: "Weighted Average Cost of Capital \u2014 the discount rate. Higher WACC = lower present value. Should never be below risk-free rate + 4%." },
      { name: "Terminal Growth (%)", description: "The perpetual growth rate after the projection period. Usually 2\u20133% (around GDP growth)." },
      { name: "Market-Implied Assumptions", description: "Reverse-engineers what growth/margin the current stock price implies. Click \"Use Market-Implied\" to load those values." },
      { name: "AI Suggestions", description: "Claude analyzes the company\u2019s financials and suggests slider values with reasoning." },
    ],
    tips: [
      "Start with market-implied assumptions to see what the market \"believes,\" then adjust where you disagree.",
      "Small changes to WACC or terminal growth have outsized effects on fair value \u2014 that\u2019s normal for DCF models.",
      "The reference markers (gray dots) on each slider show the market-implied value so you can see how far you\u2019ve deviated.",
    ],
    tryIt: { label: "Try it with AAPL", to: "/quote/AAPL" },
  },
  {
    id: "risk",
    emoji: "\uD83C\uDFB2",
    title: "Risk & Probability",
    whatItDoes:
      "Runs a Monte Carlo simulation \u2014 thousands of random price paths based on historical volatility \u2014 to estimate " +
      "the probability distribution of future returns. Instead of a single price target, you get a range of outcomes with confidence levels.",
    controls: [
      { name: "Horizon (days)", description: "How far into the future to simulate. Longer horizons have wider distributions." },
      { name: "Volatility Multiplier", description: "Scales the historical volatility up or down. Use >1x if you expect a catalyst (earnings, FDA decision)." },
      { name: "Earnings Shock Toggle", description: "Adds extra variance around earnings dates to model the typical post-earnings jump." },
      { name: "Target Price ($)", description: "Set a specific price and see the probability of reaching it within the horizon." },
      { name: "Scenario Table (p5\u2013p95)", description: "p5 = 5th percentile (worst 5% of outcomes), p50 = median, p95 = best 5%. Shows price targets for each." },
    ],
    tips: [
      "The fan chart widens over time \u2014 that\u2019s uncertainty compounding. Wider = more uncertain.",
      "Compare the p50 (median outcome) to your DCF fair value. If they\u2019re far apart, the market may be pricing in something your model isn\u2019t.",
      "Volatility multiplier is useful before known events: set it to 1.5\u20132x before earnings to see the wider range.",
    ],
    tryIt: { label: "Try it with MSFT", to: "/quote/MSFT" },
  },
  {
    id: "ml-prediction",
    emoji: "\uD83E\uDD16",
    title: "ML Prediction",
    whatItDoes:
      "Trains a gradient boosting classifier on 5 years of historical price data to predict the stock\u2019s 5-day direction. " +
      "Uses walk-forward backtesting (no future data leakage) and outputs a calibrated probability with confidence gates. " +
      "Also decomposes returns into alpha (stock-specific edge) vs beta (market exposure) so you can see if the signal is real.",
    controls: [
      { name: "Run ML Prediction", description: "Trains the model on-demand. Takes a few seconds \u2014 results are cached after the first run." },
      { name: "Signal (Bullish / Bearish / No Signal)", description: "The model\u2019s directional call. \"No Signal\" means probability is in the 42\u201358% dead zone where there\u2019s no statistical edge." },
      { name: "Confidence & Probability", description: "How far outside the dead zone the prediction is. Higher = stronger conviction from the model." },
      { name: "Sharpe Ratio", description: "Risk-adjusted return of the strategy in backtesting. Above 1.0 is good; above 2.0 is exceptional." },
      { name: "Alpha vs Beta Decomposition", description: "Alpha = return from the model\u2019s stock-specific insight. Beta = return from market exposure. You want high alpha." },
      { name: "Bootstrap Confidence Interval", description: "Statistical range for the model\u2019s true accuracy. If the interval includes 50%, the edge may not be reliable." },
    ],
    tips: [
      "Don\u2019t treat ML predictions as buy/sell signals on their own \u2014 use them as one input alongside your DCF and risk analysis.",
      "\"No Signal\" is valuable information: it means the model sees no clear short-term direction, which is itself useful for sizing positions.",
      "Check the alpha number specifically. A model with high accuracy but zero alpha is just tracking the market, not adding insight.",
    ],
    tryIt: { label: "Try it with GOOGL", to: "/quote/GOOGL" },
  },
  {
    id: "options-decay",
    emoji: "\u23F3",
    title: "Options Decay Simulator",
    whatItDoes:
      "Visualizes how time decay (theta) erodes an option\u2019s value day by day, assuming the stock price stays flat. " +
      "This is the #1 concept options beginners underestimate: even if you\u2019re right about direction, you can lose money if the move " +
      "takes too long. The simulator uses Black-Scholes to model how decay accelerates as expiration approaches.",
    controls: [
      { name: "Expiration Date", description: "Select which options expiry to model. Closer expirations decay faster (theta is non-linear)." },
      { name: "Strike Price", description: "Choose the strike to simulate. At-the-money options have the most time value to lose." },
      { name: "Call / Put Toggle", description: "Switch between modeling a call or put option at the selected strike." },
      { name: "IV Mode (Contract / Preset / Custom)", description: "Contract uses the option\u2019s actual IV. Preset lets you pick common IV levels. Custom gives you a slider to set any IV." },
      { name: "IV Slider", description: "In custom mode, drag to set implied volatility. Higher IV = more expensive premiums but also faster decay in dollar terms." },
      { name: "Run Decay Simulation", description: "Generates the decay curve. Shows option value on the Y-axis vs days to expiration on the X-axis." },
    ],
    tips: [
      "The decay curve is steepest in the last 30 days. If you\u2019re buying options, this is where theta hurts most \u2014 consider expirations 45+ days out.",
      "Compare the same strike at different IV levels to see how much you\u2019re overpaying during high-IV periods (e.g. before earnings).",
      "The \"Favors sellers\" / \"Favors buyers\" label tells you who benefits at the current IV level \u2014 sellers profit from high IV decaying, buyers want low IV before a move.",
      "Look at the Greeks readout (delta, gamma, theta, vega) below the chart. Theta tells you how much value the option loses per day right now.",
    ],
    tryIt: { label: "Try it with TSLA", to: "/quote/TSLA" },
  },
  {
    id: "screener",
    emoji: "\uD83D\uDD0D",
    title: "Stock Screener",
    whatItDoes:
      "Filter the universe of stocks by fundamental metrics (PE, market cap, revenue growth, margins, etc.) to find " +
      "companies matching your investment criteria. Filters combine with AND logic \u2014 every condition must be true.",
    controls: [
      { name: "Presets (Value / Growth / Momentum)", description: "One-click filter sets for common strategies. Good starting points you can customize." },
      { name: "Filter Sliders", description: "Each slider sets a min/max range. Only companies within ALL ranges appear in results." },
      { name: "Sector Filter", description: "Limit results to specific sectors. The count badge shows how many matches per sector." },
      { name: "Sort Columns", description: "Click any column header to sort. Click again to reverse. Helps find the extremes." },
      { name: "Saved Screens", description: "Save your filter combinations for quick access later (requires sign-in)." },
    ],
    tips: [
      "Start with a preset, then tighten one filter at a time to narrow results gradually.",
      "The results auto-update as you move sliders \u2014 no need to click a search button.",
      "Click any ticker in the results to jump directly to its full analysis page.",
    ],
    tryIt: { label: "Open Screener", to: "/screener" },
  },
  {
    id: "congress",
    emoji: "\uD83C\uDFDB\uFE0F",
    title: "Congress Trading",
    whatItDoes:
      "Members of Congress are required to disclose stock trades. This feature backtests their track record: " +
      "\"If you had copied their trades with a realistic delay, how would you have performed vs. the S&P 500?\" " +
      "Each politician gets a grade based on alpha (excess return over SPY).",
    controls: [
      { name: "Copy Delay (days)", description: "How many days after disclosure you would have traded. Disclosures are often delayed 30\u201345 days, so a realistic delay is important." },
      { name: "Hold Period (days)", description: "How long you hold each copied position before selling." },
      { name: "Alpha vs SPY", description: "The excess return compared to buying SPY for the same period. Positive = outperformed the market." },
      { name: "Grade (A\u2013F)", description: "Based on alpha and consistency. A = strong outperformance, F = significant underperformance." },
    ],
    tips: [
      "Pay attention to the \"Short History\" warning \u2014 politicians with few trades have unreliable grades.",
      "High alpha with a long copy delay is more impressive than high alpha with zero delay (which isn\u2019t realistic).",
      "Click any politician\u2019s name to see their individual trade history and per-trade performance.",
    ],
    tryIt: { label: "View Congress Leaderboard", to: "/congress" },
  },
  {
    id: "earnings",
    emoji: "\uD83D\uDCC8",
    title: "Earnings Analysis",
    whatItDoes:
      "AI-powered analysis of a company\u2019s most recent earnings press release. Breaks down whether the company beat or missed " +
      "estimates, extracts management guidance, and assesses sentiment \u2014 all from the primary source document.",
    controls: [
      { name: "Beat/Miss Badges", description: "Green = beat consensus estimates, Red = missed. Shown for both revenue and EPS." },
      { name: "YoY Comparison Bars", description: "Visual bars comparing this quarter to the same quarter last year. Quick way to see growth trends." },
      { name: "Guidance Tone", description: "AI-assessed tone of forward guidance: bullish, cautious, or bearish." },
      { name: "Sentiment Confidence", description: "How confident the AI is in its sentiment assessment. Higher = more clear-cut language in the release." },
      { name: "Executive Quotes", description: "Key quotes extracted from the press release that drove the sentiment assessment." },
    ],
    tips: [
      "Earnings analysis is generated on-demand and cached \u2014 first load takes a few seconds, subsequent loads are instant.",
      "Compare the AI sentiment to how the stock actually moved post-earnings. Divergences can signal opportunity.",
      "All AI analyses are saved to your AI History tab for future reference.",
    ],
    tryIt: { label: "Try it with NVDA", to: "/quote/NVDA" },
  },
  {
    id: "signals",
    emoji: "\uD83D\uDD14",
    title: "Signals",
    whatItDoes:
      "A real-time feed that aggregates three types of alerts: politician trades that overlap with your holdings, " +
      "watchlist announcements (earnings, FDA decisions, splits), and portfolio news. Think of it as your personalized " +
      "news wire filtered to what actually matters to your positions.",
    controls: [
      { name: "Tab Selection", description: "Switch between Politicians, Watchlist, and Portfolio feeds. Each has its own filters." },
      { name: "Days Slider (1\u201360)", description: "How far back to look. Wider window = more results but potentially stale signals." },
      { name: "Limit Slider", description: "Cap the number of results shown. Useful to focus on the most recent activity." },
      { name: "Min $ Presets (Politicians tab)", description: "Filter by trade size \u2014 $50K, $100K, $500K, $1M. Larger trades are more likely to be intentional. Click again to deselect." },
      { name: "Trade Type / Party / Chamber", description: "Narrow politician trades by buy/sell, Democrat/Republican, Senate/House. All filters toggle off on second click." },
      { name: "Hit-Rate Badge", description: "Color-coded accuracy for each politician: green (>70%), yellow (45\u201355%), red (<30%). Based on historical trade outcomes." },
    ],
    tips: [
      "Start with the Politicians tab and set a minimum of $100K \u2014 this filters out small, routine trades that are less meaningful.",
      "The relevance labels on each trade explain why it matters to you (e.g. \"Same sector as your AAPL position\").",
      "Filter buttons deselect on second click \u2014 tap a party filter once to apply, tap again to clear it.",
    ],
    tryIt: { label: "View Signals", to: "/signals" },
  },
  {
    id: "projects",
    emoji: "\uD83D\uDCC1",
    title: "Research Projects",
    whatItDoes:
      "A structured research workspace for building investment theses. Each project is tied to a ticker and gives you " +
      "a template to capture your thesis bullets, catalysts, risks, peer comparisons, linked sources, and DCF snapshot versions. " +
      "Think of it as your investment journal \u2014 all your research for one idea in one place.",
    controls: [
      { name: "Create Project", description: "Pick a ticker and title. The workspace auto-populates with empty sections for thesis, catalysts, and risks." },
      { name: "Thesis / Catalysts / Risks", description: "Bullet-point lists you fill in. These form the core of your investment case. Add, edit, or delete bullets inline." },
      { name: "Conviction & Position", description: "Dropdowns to track your conviction level and position type (Long/Short/Watch). Auto-saves on change." },
      { name: "DCF Snapshots", description: "When you run a DCF on the ticker page, you can import those assumptions as a versioned snapshot inside the project." },
      { name: "Export to Excel", description: "Download your full research as a spreadsheet \u2014 useful for sharing with others or archiving." },
      { name: "Active / Archived Toggle", description: "Archive completed research to keep your project list clean. Toggle to \"All\" to see everything." },
    ],
    tips: [
      "Use the \"Import to Project\" button on a ticker page to save your current DCF slider values as a snapshot. You can compare multiple versions over time.",
      "All edits auto-save with a \"Saving...\" \u2192 \"\u2713 Saved\" indicator \u2014 no need to click a save button.",
      "Build the habit of writing at least 3 thesis bullets and 3 risks before taking a position. This forces you to articulate your edge.",
    ],
    tryIt: { label: "View Projects", to: "/projects" },
  },
  {
    id: "private-companies",
    emoji: "\uD83C\uDFE2",
    title: "Private Companies",
    whatItDoes:
      "Browse pre-IPO and private companies with their investor rosters. The key insight: some private companies have public investors " +
      "(mutual funds, public holding companies) that give you indirect exposure before an IPO. This section helps you find those connections.",
    controls: [
      { name: "Search Box", description: "Filter companies by name. Results update as you type." },
      { name: "Sector Filter Buttons", description: "Filter by sector (AI, Fintech, Space, etc.). Click again to deselect." },
      { name: "Status Badges", description: "Blue = Private, Orange = Pre-IPO, Green = Filed S-1. Companies closer to IPO have more public information available." },
      { name: "Public Investor Count", description: "Highlighted on each card if > 0. These are the investors you can actually buy shares of on public markets." },
      { name: "Investor Detail Tables", description: "Click a company to see two tables: \"Public Investors\" with clickable ticker links, and \"Other Investors\" (VC/PE/corporate). Each shows round context and investment amounts." },
    ],
    tips: [
      "Focus on companies with public investor exposure \u2014 if you believe in SpaceX, you can check which public companies hold SpaceX shares and invest in those.",
      "Click any ticker in the public investors table to jump directly to that company\u2019s full analysis page.",
      "The \"Filed S-1\" status means an IPO is likely imminent \u2014 these companies have the most detailed financial disclosures available.",
    ],
    tryIt: { label: "Browse Private Companies", to: "/private" },
  },
  {
    id: "ai-history",
    emoji: "\uD83E\uDDE0",
    title: "AI History",
    whatItDoes:
      "A centralized log of every AI analysis you\u2019ve triggered across the platform \u2014 earnings analyses, DCF suggestions, " +
      "risk assessments, and investment memos. Think of it as your research journal.",
    controls: [
      { name: "Filter Tabs", description: "Filter by analysis type (Earnings, DCF, Risk, Memo) to find specific analyses quickly." },
      { name: "Expandable Details", description: "Click any entry to expand the full analysis. Collapsed view shows ticker, date, and confidence." },
      { name: "Confidence Color Coding", description: "Green = high confidence, Yellow = moderate, Red = low. Based on data quality and model certainty." },
      { name: "Ticker Links", description: "Click the ticker symbol in any entry to jump to that company\u2019s analysis page." },
    ],
    tips: [
      "Use AI History to track how your analyses evolve over time \u2014 especially useful around earnings seasons.",
      "Requires sign-in since analyses are tied to your account.",
      "The most recent analyses appear at the top. Use filter tabs to narrow by type.",
    ],
    tryIt: { label: "View AI History", to: "/ai-history" },
  },
];

// ── Component ────────────────────────────────────────────────────────────────
export default function OnboardingView() {
  const isMobile = useIsMobile();
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenSection(openSection === id ? null : id);
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, marginBottom: 8 }}>
          Learn the Platform
        </h1>
        <p style={{ fontSize: 15, color: "#888", margin: 0, lineHeight: 1.5 }}>
          Each section below explains a key feature — what it does, what the controls mean, and tips for getting the most out of it.
          Click any section to expand, then hit "Try it" to jump straight in.
        </p>
      </div>

      {/* Accordion Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SECTIONS.map((section) => {
          const isOpen = openSection === section.id;
          return (
            <div
              key={section.id}
              style={{
                background: "#111",
                border: "1px solid #333",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {/* Clickable Header */}
              <button
                onClick={() => toggle(section.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 20px",
                  background: isOpen ? "#1a1a1a" : "#111",
                  border: "none",
                  borderBottom: isOpen ? "1px solid #333" : "none",
                  color: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 16,
                  fontWeight: 600,
                  transition: "background 0.15s",
                }}
                onMouseEnter={isMobile ? undefined : (e) => {
                  if (!isOpen) (e.currentTarget as HTMLButtonElement).style.background = "#1a1a1a";
                }}
                onMouseLeave={isMobile ? undefined : (e) => {
                  if (!isOpen) (e.currentTarget as HTMLButtonElement).style.background = "#111";
                }}
              >
                <span style={{ fontSize: 20 }}>{section.emoji}</span>
                <span style={{ flex: 1 }}>{section.title}</span>
                <span style={{ fontSize: 14, color: "#666", transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>
                  ▼
                </span>
              </button>

              {/* Expandable Body */}
              {isOpen && (
                <div style={{ padding: "20px 24px" }}>
                  {/* What it does */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      What it does
                    </div>
                    <p style={{ fontSize: 14, color: "#ccc", margin: 0, lineHeight: 1.6 }}>
                      {section.whatItDoes}
                    </p>
                  </div>

                  {/* Key Controls */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Key Controls
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {section.controls.map((ctrl) => (
                        <div
                          key={ctrl.name}
                          style={{
                            padding: "10px 14px",
                            background: "#1a1a1a",
                            borderRadius: 8,
                            border: "1px solid #2a2a2a",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", marginBottom: 2 }}>
                            {ctrl.name}
                          </div>
                          <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5 }}>
                            {ctrl.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tips */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Tips
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                      {section.tips.map((tip, i) => (
                        <li key={i} style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Try It Button */}
                  <Link
                    to={section.tryIt.to}
                    style={{
                      display: "inline-block",
                      padding: "10px 20px",
                      background: "#222",
                      border: "1px solid #444",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 500,
                      textDecoration: "none",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={isMobile ? undefined : (e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "#333";
                    }}
                    onMouseLeave={isMobile ? undefined : (e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "#222";
                    }}
                  >
                    {section.tryIt.label} →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
