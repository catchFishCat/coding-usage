/**
 * UsageRing component - Circular ring meter for quota usage
 */

import React from "react";
import type { Freshness } from "../types";

interface UsageRingProps {
  percentage: number;
  freshness: Freshness;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showPercentage?: boolean;
}

function getRingColor(percentage: number, freshness: Freshness): string {
  if (freshness === "unknown") {
    return "var(--ring-unknown)";
  }
  if (percentage >= 0.9) {
    return "var(--ring-high)";
  }
  if (percentage >= 0.7) {
    return "var(--ring-medium)";
  }
  return "var(--ring-low)";
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

export const UsageRing: React.FC<UsageRingProps> = ({
  percentage,
  freshness,
  size = 48,
  strokeWidth = 4,
  label,
  showPercentage = true,
}) => {
  const clampedPercentage = Math.max(0, Math.min(1, percentage));
  const displayPercentage = Math.round(clampedPercentage * 100);
  const ringColor = getRingColor(clampedPercentage, freshness);
  const statusColor = getStatusColor(clampedPercentage, freshness);

  // Calculate SVG dimensions
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate dash offset based on percentage
  const dashOffset = circumference - clampedPercentage * circumference;

  // Unknown state shows empty ring
  const effectiveDashOffset =
    freshness === "unknown" ? circumference : dashOffset;

  return (
    <div style={styles.container}>
      <div style={styles.ringWrapper}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={styles.svg}
          aria-label={`Usage: ${freshness === "unknown" ? "unknown" : `${displayPercentage}%`}`}
          role="img"
        >
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--ring-track)"
            strokeWidth={strokeWidth}
            style={styles.track}
          />
          {/* Progress ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={effectiveDashOffset}
            transform={`rotate(-90 ${center} ${center})`}
            style={{
              ...styles.progress,
              opacity: freshness === "unknown" ? 0.3 : 1,
            }}
          />
        </svg>
        {showPercentage && (
          <div style={styles.percentageContainer}>
            <span
              style={{
                ...styles.percentage,
                color: statusColor,
                fontSize: size < 40 ? "var(--text-xs)" : "var(--text-sm)",
              }}
            >
              {freshness === "unknown" ? "—" : `${displayPercentage}%`}
            </span>
          </div>
        )}
      </div>
      {label && <span style={styles.label}>{label}</span>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--space-1)",
  },
  ringWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    display: "block",
  },
  track: {
    transition: "stroke var(--transition-fast)",
  },
  progress: {
    transition:
      "stroke-dashoffset var(--transition-slow) cubic-bezier(0.4, 0, 0.2, 1), stroke var(--transition-fast)",
  },
  percentageContainer: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  percentage: {
    fontWeight: "var(--font-semibold)",
    fontFamily: "var(--font-mono)",
    lineHeight: 1,
  },
  label: {
    fontSize: "var(--text-xs)",
    color: "var(--color-text-muted)",
    fontWeight: "var(--font-medium)",
    textAlign: "center",
  },
};
