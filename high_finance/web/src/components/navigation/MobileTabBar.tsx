import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const PRIMARY_TABS = [
  { path: "/dashboard", label: "Home", emoji: "\uD83C\uDFE0" },
  { path: "/screener", label: "Screener", emoji: "\uD83D\uDD0E" },
  { path: "/projects", label: "Projects", emoji: "\uD83D\uDCCB" },
  { path: "/signals", label: "Signals", emoji: "\uD83D\uDD14" },
] as const;

const OVERFLOW_TABS = [
  { path: "/congress", label: "Congress", emoji: "\uD83C\uDFDB\uFE0F" },
  { path: "/returns", label: "Returns", emoji: "\uD83D\uDCC8" },
  { path: "/private", label: "Private", emoji: "\uD83D\uDD12" },
  { path: "/ai-history", label: "AI History", emoji: "\uD83E\uDD16" },
  { path: "/onboarding", label: "Guide", emoji: "\uD83D\uDCD6" },
] as const;

function isTabActive(tabPath: string, pathname: string): boolean {
  if (tabPath === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(tabPath);
}

export function MobileTabBar() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isOverflowActive = OVERFLOW_TABS.some((t) =>
    isTabActive(t.path, location.pathname)
  );

  return (
    <>
      {/* Backdrop for overflow sheet */}
      {showMore && (
        <div
          onClick={() => setShowMore(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 998,
          }}
        />
      )}

      {/* Overflow sheet */}
      {showMore && (
        <div
          style={{
            position: "fixed",
            bottom: 60,
            left: 0,
            right: 0,
            background: "#1a1a1a",
            borderTop: "1px solid #333",
            padding: "16px 16px 8px",
            zIndex: 999,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {OVERFLOW_TABS.map((tab) => {
            const active = isTabActive(tab.path, location.pathname);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                onClick={() => setShowMore(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  background: active ? "#3b82f615" : "#222",
                  border: `1px solid ${active ? "#3b82f640" : "#333"}`,
                  borderRadius: 10,
                  color: active ? "#3b82f6" : "#ccc",
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                <span style={{ fontSize: 18 }}>{tab.emoji}</span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Tab bar */}
      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          paddingBottom: "env(safe-area-inset-bottom)",
          background: "#111",
          borderTop: "1px solid #333",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          zIndex: 1000,
        }}
      >
        {PRIMARY_TABS.map((tab) => {
          const active = isTabActive(tab.path, location.pathname);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                textDecoration: "none",
                color: active ? "#3b82f6" : "#888",
                fontSize: 10,
                padding: "6px 12px",
                position: "relative",
              }}
            >
              <span style={{ fontSize: 20 }}>{tab.emoji}</span>
              <span>{tab.label}</span>
              {active && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "#3b82f6",
                  }}
                />
              )}
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setShowMore(!showMore)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            background: "none",
            border: "none",
            color: showMore || isOverflowActive ? "#3b82f6" : "#888",
            fontSize: 10,
            padding: "6px 12px",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <span style={{ fontSize: 20 }}>{"\u22EF"}</span>
          <span>More</span>
          {isOverflowActive && !showMore && (
            <span
              style={{
                position: "absolute",
                top: 2,
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "#3b82f6",
              }}
            />
          )}
        </button>
      </nav>
    </>
  );
}
