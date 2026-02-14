import React, { useMemo } from "react";
import type { Freshness, QuotaItem } from "../types";
import { UsageRing } from "./UsageRing";

interface ProviderCardProps {
  providerId: string;
  providerName: string;
  items: QuotaItem[];
  selected?: boolean;
  onSelect?: (providerId: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  usageDelta?: number;
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function getOverallUsage(items: QuotaItem[]): {
  percentage: number;
  freshness: Freshness;
} {
  if (items.length === 0) {
    return { percentage: 0, freshness: "unknown" };
  }

  const used = items.reduce((sum, item) => sum + item.used, 0);
  const limit = items.reduce((sum, item) => sum + item.limit, 0);

  const freshnessOrder: Freshness[] = ["unknown", "stale", "known"];
  const freshness = items.reduce((worst, item) => {
    const worstIndex = freshnessOrder.indexOf(worst);
    const currentIndex = freshnessOrder.indexOf(item.freshness);
    return currentIndex < worstIndex ? item.freshness : worst;
  }, "known" as Freshness);

  return {
    percentage: limit > 0 ? used / limit : 0,
    freshness,
  };
}

function getBadgeStyle(freshness: Freshness): React.CSSProperties {
  if (freshness === "known") {
    return {
      color: "var(--color-success)",
      backgroundColor: "rgba(5, 150, 105, 0.12)",
    };
  }
  if (freshness === "stale") {
    return {
      color: "var(--color-warning)",
      backgroundColor: "rgba(217, 119, 6, 0.12)",
    };
  }
  return {
    color: "var(--color-unknown)",
    backgroundColor: "rgba(156, 163, 175, 0.12)",
  };
}

function badgeText(freshness: Freshness): string {
  if (freshness === "known") {
    return "Live";
  }
  if (freshness === "stale") {
    return "Stale";
  }
  return "Unknown";
}

function deltaText(value: number): string {
  if (value > 0) {
    return `+${formatNumber(value)} used`;
  }
  if (value < 0) {
    return `${formatNumber(Math.abs(value))} recovered`;
  }
  return "No change";
}

function deltaStyle(value: number): React.CSSProperties {
  if (value > 0) {
    return {
      color: "var(--color-success)",
      backgroundColor: "rgba(5, 150, 105, 0.12)",
    };
  }
  if (value < 0) {
    return {
      color: "var(--color-warning)",
      backgroundColor: "rgba(217, 119, 6, 0.12)",
    };
  }
  return {
    color: "var(--color-text-muted)",
    backgroundColor: "rgba(120, 113, 108, 0.12)",
  };
}

const RefreshIcon: React.FC<{ spinning: boolean }> = ({ spinning }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    style={{ animation: spinning ? "spin 0.8s linear infinite" : "none" }}
    aria-hidden="true"
  >
    <path
      d="M20 12a8 8 0 0 0-14.2-4.9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M5.8 4.8H2.8v3"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 12a8 8 0 0 0 14.2 4.9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M18.2 19.2h3v-3"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ProviderCard: React.FC<ProviderCardProps> = ({
  providerId,
  providerName,
  items,
  selected = false,
  onSelect,
  onRefresh,
  refreshing = false,
  usageDelta = 0,
}) => {
  const overall = useMemo(() => getOverallUsage(items), [items]);

  return (
    <div
      style={{
        ...styles.card,
        ...(selected ? styles.cardSelected : {}),
      }}
      className="card-hover"
    >
      {onSelect && (
        <button
          type="button"
          className="provider-select-overlay"
          style={styles.selectOverlay}
          tabIndex={-1}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={(event) => {
            onSelect(providerId);
            event.currentTarget.blur();
          }}
          aria-label={`Show ${providerName} details`}
        />
      )}
      <div style={styles.contentWrap}>
        <div style={styles.headerTop}>
          <div style={styles.headerInfo}>
            <h3 style={styles.title}>{providerName}</h3>
            <span
              style={{ ...styles.badge, ...getBadgeStyle(overall.freshness) }}
            >
              {badgeText(overall.freshness)}
            </span>
          </div>
          <div style={styles.rightControls}>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="toggle-btn"
                style={styles.refreshButton}
                aria-label={`Refresh ${providerName}`}
                disabled={refreshing}
              >
                <RefreshIcon spinning={refreshing} />
              </button>
            )}
            <UsageRing
              percentage={overall.percentage}
              freshness={overall.freshness}
              size={52}
              strokeWidth={5}
              showPercentage={true}
            />
          </div>
        </div>
        <div style={styles.metaRow}>
          <span style={styles.ruleCount}>
            {items.length} quota rule{items.length !== 1 ? "s" : ""}
          </span>
          <span style={{ ...styles.deltaChip, ...deltaStyle(usageDelta) }}>
            {deltaText(usageDelta)}
          </span>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    position: "relative",
    width: "100%",
    textAlign: "left",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-xl)",
    backgroundColor: "var(--color-surface)",
    boxShadow: "var(--shadow-sm)",
    padding: "var(--space-4)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    cursor: "pointer",
  },
  selectOverlay: {
    position: "absolute",
    inset: 0,
    appearance: "none",
    border: "none",
    borderRadius: "var(--radius-xl)",
    background: "transparent",
    cursor: "pointer",
    zIndex: 1,
    outline: "none",
    boxShadow: "none",
    WebkitTapHighlightColor: "transparent",
  },
  contentWrap: {
    position: "relative",
    zIndex: 2,
    pointerEvents: "none",
  },
  cardSelected: {
    borderColor: "var(--color-accent)",
    backgroundColor: "var(--color-surface-elevated)",
  },
  headerTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "var(--space-3)",
  },
  headerInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
    minWidth: 0,
  },
  title: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-xl)",
    lineHeight: 1.1,
  },
  badge: {
    width: "fit-content",
    padding: "2px 8px",
    borderRadius: "var(--radius-full)",
    fontSize: "var(--text-xs)",
    fontWeight: "var(--font-semibold)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  rightControls: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    flexShrink: 0,
  },
  refreshButton: {
    width: "30px",
    height: "30px",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--color-surface-elevated)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-2)",
  },
  ruleCount: {
    fontSize: "var(--text-sm)",
    color: "var(--color-text-muted)",
    fontWeight: "var(--font-medium)",
  },
  deltaChip: {
    padding: "2px 8px",
    borderRadius: "var(--radius-full)",
    fontSize: "var(--text-xs)",
    fontWeight: "var(--font-semibold)",
  },
};
