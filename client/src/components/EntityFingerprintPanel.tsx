import React, { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../config";
import {
  Fingerprint,
  Shield,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Globe,
  User,
  Hash,
  Link2,
  Search,
  X,
} from "lucide-react";
import type { EntityFingerprint, BlocklistEntry, CollisionCluster } from "@shared/types";

/* ── API helpers ──────────────────────────────────────────────────────────── */

function authHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...authHeaders(), ...(init.headers || {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || `Request failed (${res.status})`);
  }
  return res.json();
}

/* ── Social platform list ─────────────────────────────────────────────────── */
const SOCIAL_PLATFORMS = ["twitter", "linkedin", "github", "youtube", "facebook", "instagram", "tiktok", "mastodon"] as const;

/* ── Anchor score ring ────────────────────────────────────────────────────── */
function AnchorScoreRing({ score }: { score: number }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 60 ? "#10b981" : score >= 30 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center">
      <svg width={80} height={80} className="-rotate-90">
        <circle cx={40} cy={40} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        <circle
          cx={40} cy={40} r={radius} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-lg font-bold text-white">{score}</span>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
export default function EntityFingerprintPanel() {
  const [fingerprint, setFingerprint] = useState<EntityFingerprint | null>(null);
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
  const [anchorScore, setAnchorScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form state
  const [brandName, setBrandName] = useState("");
  const [canonicalDomain, setCanonicalDomain] = useState("");
  const [founderName, setFounderName] = useState("");
  const [socialHandles, setSocialHandles] = useState<Record<string, string>>({});
  const [wikidataId, setWikidataId] = useState("");
  const [googleKgId, setGoogleKgId] = useState("");
  const [schemaOrgId, setSchemaOrgId] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  // Blocklist form
  const [blPattern, setBlPattern] = useState("");
  const [blType, setBlType] = useState<"name" | "domain" | "keyword" | "entity_type">("name");
  const [blReason, setBlReason] = useState("");

  // Collision detection
  const [scanning, setScanning] = useState(false);
  const [collisions, setCollisions] = useState<CollisionCluster[]>([]);
  const [showCollisions, setShowCollisions] = useState(false);

  // Section toggles
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBlocklist, setShowBlocklist] = useState(false);

  /* ── Load fingerprint + blocklist ───────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [fpRes, blRes] = await Promise.all([
        apiFetchJson<{ success: boolean; fingerprint: EntityFingerprint | null; anchor_score: number }>("/api/entity/fingerprint"),
        apiFetchJson<{ success: boolean; blocklist: BlocklistEntry[] }>("/api/entity/blocklist"),
      ]);
      if (fpRes.fingerprint) {
        setFingerprint(fpRes.fingerprint);
        setBrandName(fpRes.fingerprint.brand_name);
        setCanonicalDomain(fpRes.fingerprint.canonical_domain);
        setFounderName(fpRes.fingerprint.founder_name || "");
        setSocialHandles(fpRes.fingerprint.social_handles || {});
        setWikidataId(fpRes.fingerprint.wikidata_id || "");
        setGoogleKgId(fpRes.fingerprint.google_kg_id || "");
        setSchemaOrgId(fpRes.fingerprint.schema_org_id || "");
        setProductCategory(fpRes.fingerprint.product_category || "");
        setKeywords(fpRes.fingerprint.description_keywords || []);
      }
      setAnchorScore(fpRes.anchor_score || 0);
      setBlocklist(blRes.blocklist || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Save fingerprint ───────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!brandName.trim() || !canonicalDomain.trim()) {
      setError("Brand name and canonical domain are required.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await apiFetchJson<{ success: boolean; fingerprint: EntityFingerprint; anchor_score: number }>("/api/entity/fingerprint", {
        method: "PUT",
        body: JSON.stringify({
          brand_name: brandName.trim(),
          canonical_domain: canonicalDomain.trim(),
          founder_name: founderName.trim(),
          social_handles: socialHandles,
          wikidata_id: wikidataId.trim(),
          google_kg_id: googleKgId.trim(),
          schema_org_id: schemaOrgId.trim(),
          product_category: productCategory.trim(),
          description_keywords: keywords,
        }),
      });
      setFingerprint(res.fingerprint);
      setAnchorScore(res.anchor_score);
      setSuccessMsg("Entity fingerprint saved");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Add keyword ────────────────────────────────────────────────────── */
  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw.length >= 2 && !keywords.includes(kw) && keywords.length < 20) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  };

  /* ── Social handle update ───────────────────────────────────────────── */
  const updateSocial = (platform: string, value: string) => {
    setSocialHandles(prev => ({ ...prev, [platform]: value }));
  };

  /* ── Blocklist add ──────────────────────────────────────────────────── */
  const addBlocklistEntry = async () => {
    if (!blPattern.trim()) return;
    setError("");
    try {
      await apiFetchJson("/api/entity/blocklist", {
        method: "POST",
        body: JSON.stringify({ pattern: blPattern.trim(), type: blType, reason: blReason.trim() }),
      });
      setBlPattern("");
      setBlReason("");
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  /* ── Blocklist remove ───────────────────────────────────────────────── */
  const removeBlockEntry = async (id: string) => {
    try {
      await apiFetchJson(`/api/entity/blocklist/${id}`, { method: "DELETE" });
      setBlocklist(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  /* ── Collision detection ────────────────────────────────────────────── */
  const runCollisionScan = async () => {
    if (!brandName.trim()) return;
    setScanning(true);
    setError("");
    try {
      const res = await apiFetchJson<{ success: boolean; result: { collisions: CollisionCluster[]; anchor_score: number; suggested_blocklist: any[] } }>("/api/entity/detect-collisions", {
        method: "POST",
        body: JSON.stringify({ brand_name: brandName.trim(), canonical_domain: canonicalDomain.trim() }),
      });
      setCollisions(res.result.collisions || []);
      setAnchorScore(res.result.anchor_score);
      setShowCollisions(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  /* ── Accept collision blocklist suggestions ─────────────────────────── */
  const acceptSuggestions = async (entries: Array<{ pattern: string; type: string; reason: string }>) => {
    try {
      await apiFetchJson("/api/entity/accept-blocklist", {
        method: "POST",
        body: JSON.stringify({ entries }),
      });
      await loadData();
      setShowCollisions(false);
      setSuccessMsg("Blocklist entries added from collision scan");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-white/40" />
        <span className="ml-2 text-sm text-white/40">Loading entity fingerprint…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Header with anchor score ─────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-charcoal p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Fingerprint className="h-5 w-5 text-cyan-400" />
              <h3 className="text-base font-semibold text-white">Entity Fingerprint</h3>
            </div>
            <p className="text-xs text-white/50 max-w-lg">
              Anchor your brand identity so citation tests, authority checks, and competitor tracking only surface results about <em>your</em> entity — not name collisions.
            </p>
          </div>
          <div className="text-center shrink-0">
            <AnchorScoreRing score={anchorScore} />
            <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">Anchor score</p>
          </div>
        </div>

        {/* Status messages */}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {successMsg}
          </div>
        )}
      </section>

      {/* ── Core identity fields ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-charcoal p-5 space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-medium text-white">
          <Globe className="h-4 w-4 text-white/60" /> Core identity
        </h4>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-white/50 mb-1">Brand name *</label>
            <input
              type="text" value={brandName} onChange={e => setBrandName(e.target.value)}
              placeholder="AiVIS.biz" maxLength={200}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 focus:border-cyan-400/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Canonical domain *</label>
            <input
              type="text" value={canonicalDomain} onChange={e => setCanonicalDomain(e.target.value)}
              placeholder="aivis.biz" maxLength={255}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 focus:border-cyan-400/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Founder / key person</label>
            <input
              type="text" value={founderName} onChange={e => setFounderName(e.target.value)}
              placeholder="Mase" maxLength={200}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 focus:border-cyan-400/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Product category</label>
            <input
              type="text" value={productCategory} onChange={e => setProductCategory(e.target.value)}
              placeholder="AI Visibility Audit" maxLength={200}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/25 focus:border-cyan-400/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Social handles */}
        <div>
          <label className="block text-xs text-white/50 mb-2">Social handles</label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {SOCIAL_PLATFORMS.map(platform => (
              <div key={platform} className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/40 w-16 shrink-0 capitalize">{platform}</span>
                <input
                  type="text"
                  value={socialHandles[platform] || ""}
                  onChange={e => updateSocial(platform, e.target.value)}
                  placeholder={`@handle`}
                  className="w-full rounded border border-white/8 bg-white/[0.03] px-2 py-1 text-xs text-white placeholder-white/20 focus:border-cyan-400/40 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Description keywords */}
        <div>
          <label className="block text-xs text-white/50 mb-1">Description keywords <span className="text-white/30">({keywords.length}/20)</span></label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {keywords.map(kw => (
              <span key={kw} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-xs text-white/70">
                {kw}
                <button type="button" onClick={() => setKeywords(keywords.filter(k => k !== kw))} className="text-white/30 hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addKeyword())}
              placeholder="e.g. AI visibility, citation testing, AEO"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-white/25 focus:border-cyan-400/50 focus:outline-none"
            />
            <button type="button" onClick={addKeyword} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Advanced identifiers ────────────────────────────────────── */}
        <div>
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors">
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Advanced identifiers (Wikidata, Knowledge Graph, Schema.org)
          </button>
          {showAdvanced && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-white/40 mb-1">Wikidata ID</label>
                <input
                  type="text" value={wikidataId} onChange={e => setWikidataId(e.target.value)}
                  placeholder="Q12345678" maxLength={50}
                  className="w-full rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-white placeholder-white/20 focus:border-cyan-400/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Google KG ID</label>
                <input
                  type="text" value={googleKgId} onChange={e => setGoogleKgId(e.target.value)}
                  placeholder="/g/..." maxLength={100}
                  className="w-full rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-white placeholder-white/20 focus:border-cyan-400/40 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Schema.org ID</label>
                <input
                  type="text" value={schemaOrgId} onChange={e => setSchemaOrgId(e.target.value)}
                  placeholder="https://schema.org/..." maxLength={300}
                  className="w-full rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-white placeholder-white/20 focus:border-cyan-400/40 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Save + scan buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button" onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save fingerprint
          </button>
          <button
            type="button" onClick={runCollisionScan} disabled={scanning || !brandName.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-40"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Scan for collisions
          </button>
        </div>
      </section>

      {/* ── Collision detection results ───────────────────────────────── */}
      {showCollisions && collisions.length > 0 && (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h4 className="text-sm font-medium text-amber-300">
              {collisions.length} entity collision{collisions.length !== 1 ? "s" : ""} detected
            </h4>
          </div>
          <p className="text-xs text-white/50">
            These entities share your brand name but are different organizations. Add them to your blocklist to prevent false positives.
          </p>
          <div className="space-y-2">
            {collisions.map((c, i) => (
              <div key={i} className="rounded-xl border border-white/8 bg-charcoal-deep p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium text-white/80">{c.name}</span>
                    <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/40">{c.entity_type}</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-white/40 line-clamp-2">{c.description}</p>
                {c.suggested_blocks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => acceptSuggestions(c.suggested_blocks.map(b => ({ pattern: b.pattern, type: b.type, reason: b.reason })))}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-[11px] text-amber-300 hover:bg-amber-500/20 transition-colors"
                  >
                    <Shield className="h-3 w-3" /> Block {c.suggested_blocks.length} pattern{c.suggested_blocks.length !== 1 ? "s" : ""}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Blocklist management ──────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-charcoal p-5">
        <button type="button" onClick={() => setShowBlocklist(!showBlocklist)} className="flex items-center gap-2 w-full text-left">
          <Shield className="h-4 w-4 text-white/60" />
          <h4 className="text-sm font-medium text-white flex-1">
            Blocklist <span className="text-white/30 font-normal">({blocklist.length} entries)</span>
          </h4>
          {showBlocklist ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
        </button>

        {showBlocklist && (
          <div className="mt-4 space-y-3">
            {/* Add new entry */}
            <div className="flex flex-wrap gap-2">
              <input
                type="text" value={blPattern} onChange={e => setBlPattern(e.target.value)} placeholder="Pattern (e.g. AivisSpeech)"
                className="flex-1 min-w-[160px] rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-white/25 focus:border-cyan-400/50 focus:outline-none"
              />
              <select
                value={blType} onChange={e => setBlType(e.target.value as any)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white focus:border-cyan-400/50 focus:outline-none"
              >
                <option value="name">Name</option>
                <option value="domain">Domain</option>
                <option value="keyword">Keyword</option>
                <option value="entity_type">Entity type</option>
              </select>
              <input
                type="text" value={blReason} onChange={e => setBlReason(e.target.value)} placeholder="Reason (optional)"
                className="flex-1 min-w-[120px] rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white placeholder-white/25 focus:border-cyan-400/50 focus:outline-none"
              />
              <button type="button" onClick={addBlocklistEntry} disabled={!blPattern.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>

            {/* Existing entries */}
            {blocklist.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-3">No blocklist entries yet. Run a collision scan or add patterns manually.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {blocklist.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/40 shrink-0">{entry.type}</span>
                      <span className="text-xs text-white/70 truncate">{entry.pattern}</span>
                      {entry.auto_detected && <span className="text-[9px] text-amber-400/60">auto</span>}
                      {entry.reason && <span className="text-[10px] text-white/25 truncate hidden sm:block">— {entry.reason}</span>}
                    </div>
                    <button type="button" onClick={() => removeBlockEntry(entry.id)} className="text-white/20 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
