"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyticsSnapshot } from "@/lib/ga4";

type Days = 7 | 28 | 90;
type Ok = { configured: true } & AnalyticsSnapshot;
type ApiResponse = { configured: false } | { configured: true; error: string } | Ok;

const isOk = (d: ApiResponse | null): d is Ok => !!d && d.configured === true && "totals" in d;
const errorOf = (d: ApiResponse | null): string =>
  d && d.configured === true && "error" in d ? d.error : "";

const RANGES: Days[] = [7, 28, 90];

export default function AnalyticsCard() {
  const [days, setDays] = useState<Days>(28);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed("");
    fetch(`/api/admin/analytics?days=${days}`)
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        if (r.status === 401) throw new Error("Session expired — log in again.");
        if (!r.ok && !("configured" in j)) {
          throw new Error(typeof j.error === "string" ? j.error : `Request failed (${r.status})`);
        }
        return j as unknown as ApiResponse;
      })
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setFailed(e instanceof Error ? e.message : "Request failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const snap = isOk(data) ? data : null;
  const apiError = errorOf(data);

  return (
    <section className="adm-card ana">
      <AnaStyles />
      <div className="ana-head">
        <div>
          <h2>Site analytics</h2>
          <p className="adm-sub" style={{ margin: 0 }}>
            Google Analytics 4
            {snap ? ` · ${snap.range.start} → ${snap.range.end}` : ""}
          </p>
        </div>
        <div className="ana-controls">
          {snap && snap.realtimeActiveUsers !== null && (
            <span className="ana-live" title="Active users right now (GA4 realtime)">
              <i /> {snap.realtimeActiveUsers} active now
            </span>
          )}
          <div className="ana-range" role="tablist" aria-label="Date range">
            {RANGES.map((d) => (
              <button
                key={d}
                role="tab"
                aria-selected={days === d}
                className={days === d ? "is-active" : ""}
                onClick={() => setDays(d)}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && !snap && <p className="ana-note">Loading analytics…</p>}

      {!loading && data && data.configured === false && (
        <div className="ana-empty">
          <strong>Not connected yet.</strong>
          <p>
            Set <code>GA4_PROPERTY_ID</code> and <code>GA4_SERVICE_ACCOUNT_JSON</code> in the
            environment (see <code>.env.example</code>), grant the service account{" "}
            <em>Viewer</em> on the GA4 property, then redeploy.
          </p>
        </div>
      )}

      {!loading && (failed || apiError) && (
        <div className="ana-empty is-error">
          <strong>Couldn&apos;t load analytics.</strong>
          <p>{failed || apiError}</p>
        </div>
      )}

      {snap && (
        <div className={loading ? "ana-body is-stale" : "ana-body"}>
          <div className="ana-tiles">
            <Tile label="Sessions" value={snap.totals.sessions} />
            <Tile label="Users" value={snap.totals.totalUsers} />
            <Tile label="New users" value={snap.totals.newUsers} />
            <Tile label="Page views" value={snap.totals.pageViews} />
            <Tile label="Engagement rate" value={snap.totals.engagementRate} kind="pct" />
            <Tile label="Key events" value={snap.totals.keyEvents} hint="GA4 key events (conversions)" />
          </div>

          <Sparkline points={snap.daily} hover={hover} setHover={setHover} />

          <div className="ana-tables">
            <RankedTable
              title="Top sources"
              cols={["Source / medium", "Sessions", "Users"]}
              rows={snap.sources.map((s) => [s.label, s.sessions, s.users])}
            />
            <RankedTable
              title="Top pages"
              cols={["Page", "Views", "Users"]}
              rows={snap.pages.map((p) => [p.path, p.views, p.users])}
            />
          </div>

          <p className="ana-foot">
            Property {snap.propertyId} · refreshed {timeAgo(snap.fetchedAt)} · cached 15 min
          </p>
        </div>
      )}
    </section>
  );
}

// ---------- pieces ----------

function Tile({ label, value, kind = "num", hint }: {
  label: string; value: number; kind?: "num" | "pct"; hint?: string;
}) {
  const text = kind === "pct" ? `${Math.round(value * 100)}%` : compact(value);
  return (
    <div className="ana-tile" title={hint}>
      <span className="ana-tile__label">{label}</span>
      <span className="ana-tile__value">{text}</span>
    </div>
  );
}

function Sparkline({ points, hover, setHover }: {
  points: AnalyticsSnapshot["daily"]; hover: number | null; setHover: (i: number | null) => void;
}) {
  const W = 800, H = 96, PAD = 2, GAP = 2;
  const max = useMemo(() => Math.max(1, ...points.map((p) => p.sessions)), [points]);
  const n = Math.max(points.length, 1);
  const slot = (W - PAD * 2) / n;
  const bw = Math.min(24, Math.max(2, slot - GAP));
  const r = Math.min(4, bw / 2);
  const active = hover !== null ? points[hover] : null;

  return (
    <div className="ana-spark" onMouseLeave={() => setHover(null)}>
      <div className="ana-spark__head">
        <span className="ana-spark__title">Sessions per day</span>
        <span className="ana-spark__tip" aria-live="polite">
          {active
            ? `${fmtDate(active.date)} · ${active.sessions} sessions · ${active.totalUsers} users · ${active.pageViews} views`
            : "Hover a bar for details"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="ana-spark__svg" role="img"
           aria-label="Daily sessions bar chart">
        <line x1={PAD} x2={W - PAD} y1={H - 0.5} y2={H - 0.5} className="ana-spark__base" />
        {points.map((p, i) => {
          const h = Math.max(1, Math.round(((H - 4) * p.sessions) / max));
          const x = PAD + i * slot + (slot - bw) / 2;
          const y = H - h;
          const d = `M${x},${H} V${y + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${H} Z`;
          return (
            <g key={p.date} onMouseEnter={() => setHover(i)}>
              <rect x={PAD + i * slot} y={0} width={slot} height={H} fill="transparent" />
              <path d={d} className={hover === i ? "ana-bar is-hover" : "ana-bar"} />
            </g>
          );
        })}
      </svg>
      <div className="ana-spark__axis">
        <span>{points[0] ? fmtDate(points[0].date) : ""}</span>
        <span>{points.at(-1) ? fmtDate(points.at(-1)!.date) : ""}</span>
      </div>
    </div>
  );
}

function RankedTable({ title, cols, rows }: {
  title: string; cols: [string, string, string]; rows: (string | number)[][];
}) {
  return (
    <div className="ana-table">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="ana-note">No data in this range.</p>
      ) : (
        <table>
          <thead>
            <tr>{cols.map((c, i) => <th key={c} className={i ? "num" : ""}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="lbl" title={String(r[0])}>{r[0]}</td>
                <td className="num">{compact(Number(r[1]))}</td>
                <td className="num">{compact(Number(r[2]))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- utils ----------

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}
function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function timeAgo(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

function AnaStyles() {
  return (
    <style>{`
      .ana-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
      .ana-controls { display: flex; align-items: center; gap: 12px; }
      .ana-live { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--fg-2); background: var(--jh-mist); border: 1px solid var(--jh-line); padding: 5px 10px; border-radius: 999px; }
      .ana-live i { width: 8px; height: 8px; border-radius: 50%; background: var(--rb-green-dark); box-shadow: 0 0 0 3px rgba(47,122,58,.18); }
      .ana-range { display: inline-flex; border: 1px solid var(--jh-line); border-radius: 10px; overflow: hidden; }
      .ana-range button { border: 0; background: #fff; padding: 6px 12px; font-size: 12px; font-weight: 600; color: var(--fg-3); cursor: pointer; }
      .ana-range button + button { border-left: 1px solid var(--jh-line); }
      .ana-range button.is-active { background: var(--jh-ink); color: #fff; }
      .ana-body { display: flex; flex-direction: column; gap: 18px; transition: opacity .15s; }
      .ana-body.is-stale { opacity: .55; }
      .ana-tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
      @media (max-width: 720px) { .ana-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      .ana-tile { border: 1px solid var(--jh-line); border-radius: 12px; padding: 12px 14px; background: var(--jh-paper); display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .ana-tile__label { font-size: 11.5px; color: var(--fg-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ana-tile__value { font-family: var(--font-body); font-weight: 600; font-size: 22px; color: var(--fg-1); line-height: 1.1; }
      .ana-spark { border: 1px solid var(--jh-line); border-radius: 12px; padding: 12px 14px 10px; background: #fff; }
      .ana-spark__head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; font-size: 12px; }
      .ana-spark__title { font-weight: 600; color: var(--fg-2); }
      .ana-spark__tip { color: var(--fg-3); font-variant-numeric: tabular-nums; }
      .ana-spark__svg { width: 100%; height: 96px; display: block; }
      .ana-spark__base { stroke: var(--jh-line-2); stroke-width: 1; }
      .ana-bar { fill: var(--jh-red); opacity: .85; transition: opacity .1s; }
      .ana-bar.is-hover { opacity: 1; }
      .ana-spark__axis { display: flex; justify-content: space-between; font-size: 11px; color: var(--fg-4); margin-top: 6px; }
      .ana-tables { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      @media (max-width: 720px) { .ana-tables { grid-template-columns: 1fr; } }
      .ana-table h3 { font-family: var(--font-display); font-size: 13.5px; font-weight: 600; margin: 0 0 8px; color: var(--fg-1); }
      .ana-table table { width: 100%; border-collapse: collapse; font-size: 12.5px; table-layout: fixed; }
      .ana-table th { text-align: left; font-weight: 600; color: var(--fg-3); font-size: 11px; text-transform: uppercase; letter-spacing: .03em; padding: 6px 0; border-bottom: 1px solid var(--jh-line); }
      .ana-table td { padding: 7px 0; border-bottom: 1px solid var(--jh-line); color: var(--fg-2); }
      .ana-table tr:last-child td { border-bottom: 0; }
      .ana-table .lbl { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 10px; }
      .ana-table .num { text-align: right; width: 64px; font-variant-numeric: tabular-nums; }
      .ana-table th.num { text-align: right; }
      .ana-note { font-size: 13px; color: var(--fg-3); margin: 0; }
      .ana-foot { font-size: 11.5px; color: var(--fg-4); margin: 0; }
      .ana-empty { border: 1px dashed var(--jh-line-2); border-radius: 12px; padding: 16px; font-size: 13px; color: var(--fg-2); background: var(--jh-paper); }
      .ana-empty.is-error { border-color: var(--jh-red); background: var(--jh-red-soft); }
      .ana-empty strong { display: block; margin-bottom: 4px; }
      .ana-empty p { margin: 0; }
      .ana-empty code { font-family: var(--font-mono); font-size: 12px; }
    `}</style>
  );
}
