"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ABConfig, Variant, VariantKey, CurriculumItem } from "@/lib/types";

const KEYS: VariantKey[] = ["A", "B"];

export default function AdminDashboard({
  initialConfig,
}: {
  initialConfig: ABConfig;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<ABConfig>(() =>
    structuredClone(initialConfig)
  );
  const [active, setActive] = useState<VariantKey>("A");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string>("");
  const [error, setError] = useState("");

  // ----- helpers -----
  function update(updater: (c: ABConfig) => void) {
    setConfig((prev) => {
      const next = structuredClone(prev);
      updater(next);
      return next;
    });
  }

  function setVariantField<K extends keyof Variant>(
    key: VariantKey,
    field: K,
    value: Variant[K]
  ) {
    update((c) => {
      (c.variants[key][field] as Variant[K]) = value;
    });
  }

  function setContent(key: VariantKey, field: string, value: string) {
    update((c) => {
      (c.variants[key].content as any)[field] = value;
    });
  }

  const split = useMemo(() => computeSplit(config), [config]);

  function applyPreset(a: number, b: number) {
    update((c) => {
      c.variants.A.weight = a;
      c.variants.A.enabled = a > 0;
      c.variants.B.weight = b;
      c.variants.B.enabled = b > 0;
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Save failed");
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const v = config.variants[active];

  return (
    <div className="adm">
      <Styles />
      {/* Top bar */}
      <header className="adm-top">
        <div className="adm-top__l">
          <img src="/assets/logo-jobhackers.png" alt="" />
          <span>EEC&nbsp;·&nbsp;A/B Admin</span>
        </div>
        <div className="adm-top__r">
          <a className="adm-link" href="/?debug=1" target="_blank" rel="noreferrer">
            View live ↗
          </a>
          <button className="adm-btn ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <div className="adm-wrap">
        {/* ---------------- Traffic & status ---------------- */}
        <section className="adm-card">
          <h2>Traffic &amp; A/B split</h2>
          <p className="adm-sub">
            Turn a version on/off, and set how much traffic each one gets. The
            effective split is computed across the enabled versions.
          </p>

          <div className="adm-traffic">
            {KEYS.map((k) => {
              const vr = config.variants[k];
              return (
                <div className="adm-traffic__col" key={k}>
                  <div className="adm-traffic__head">
                    <span className={`pill ${k === "A" ? "pill-a" : "pill-b"}`}>
                      Version {k}
                    </span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={vr.enabled}
                        onChange={(e) =>
                          setVariantField(k, "enabled", e.target.checked)
                        }
                      />
                      <span>{vr.enabled ? "On" : "Off"}</span>
                    </label>
                  </div>
                  <div className="adm-traffic__name">{vr.name}</div>
                  <div className="adm-traffic__seq">
                    sequence: <code>{vr.sequence}</code> · tag:{" "}
                    <code>
                      …EEC-&gt;{vr.eecName}-&gt;{vr.versionLabel}
                    </code>
                  </div>

                  <label className="adm-weight">
                    Weight: <b>{vr.weight}</b>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={vr.weight}
                      disabled={!vr.enabled}
                      onChange={(e) =>
                        setVariantField(k, "weight", Number(e.target.value))
                      }
                    />
                  </label>

                  <div className="adm-eff">
                    Effective traffic: <b>{split[k]}%</b>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="adm-presets">
            <span>Quick presets:</span>
            <button className="adm-btn sm" onClick={() => applyPreset(100, 0)}>
              100% A
            </button>
            <button className="adm-btn sm" onClick={() => applyPreset(0, 100)}>
              100% B
            </button>
            <button className="adm-btn sm" onClick={() => applyPreset(75, 25)}>
              75 / 25
            </button>
            <button className="adm-btn sm" onClick={() => applyPreset(25, 75)}>
              25 / 75
            </button>
            <button className="adm-btn sm" onClick={() => applyPreset(50, 50)}>
              50 / 50
            </button>
          </div>
        </section>

        {/* ---------------- Content editor ---------------- */}
        <section className="adm-card">
          <div className="adm-tabs">
            {KEYS.map((k) => (
              <button
                key={k}
                className={`adm-tab ${active === k ? "is-active" : ""}`}
                onClick={() => setActive(k)}
              >
                Edit Version {k}
                <em>{config.variants[k].name}</em>
              </button>
            ))}
            <a
              className="adm-preview"
              href={`/?variant=${active}&debug=1`}
              target="_blank"
              rel="noreferrer"
            >
              Preview Version {active} ↗
            </a>
          </div>

          {/* Routing meta */}
          <Group title="Routing &amp; tagging">
            <Field label="Internal name">
              <input
                value={v.name}
                onChange={(e) => setVariantField(active, "name", e.target.value)}
              />
            </Field>
            <Field label="Resend sequence">
              <select
                value={v.sequence}
                onChange={(e) =>
                  setVariantField(
                    active,
                    "sequence",
                    e.target.value as Variant["sequence"]
                  )
                }
              >
                <option value="kickstarter">kickstarter</option>
                <option value="repairkit">repairkit</option>
              </select>
            </Field>
            <div className="adm-row2">
              <Field label="EEC name (tag)">
                <input
                  value={v.eecName}
                  onChange={(e) =>
                    setVariantField(active, "eecName", e.target.value)
                  }
                />
              </Field>
              <Field label="Version label (tag)">
                <input
                  value={v.versionLabel}
                  onChange={(e) =>
                    setVariantField(active, "versionLabel", e.target.value)
                  }
                />
              </Field>
            </div>
            <p className="adm-hint">
              Registrations are tagged{" "}
              <code>
                EVENT-&gt;REGISTRATION-&gt;EEC-&gt;{v.eecName}-&gt;
                {v.versionLabel}
              </code>{" "}
              and enrolled into the <code>{v.sequence}</code> Resend sequence.
            </p>
          </Group>

          {/* Hero */}
          <Group title="Hero">
            <TextField label="Hero headline" value={v.content.heroTitle} onChange={(x) => setContent(active, "heroTitle", x)} long />
            <TextField label="Hero subtitle" value={v.content.heroSubtitle} onChange={(x) => setContent(active, "heroSubtitle", x)} long />
            <div className="adm-row2">
              <TextField label="Book title (cover)" value={v.content.bookTitle} onChange={(x) => setContent(active, "bookTitle", x)} />
              <TextField label="CTA button" value={v.content.ctaButton} onChange={(x) => setContent(active, "ctaButton", x)} />
            </div>
            <TextField label="Book subtitle (cover)" value={v.content.bookSubtitle} onChange={(x) => setContent(active, "bookSubtitle", x)} />
            <div className="adm-row2">
              <TextField label="Email placeholder" value={v.content.emailPlaceholder} onChange={(x) => setContent(active, "emailPlaceholder", x)} />
              <TextField label="Created-by line" value={v.content.createdBy} onChange={(x) => setContent(active, "createdBy", x)} />
            </div>
          </Group>

          {/* Stats */}
          <Group title="Stats band">
            <TextField label="Stats headline" value={v.content.statsHeadline} onChange={(x) => setContent(active, "statsHeadline", x)} long />
            <div className="adm-stats3">
              {v.content.stats.map((s, i) => (
                <div className="adm-statbox" key={i}>
                  <TextField
                    label={`Stat ${i + 1} value`}
                    value={s.value}
                    onChange={(x) =>
                      update((c) => {
                        c.variants[active].content.stats[i].value = x;
                      })
                    }
                  />
                  <TextField
                    label="Label"
                    value={s.label}
                    onChange={(x) =>
                      update((c) => {
                        c.variants[active].content.stats[i].label = x;
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="adm-row2">
              <TextField label="CTA headline" value={v.content.statsCtaHeadline} onChange={(x) => setContent(active, "statsCtaHeadline", x)} />
              <TextField label="CTA subhead" value={v.content.statsCtaSubhead} onChange={(x) => setContent(active, "statsCtaSubhead", x)} />
            </div>
          </Group>

          {/* Curriculum */}
          <Group title="Curriculum (dark section)">
            <div className="adm-row2">
              <TextField label="Eyebrow" value={v.content.curriculumEyebrow} onChange={(x) => setContent(active, "curriculumEyebrow", x)} />
              <TextField label="Section headline" value={v.content.curriculumHeadline} onChange={(x) => setContent(active, "curriculumHeadline", x)} long />
            </div>
            <div className="adm-curlist">
              {v.content.curriculum.map((item, i) => (
                <CurriculumRow
                  key={i}
                  index={i}
                  item={item}
                  onChange={(patch) =>
                    update((c) => {
                      c.variants[active].content.curriculum[i] = {
                        ...c.variants[active].content.curriculum[i],
                        ...patch,
                      };
                    })
                  }
                  onRemove={() =>
                    update((c) => {
                      c.variants[active].content.curriculum.splice(i, 1);
                    })
                  }
                />
              ))}
              <button
                className="adm-btn sm"
                onClick={() =>
                  update((c) => {
                    c.variants[active].content.curriculum.push({
                      label: "DAY",
                      title: "New lesson",
                      desc: "",
                    });
                  })
                }
              >
                + Add item
              </button>
            </div>
          </Group>

          {/* Final / success */}
          <Group title="Final CTA &amp; success">
            <TextField label="Final CTA headline" value={v.content.finalCtaHeadline} onChange={(x) => setContent(active, "finalCtaHeadline", x)} />
            <div className="adm-row2">
              <TextField label="Success headline" value={v.content.successHeadline} onChange={(x) => setContent(active, "successHeadline", x)} />
              <TextField label="Success body" value={v.content.successBody} onChange={(x) => setContent(active, "successBody", x)} long />
            </div>
          </Group>
        </section>
      </div>

      {/* Sticky save bar */}
      <div className="adm-savebar">
        <div>
          {error ? (
            <span className="adm-err">{error}</span>
          ) : savedAt ? (
            <span className="adm-ok">Saved at {savedAt} ✓</span>
          ) : (
            <span className="adm-muted">Unsaved changes apply after you save.</span>
          )}
        </div>
        <button className="adm-btn primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ---------------- small components ----------------

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="adm-group">
      <legend dangerouslySetInnerHTML={{ __html: title }} />
      {children}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="adm-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  long,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  long?: boolean;
}) {
  return (
    <label className="adm-field">
      <span>{label}</span>
      {long ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function CurriculumRow({
  index,
  item,
  onChange,
  onRemove,
}: {
  index: number;
  item: CurriculumItem;
  onChange: (patch: Partial<CurriculumItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="adm-currow">
      <div className="adm-currow__top">
        <input
          className="adm-currow__label"
          value={item.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="LABEL"
        />
        <input
          className="adm-currow__title"
          value={item.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Title"
        />
        <button className="adm-btn sm danger" onClick={onRemove} title="Remove">
          ✕
        </button>
      </div>
      <textarea
        rows={2}
        value={item.desc}
        onChange={(e) => onChange({ desc: e.target.value })}
        placeholder="Description"
      />
    </div>
  );
}

// ---------------- logic ----------------

function computeSplit(config: ABConfig): Record<VariantKey, number> {
  const enabled = KEYS.filter(
    (k) => config.variants[k].enabled && config.variants[k].weight > 0
  );
  const total = enabled.reduce((s, k) => s + config.variants[k].weight, 0);
  const out: Record<VariantKey, number> = { A: 0, B: 0 };
  if (total === 0) {
    // If something is enabled with 0 weight, show even fallback.
    const justEnabled = KEYS.filter((k) => config.variants[k].enabled);
    if (justEnabled.length) {
      const share = Math.round(100 / justEnabled.length);
      justEnabled.forEach((k) => (out[k] = share));
    }
    return out;
  }
  KEYS.forEach((k) => {
    if (config.variants[k].enabled && config.variants[k].weight > 0) {
      out[k] = Math.round((config.variants[k].weight / total) * 100);
    }
  });
  return out;
}

function Styles() {
  return (
    <style>{`
      .adm { min-height: 100vh; background: var(--jh-paper); padding-bottom: 96px; }
      .adm-top {
        position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between;
        background: var(--jh-ink); color: #fff; padding: 12px 20px;
      }
      .adm-top__l { display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-weight: 600; font-size: 14px; }
      .adm-top__l img { height: 22px; filter: brightness(0) invert(1); }
      .adm-top__r { display: flex; align-items: center; gap: 14px; }
      .adm-link { color: #fff; font-size: 13px; font-weight: 600; text-decoration: none; }
      .adm-wrap { max-width: 860px; margin: 24px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 20px; }
      .adm-card { background: #fff; border: 1px solid var(--jh-line); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-1); }
      .adm-card h2 { font-family: var(--font-display); font-size: 20px; margin: 0 0 4px; }
      .adm-sub { font-size: 13px; color: var(--fg-3); margin: 0 0 18px; }

      .adm-traffic { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .adm-traffic__col { border: 1px solid var(--jh-line); border-radius: 12px; padding: 16px; background: var(--jh-paper); }
      .adm-traffic__head { display: flex; align-items: center; justify-content: space-between; }
      .pill { font-family: var(--font-display); font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; color: #fff; }
      .pill-a { background: var(--jh-red); }
      .pill-b { background: var(--rb-blue); }
      .switch { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
      .switch input { width: 16px; height: 16px; }
      .adm-traffic__name { font-family: var(--font-display); font-weight: 600; font-size: 15px; margin-top: 10px; }
      .adm-traffic__seq { font-size: 11px; color: var(--fg-3); margin-top: 4px; }
      .adm-traffic__seq code { font-size: 10.5px; }
      .adm-weight { display: block; font-size: 13px; margin-top: 12px; }
      .adm-weight input[type=range] { width: 100%; accent-color: var(--jh-red); margin-top: 4px; }
      .adm-eff { font-size: 13px; margin-top: 8px; color: var(--fg-2); }

      .adm-presets { display: flex; align-items: center; gap: 8px; margin-top: 16px; flex-wrap: wrap; font-size: 13px; color: var(--fg-3); }

      .adm-tabs { display: flex; gap: 10px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
      .adm-tab {
        flex: 1; min-width: 200px; text-align: left; background: var(--jh-paper); border: 1.5px solid var(--jh-line);
        border-radius: 12px; padding: 12px 14px; cursor: pointer; font-family: var(--font-display); font-weight: 600; font-size: 14px;
        display: flex; flex-direction: column; gap: 2px;
      }
      .adm-tab em { font-style: normal; font-weight: 400; font-size: 12px; color: var(--fg-3); }
      .adm-tab.is-active { border-color: var(--jh-red); box-shadow: 0 0 0 3px rgba(194,0,31,.1); }
      .adm-preview { font-size: 13px; font-weight: 600; color: var(--jh-red); text-decoration: none; white-space: nowrap; }

      .adm-group { border: 1px solid var(--jh-line); border-radius: 12px; padding: 16px; margin: 0 0 16px; }
      .adm-group legend { font-family: var(--font-display); font-weight: 700; font-size: 13px; padding: 0 6px; color: var(--jh-ink); }
      .adm-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
      .adm-field > span { font-family: var(--font-display); font-size: 12px; font-weight: 600; color: var(--fg-2); }
      .adm-field input, .adm-field textarea, .adm-field select {
        font-family: var(--font-body); font-size: 14px; padding: 9px 11px; border: 1.5px solid var(--jh-line-2);
        border-radius: 9px; outline: none; width: 100%; resize: vertical;
      }
      .adm-field input:focus, .adm-field textarea:focus, .adm-field select:focus { border-color: var(--jh-red); box-shadow: 0 0 0 3px rgba(194,0,31,.1); }
      .adm-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .adm-stats3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
      .adm-statbox { border: 1px solid var(--jh-line); border-radius: 10px; padding: 10px; }
      .adm-hint, .adm-hint code { font-size: 12px; color: var(--fg-3); }
      .adm-hint code { background: var(--jh-mist); padding: 1px 5px; border-radius: 4px; }

      .adm-curlist { display: flex; flex-direction: column; gap: 10px; }
      .adm-currow { border: 1px solid var(--jh-line); border-radius: 10px; padding: 10px; background: var(--jh-paper); }
      .adm-currow__top { display: flex; gap: 8px; margin-bottom: 8px; }
      .adm-currow__label { width: 120px; font-weight: 700; font-size: 12px; padding: 8px; border: 1.5px solid var(--jh-line-2); border-radius: 8px; }
      .adm-currow__title { flex: 1; font-size: 14px; padding: 8px; border: 1.5px solid var(--jh-line-2); border-radius: 8px; }
      .adm-currow textarea { width: 100%; font-size: 13px; padding: 8px; border: 1.5px solid var(--jh-line-2); border-radius: 8px; resize: vertical; }

      .adm-btn { font-family: var(--font-display); font-weight: 600; font-size: 14px; border-radius: 9px; border: 1.5px solid var(--jh-line-2); background: #fff; padding: 9px 14px; cursor: pointer; }
      .adm-btn.sm { font-size: 12px; padding: 7px 11px; }
      .adm-btn.primary { background: var(--jh-red); color: #fff; border-color: var(--jh-red); padding: 11px 22px; }
      .adm-btn.primary:disabled { opacity: .6; }
      .adm-btn.ghost { background: transparent; color: #fff; border-color: rgba(255,255,255,.3); }
      .adm-btn.danger { color: var(--jh-red); border-color: var(--jh-red); }

      .adm-savebar {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 40; display: flex; align-items: center; justify-content: space-between;
        background: #fff; border-top: 1px solid var(--jh-line); padding: 14px 24px; box-shadow: 0 -4px 16px rgba(0,0,0,.06);
      }
      .adm-ok { color: var(--rb-green-dark); font-weight: 600; font-size: 13px; }
      .adm-err { color: var(--jh-red); font-weight: 600; font-size: 13px; }
      .adm-muted { color: var(--fg-3); font-size: 13px; }

      @media (max-width: 640px) {
        .adm-traffic, .adm-row2, .adm-stats3 { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}
