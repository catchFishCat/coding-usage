/**
 * UsageBar component - Visual representation of quota usage
 */

import React from "react";
import type { Freshness } from "../types";

interface UsageBarProps {
  percentage: number;
  freshness: Freshness;
  label?: string;
}

function getBarGradient(percentage: number, freshness: Freshness): string {
  if (freshness === "unknown") {
    return "var(--gradient-usage-unknown)";
  }
  if (percentage >= 0.9) {
    return "var(--gradient-usage-high)";
  }
  if (percentage >= 0.7) {
    return "var(--gradient-usage-medium)";
  }
  return "var(--gradient-usage-low)";
}

function getStatusColor(percentage: number, freshness: Freshness): string {
  if (freshness === "unknown") {
    return "var(--color-unknown)";
  }
  if (percentage >= 0.9) {
    return "var(--color-danger)";
  }
  if (percentage >= 0.7) {
    return "var(--color-warning)";
  }
  return "var(--color-success)";
}

export const UsageBar: React.FC<UsageBarProps> = ({
  percentage,
  freshness,
  label,
}) => {
  const clampedPercentage = Math.max(0, Math.min(1, percentage));
  const displayPercentage = Math.round(clampedPercentage * 100);
  const barGradient = getBarGradient(clampedPercentage, freshness);
  const statusColor = getStatusColor(clampedPercentage, freshness);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        {label && <span style={styles.label}>{label}</span>}
        <span
          style={{
            ...styles.percentage,
            color: statusColor,
          }}
        >
          {freshness === "unknown" ? "—" : `${displayPercentage}%`}
        </span>
      </div>
      <div style={styles.barContainer}>
        <div
          style={{
            ...styles.barFill,
            width: `${clampedPercentage * 100}%`,
            background: barGradient,
            opacity: freshness === "unknown" ? 0.5 : 1,
          }}
        />
        <div style={styles.barBackground} />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: "var(--text-sm)",
    color: "var(--color-text-secondary)",
    fontWeight: "var(--font-medium)",
  },
  percentage: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-semibold)",
    fontFamily: "var(--font-mono)",
  },
  barContainer: {
    position: "relative",
    height: "8px",
    borderRadius: "9999px",
    overflow: "hidden",
    backgroundColor: "var(--color-border-light)",
  },
  barFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    borderRadius: "9999px",
    transition: "width var(--transition-normal)",
    animation: "progressFill 0.6s ease-out",
  },
  barBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "100%",
    borderRadius: "9999px",
    backgroundColor: "var(--color-border-light)",
    zIndex: -1,
  },
};
