// Google Analytics 4 Data API — server-only, zero dependencies.
//
// The browser tag (NEXT_PUBLIC_GA_MEASUREMENT_ID, G-XXXX) *sends* hits.
// To *read* reports we need the numeric property id plus a service account
// granted "Viewer" on that property. Both come from env:
//   GA4_PROPERTY_ID            e.g. 558386421
//   GA4_SERVICE_ACCOUNT_JSON   the service-account key file contents
//                              (raw JSON, or base64 of the JSON)
import { createSign } from "node:crypto";
import { unstable_cache } from "next/cache";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const API = "https://analyticsdata.googleapis.com/v1beta";

type ServiceAccount = { client_email: string; private_key: string };

export function ga4Config(): { propertyId: string; sa: ServiceAccount } | null {
  const propertyId = (process.env.GA4_PROPERTY_ID ?? "").trim().replace(/^properties\//, "");
  const raw = (process.env.GA4_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (!propertyId || !raw) return null;
  let sa: ServiceAccount | null = null;
  for (const text of [raw, safeB64(raw)]) {
    if (!text) continue;
    try {
      const j = JSON.parse(text);
      if (j?.client_email && j?.private_key) { sa = j; break; }
    } catch { /* try next */ }
  }
  return sa ? { propertyId, sa } : null;
}

function safeB64(s: string): string | null {
  try { return Buffer.from(s, "base64").toString("utf8"); } catch { return null; }
}

const b64url = (s: string) =>
  Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const sig = signer
    .sign(sa.private_key.replace(/\\n/g, "\n"), "base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${sig}`,
    }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Google token exchange failed: ${data.error_description ?? data.error ?? res.status}`);
  }
  return data.access_token as string;
}

// ---------- report plumbing ----------

type Row = { dimensionValues: { value: string }[]; metricValues: { value: string }[] };
type ReportBody = {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: Row[];
  error?: { message?: string };
};

async function runReport(
  token: string, propertyId: string, path: "runReport" | "runRealtimeReport", body: unknown,
): Promise<ReportBody> {
  const res = await fetch(`${API}/properties/${propertyId}:${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json()) as ReportBody;
  if (!res.ok) throw new Error(json?.error?.message ?? `GA4 ${path} failed (${res.status})`);
  return json;
}

function toObjects(body: ReportBody): Record<string, string>[] {
  const dims = (body.dimensionHeaders ?? []).map((h) => h.name);
  const mets = (body.metricHeaders ?? []).map((h) => h.name);
  return (body.rows ?? []).map((r) => {
    const o: Record<string, string> = {};
    dims.forEach((d, i) => (o[d] = r.dimensionValues[i]?.value ?? ""));
    mets.forEach((m, i) => (o[m] = r.metricValues[i]?.value ?? "0"));
    return o;
  });
}

const num = (v: string | undefined) => Number(v ?? 0) || 0;

// ---------- public shapes ----------

export type DailyPoint = {
  date: string; // YYYY-MM-DD
  sessions: number; totalUsers: number; newUsers: number;
  pageViews: number; engagedSessions: number; keyEvents: number;
};
export type Totals = Omit<DailyPoint, "date"> & { engagementRate: number };
export type RankedRow = { label: string; sessions: number; users: number };
export type PageRow = { path: string; views: number; users: number };

export type AnalyticsSnapshot = {
  propertyId: string;
  days: number;
  range: { start: string; end: string };
  totals: Totals;
  daily: DailyPoint[];
  sources: RankedRow[];
  pages: PageRow[];
  realtimeActiveUsers: number | null;
  fetchedAt: string;
};

const DAILY_METRICS = ["sessions", "totalUsers", "newUsers", "screenPageViews", "engagedSessions"];

async function fetchSnapshot(days: number): Promise<AnalyticsSnapshot> {
  const cfg = ga4Config();
  if (!cfg) throw new Error("GA4 is not configured");
  const { propertyId, sa } = cfg;
  const token = await getAccessToken(sa);

  const start = `${days - 1}daysAgo`;
  const dateRanges = [{ startDate: start, endDate: "today" }];

  // Daily series — "keyEvents" first, fall back to legacy "conversions".
  const dailyReq = (kev: string) => ({
    dateRanges,
    dimensions: [{ name: "date" }],
    metrics: [...DAILY_METRICS, kev].map((name) => ({ name })),
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 400,
  });
  let dailyBody: ReportBody;
  let kevName = "keyEvents";
  try {
    dailyBody = await runReport(token, propertyId, "runReport", dailyReq("keyEvents"));
  } catch (e) {
    if (!/keyEvents/i.test(String(e))) throw e;
    kevName = "conversions";
    dailyBody = await runReport(token, propertyId, "runReport", dailyReq("conversions"));
  }

  const [sourcesBody, pagesBody, realtimeBody] = await Promise.all([
    runReport(token, propertyId, "runReport", {
      dateRanges,
      dimensions: [{ name: "sessionSourceMedium" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 8,
    }),
    runReport(token, propertyId, "runReport", {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 8,
    }),
    runReport(token, propertyId, "runRealtimeReport", {
      metrics: [{ name: "activeUsers" }],
    }).catch(() => null),
  ]);

  const daily: DailyPoint[] = toObjects(dailyBody).map((o) => {
    const d = o.date;
    return {
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      sessions: num(o.sessions),
      totalUsers: num(o.totalUsers),
      newUsers: num(o.newUsers),
      pageViews: num(o.screenPageViews),
      engagedSessions: num(o.engagedSessions),
      keyEvents: num(o[kevName]),
    };
  });

  const sum = (k: keyof Omit<DailyPoint, "date">) => daily.reduce((a, p) => a + p[k], 0);
  const sessions = sum("sessions");
  const totals: Totals = {
    sessions,
    totalUsers: sum("totalUsers"),
    newUsers: sum("newUsers"),
    pageViews: sum("pageViews"),
    engagedSessions: sum("engagedSessions"),
    keyEvents: sum("keyEvents"),
    engagementRate: sessions ? sum("engagedSessions") / sessions : 0,
  };

  const sources: RankedRow[] = toObjects(sourcesBody).map((o) => ({
    label: o.sessionSourceMedium || "(not set)",
    sessions: num(o.sessions),
    users: num(o.totalUsers),
  }));
  const pages: PageRow[] = toObjects(pagesBody).map((o) => ({
    path: o.pagePath || "/",
    views: num(o.screenPageViews),
    users: num(o.totalUsers),
  }));

  const rt = realtimeBody ? toObjects(realtimeBody)[0] : undefined;
  const realtimeActiveUsers = rt ? num(rt.activeUsers) : null;

  const today = new Date();
  const first = new Date(today.getTime() - (days - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return {
    propertyId,
    days,
    range: { start: iso(first), end: iso(today) },
    totals, daily, sources, pages, realtimeActiveUsers,
    fetchedAt: new Date().toISOString(),
  };
}

/** Cached snapshot (15 min) so admin page loads don't hammer the GA4 quota. */
export const getAnalyticsSnapshot = unstable_cache(
  (days: number) => fetchSnapshot(days),
  ["ga4-snapshot"],
  { revalidate: 900 },
);
