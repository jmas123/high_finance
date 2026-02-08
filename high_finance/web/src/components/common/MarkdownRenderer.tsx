/**
 * Lightweight Markdown Renderer
 * ─────────────────────────────
 * Handles: ## headers, **bold**, - lists, | tables |, --- hr, paragraphs
 * No dependency needed — this covers the exact patterns our AI prompts produce.
 *
 * Shared by: MemoModal, FinancialStatements AI Analysis
 */

/** Render inline markdown: **bold** */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let partKey = 0;

  while (remaining.length > 0) {
    // Bold: **...**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(boldMatch[1]);
      parts.push(
        <strong key={`b${partKey++}`} style={{ color: "#fff", fontWeight: 600 }}>
          {boldMatch[2]}
        </strong>
      );
      remaining = boldMatch[3];
      continue;
    }

    // No more patterns — push rest
    parts.push(remaining);
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/** Render a markdown table */
function renderTable(lines: string[], key: number): React.ReactNode {
  const rows = lines
    .filter((l) => !l.match(/^\|[\s\-:]+\|$/)) // skip separator row (|---|---|)
    .map((l) =>
      l
        .split("|")
        .slice(1, -1) // remove empty first/last from leading/trailing |
        .map((cell) => cell.trim())
    );

  if (rows.length === 0) return null;

  const header = rows[0];
  const body = rows.slice(1);

  return (
    <div key={key} style={{ overflowX: "auto", margin: "12px 0" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            {header.map((cell, idx) => (
              <th
                key={idx}
                style={{
                  padding: "8px 10px",
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: "uppercase",
                  color: "#888",
                  borderBottom: "1px solid #444",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                }}
              >
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  style={{
                    padding: "8px 10px",
                    color: "#ccc",
                    borderBottom: "1px solid #2a2a2a",
                    lineHeight: 1.5,
                  }}
                >
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Parse markdown string into React elements */
export function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line → skip (paragraph spacing handled by margins)
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim())) {
      elements.push(
        <hr key={key++} style={{ border: "none", borderTop: "1px solid #333", margin: "16px 0" }} />
      );
      i++;
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const fontSize = level === 1 ? 20 : level === 2 ? 16 : 14;
      const marginTop = level === 1 ? 20 : 16;
      elements.push(
        <div
          key={key++}
          style={{
            fontSize,
            fontWeight: 700,
            color: level === 1 ? "#fff" : "#e0e0e0",
            marginTop,
            marginBottom: 8,
            letterSpacing: level === 1 ? "0.02em" : undefined,
          }}
        >
          {renderInline(text)}
        </div>
      );
      i++;
      continue;
    }

    // Table: collect consecutive | lines
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(renderTable(tableLines, key++));
      continue;
    }

    // List items: collect consecutive - lines
    if (/^\s*-\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*-\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*-\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={key++} style={{ margin: "8px 0", paddingLeft: 20 }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ color: "#ccc", fontSize: 14, lineHeight: 1.7, marginBottom: 4 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list items: collect consecutive 1. 2. 3. lines
    if (/^\s*\d+\.\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={key++} style={{ margin: "8px 0", paddingLeft: 20 }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ color: "#ccc", fontSize: 14, lineHeight: 1.7, marginBottom: 4 }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={key++} style={{ color: "#ccc", fontSize: 14, lineHeight: 1.7, margin: "8px 0" }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return elements;
}
