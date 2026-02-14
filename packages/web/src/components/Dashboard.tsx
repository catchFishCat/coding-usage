import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchStatus } from "../api";
import type { GroupedQuotas, LoadingState, StatusResponse } from "../types";
import { ProviderCard } from "./ProviderCard";
import { UsageRing } from "./UsageRing";

type ThemeMode = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "coding-usage-theme";
const AUTO_REFRESH_ENABLED_KEY = "coding-usage-auto-refresh-enabled";
const AUTO_REFRESH_INTERVAL_KEY = "coding-usage-auto-refresh-interval";

function applyThemeMode(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
    return;
  }
  root.setAttribute("data-theme", mode);
}

function nextThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === "system") {
    return "light";
  }
  if (mode === "light") {
    return "dark";
  }
  return "system";
}

function groupByProvider(data: StatusResponse["data"]): GroupedQuotas[] {
  const map = new Map<string, GroupedQuotas>();
  for (const item of data) {
    const current = map.get(item.providerId);
    if (current) {
      current.items.push(item);
      continue;
    }
    map.set(item.providerId, {
      providerId: item.providerId,
      providerName: item.providerName,
      items: [item],
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    a.providerName.localeCompare(b.providerName),
  );
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCompact(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function usageDiff(previous: StatusResponse | null, current: StatusResponse) {
  if (!previous) {
    return {
      byProvider: {} as Record<string, number>,
      increased: 0,
      decreased: 0,
    };
  }

  const oldMap = new Map<string, number>();
  for (const item of previous.data) {
    oldMap.set(`${item.providerId}:${item.ruleId}`, item.used);
  }

  const byProvider: Record<string, number> = {};
  let increased = 0;
  let decreased = 0;
  for (const item of current.data) {
    const prev = oldMap.get(`${item.providerId}:${item.ruleId}`);
    if (typeof prev !== "number") {
      continue;
    }
    const delta = item.used - prev;
    if (delta > 0) {
      increased += 1;
    }
    if (delta < 0) {
      decreased += 1;
    }
    byProvider[item.providerId] = (byProvider[item.providerId] || 0) + delta;
  }

  return { byProvider, increased, decreased };
}

const LoadingView: React.FC = () => (
  <div style={styles.centered}>
    <div style={styles.loadingSpinner} />
    <p style={styles.loadingText}>Loading quota data...</p>
  </div>
);

const ErrorView: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <div style={styles.centered}>
    <div style={styles.errorIcon}>!</div>
    <h3 style={styles.errorTitle}>Failed to load data</h3>
    <p style={styles.errorMessage}>{message}</p>
    <button type="button" onClick={onRetry} style={styles.retryButton}>
      Try Again
    </button>
  </div>
);

const EmptyView: React.FC = () => (
  <div style={styles.centered}>
    <div style={styles.emptyIcon}>Q</div>
    <h3 style={styles.emptyTitle}>No quota data available</h3>
    <p style={styles.emptyMessage}>
      Run <code style={styles.code}>pnpm cli usage</code> to collect usage data
      first.
    </p>
  </div>
);

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [state, setState] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
    return "system";
  });
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => {
    return localStorage.getItem(AUTO_REFRESH_ENABLED_KEY) === "true";
  });
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<number>(() => {
    const saved = Number(
      localStorage.getItem(AUTO_REFRESH_INTERVAL_KEY) || "60",
    );
    return [15, 30, 60, 120, 300].includes(saved) ? saved : 60;
  });
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  );
  const [providerDeltaMap, setProviderDeltaMap] = useState<
    Record<string, number>
  >({});
  const [diffSummary, setDiffSummary] = useState({
    increased: 0,
    decreased: 0,
  });
  const prevSnapshotRef = useRef<StatusResponse | null>(null);

  useEffect(() => {
    applyThemeMode(themeMode);
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(AUTO_REFRESH_ENABLED_KEY, String(autoRefreshEnabled));
  }, [autoRefreshEnabled]);

  useEffect(() => {
    localStorage.setItem(AUTO_REFRESH_INTERVAL_KEY, String(autoRefreshSeconds));
  }, [autoRefreshSeconds]);

  const fetchData = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const response = await fetchStatus();
      const diff = usageDiff(prevSnapshotRef.current, response);
      setData(response);
      prevSnapshotRef.current = response;
      setLastRefreshed(Date.now());
      setProviderDeltaMap(diff.byProvider);
      setDiffSummary({ increased: diff.increased, decreased: diff.decreased });
      setState(response.count === 0 ? "empty" : "success");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }
    const timer = window.setInterval(() => {
      void fetchData();
    }, autoRefreshSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled, autoRefreshSeconds, fetchData]);

  const grouped = useMemo(
    () => (data ? groupByProvider(data.data) : []),
    [data],
  );

  useEffect(() => {
    if (grouped.length === 0) {
      setSelectedProviderId(null);
      return;
    }
    if (
      !selectedProviderId ||
      !grouped.some((x) => x.providerId === selectedProviderId)
    ) {
      setSelectedProviderId(grouped[0].providerId);
    }
  }, [grouped, selectedProviderId]);

  const selectedProvider =
    grouped.find((x) => x.providerId === selectedProviderId) || null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.titleSection}>
            <h1 style={styles.title}>Coding Usage Monitor</h1>
            <p style={styles.subtitle}>
              Track your AI coding subscription quotas
            </p>
          </div>
          <div style={styles.controls}>
            {lastRefreshed && (
              <span style={styles.lastRefreshed}>
                Last updated: {formatDate(lastRefreshed)}
              </span>
            )}
            <button
              type="button"
              style={styles.themeButton}
              onClick={() => setThemeMode((current) => nextThemeMode(current))}
            >
              Theme: {themeMode}
            </button>
            <label style={styles.switchRow}>
              <span style={styles.switchLabel}>Auto refresh</span>
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={(event) =>
                  setAutoRefreshEnabled(event.target.checked)
                }
                style={styles.switchInput}
              />
              <span style={styles.switchTrack} aria-hidden="true">
                <span
                  style={{
                    ...styles.switchThumb,
                    ...(autoRefreshEnabled ? styles.switchThumbOn : {}),
                  }}
                />
              </span>
            </label>
            {autoRefreshEnabled && (
              <label style={styles.intervalLabel}>
                Every
                <select
                  value={autoRefreshSeconds}
                  style={styles.intervalSelect}
                  onChange={(event) =>
                    setAutoRefreshSeconds(Number(event.target.value))
                  }
                >
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
                  <option value={120}>120s</option>
                  <option value={300}>300s</option>
                </select>
              </label>
            )}
            <button
              type="button"
              onClick={() => void fetchData()}
              disabled={state === "loading"}
              style={{
                ...styles.refreshButton,
                ...(state === "loading" ? styles.refreshButtonDisabled : {}),
              }}
            >
              {state === "loading" ? "Refreshing..." : "Refresh"}
            </button>
            {(diffSummary.increased > 0 || diffSummary.decreased > 0) && (
              <span style={styles.diffSummary}>
                {diffSummary.increased > 0
                  ? `${diffSummary.increased} increased`
                  : ""}
                {diffSummary.increased > 0 && diffSummary.decreased > 0
                  ? " · "
                  : ""}
                {diffSummary.decreased > 0
                  ? `${diffSummary.decreased} recovered`
                  : ""}
              </span>
            )}
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {state === "loading" && !data && <LoadingView />}
        {state === "error" && (
          <ErrorView message={error || ""} onRetry={() => void fetchData()} />
        )}
        {state === "empty" && <EmptyView />}

        {(state === "success" || (state === "loading" && data)) && (
          <div style={styles.splitLayout}>
            <section style={styles.leftColumn}>
              {grouped.map((provider) => (
                <ProviderCard
                  key={provider.providerId}
                  providerId={provider.providerId}
                  providerName={provider.providerName}
                  items={provider.items}
                  selected={provider.providerId === selectedProviderId}
                  onSelect={setSelectedProviderId}
                  onRefresh={() => void fetchData()}
                  refreshing={state === "loading"}
                  usageDelta={providerDeltaMap[provider.providerId] || 0}
                />
              ))}
            </section>

            <section style={styles.rightColumn}>
              {selectedProvider && (
                <div style={styles.detailsPanel}>
                  <div style={styles.detailsHeader}>
                    <h2 style={styles.detailsTitle}>
                      {selectedProvider.providerName}
                    </h2>
                    <span style={styles.detailsRuleCount}>
                      {selectedProvider.items.length} rules
                    </span>
                  </div>
                  <div style={styles.detailsRows}>
                    {selectedProvider.items.map((item) => (
                      <div key={item.ruleId} style={styles.detailsRow}>
                        <div style={styles.detailsRowText}>
                          <div style={styles.detailsRuleName}>
                            {item.ruleName}
                          </div>
                          <div style={styles.detailsRuleMeta}>
                            {formatCompact(item.used)} /{" "}
                            {formatCompact(item.limit)}
                          </div>
                        </div>
                        <UsageRing
                          percentage={item.percentage}
                          freshness={item.freshness}
                          size={52}
                          strokeWidth={5}
                          showPercentage={true}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={styles.detailsFooter}>
                    Updated{" "}
                    {formatDate(
                      selectedProvider.items[0]?.snapshotTimestamp ||
                        Date.now(),
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <p style={styles.footerText}>
            Connected to local server at 127.0.0.1:8787
          </p>
          <span style={styles.footerCount}>
            {data?.count || 0} quota rules tracked
          </span>
        </div>
      </footer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    backgroundColor: "var(--color-surface)",
    borderBottom: "1px solid var(--color-border)",
    boxShadow: "var(--shadow-sm)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerContent: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "var(--space-4) var(--space-6)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-4)",
  },
  titleSection: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
  },
  title: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-2xl)",
  },
  subtitle: {
    margin: 0,
    color: "var(--color-text-secondary)",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "var(--space-3)",
  },
  lastRefreshed: {
    fontSize: "var(--text-sm)",
    color: "var(--color-text-muted)",
    fontFamily: "var(--font-mono)",
  },
  themeButton: {
    padding: "var(--space-2) var(--space-3)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)",
    backgroundColor: "var(--color-surface-elevated)",
    color: "var(--color-text-secondary)",
    textTransform: "capitalize",
    cursor: "pointer",
  },
  switchRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-2)",
    position: "relative",
  },
  switchLabel: {
    fontSize: "var(--text-sm)",
    color: "var(--color-text-muted)",
    fontWeight: "var(--font-medium)",
  },
  switchInput: {
    position: "absolute",
    opacity: 0,
    width: 0,
    height: 0,
  },
  switchTrack: {
    width: "38px",
    height: "22px",
    borderRadius: "999px",
    border: "1px solid var(--color-border)",
    backgroundColor: "var(--color-surface-elevated)",
    display: "inline-flex",
    alignItems: "center",
    padding: "2px",
  },
  switchThumb: {
    width: "16px",
    height: "16px",
    borderRadius: "999px",
    backgroundColor: "var(--color-text-muted)",
    transform: "translateX(0)",
    transition:
      "transform var(--transition-fast), background-color var(--transition-fast)",
  },
  switchThumbOn: {
    backgroundColor: "var(--color-accent)",
    transform: "translateX(16px)",
  },
  intervalLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-2)",
    color: "var(--color-text-muted)",
    fontSize: "var(--text-sm)",
  },
  intervalSelect: {
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-1) var(--space-2)",
    backgroundColor: "var(--color-surface-elevated)",
    color: "var(--color-text-primary)",
    fontSize: "var(--text-sm)",
  },
  refreshButton: {
    padding: "var(--space-2) var(--space-4)",
    borderRadius: "var(--radius-md)",
    border: "none",
    backgroundColor: "var(--color-accent)",
    color: "var(--color-text-inverse)",
    fontWeight: "var(--font-semibold)",
    cursor: "pointer",
  },
  refreshButtonDisabled: {
    backgroundColor: "var(--color-text-muted)",
    cursor: "not-allowed",
  },
  diffSummary: {
    color: "var(--color-success)",
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-semibold)",
  },
  main: {
    flex: 1,
    padding: "var(--space-6) var(--space-4)",
  },
  splitLayout: {
    maxWidth: "1400px",
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: "var(--space-5)",
    alignItems: "start",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    position: "sticky",
    top: "120px",
    maxHeight: "calc(100vh - 160px)",
    overflowY: "auto",
    paddingTop: "var(--space-2)",
    paddingBottom: "var(--space-2)",
    paddingRight: "var(--space-2)",
  },
  rightColumn: {
    minWidth: 0,
  },
  detailsPanel: {
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-xl)",
    backgroundColor: "var(--color-surface)",
    boxShadow: "var(--shadow-md)",
    overflow: "hidden",
  },
  detailsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--space-4)",
    borderBottom: "1px solid var(--color-border)",
  },
  detailsTitle: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-2xl)",
  },
  detailsRuleCount: {
    color: "var(--color-text-muted)",
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-medium)",
  },
  detailsRows: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
    padding: "var(--space-3) var(--space-4)",
  },
  detailsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-3)",
    border: "1px solid var(--color-border-light)",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--color-surface-elevated)",
    padding: "var(--space-3)",
  },
  detailsRowText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
  },
  detailsRuleName: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-medium)",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
  },
  detailsRuleMeta: {
    fontSize: "var(--text-xs)",
    color: "var(--color-text-muted)",
    fontFamily: "var(--font-mono)",
  },
  detailsFooter: {
    borderTop: "1px solid var(--color-border)",
    padding: "var(--space-3) var(--space-4)",
    color: "var(--color-text-muted)",
    fontSize: "var(--text-xs)",
    fontStyle: "italic",
  },
  footer: {
    backgroundColor: "var(--color-surface)",
    borderTop: "1px solid var(--color-border)",
    padding: "var(--space-4) var(--space-6)",
  },
  footerContent: {
    maxWidth: "1400px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-2)",
    flexWrap: "wrap",
  },
  footerText: {
    margin: 0,
    color: "var(--color-text-muted)",
    fontSize: "var(--text-sm)",
  },
  footerCount: {
    color: "var(--color-text-secondary)",
    fontSize: "var(--text-sm)",
    fontWeight: "var(--font-semibold)",
  },
  centered: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "var(--space-16) var(--space-6)",
  },
  loadingSpinner: {
    width: "40px",
    height: "40px",
    border: "3px solid var(--color-border)",
    borderTopColor: "var(--color-accent)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    marginTop: "var(--space-4)",
    color: "var(--color-text-secondary)",
  },
  errorIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "999px",
    backgroundColor: "rgba(239, 68, 68, 0.14)",
    color: "var(--color-danger)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "var(--font-bold)",
  },
  errorTitle: {
    marginTop: "var(--space-4)",
    marginBottom: "var(--space-2)",
  },
  errorMessage: {
    margin: 0,
    color: "var(--color-danger)",
    marginBottom: "var(--space-5)",
  },
  retryButton: {
    padding: "var(--space-2) var(--space-4)",
    border: "none",
    borderRadius: "var(--radius-md)",
    backgroundColor: "var(--color-accent)",
    color: "var(--color-text-inverse)",
    cursor: "pointer",
  },
  emptyIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "999px",
    backgroundColor: "rgba(13, 148, 136, 0.14)",
    color: "var(--color-accent)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "var(--font-bold)",
  },
  emptyTitle: {
    marginTop: "var(--space-4)",
    marginBottom: "var(--space-2)",
  },
  emptyMessage: {
    margin: 0,
    color: "var(--color-text-secondary)",
  },
  code: {
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-sm)",
    backgroundColor: "var(--color-surface-elevated)",
    padding: "2px 6px",
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
  },
};
