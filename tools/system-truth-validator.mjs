#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = String(
  process.env.AIVIS_BASE_URL || process.env.API_URL || "http://localhost:3001",
).replace(/\/$/, "");
const TEST_URL = String(process.env.AIVIS_TEST_URL || "https://example.com");
const REFRESH_LOOPS = Number(process.env.AIVIS_REFRESH_LOOPS || 10);
const SHARE_SPAM_COUNT = Number(process.env.AIVIS_SHARE_SPAM_COUNT || 6);
const ANALYZE_RUNS = Number(process.env.AIVIS_ANALYZE_RUNS || 3);

const TOKENS = {
  observer: process.env.AIVIS_OBSERVER_TOKEN || "",
  starter: process.env.AIVIS_STARTER_TOKEN || "",
  alignment: process.env.AIVIS_ALIGNMENT_TOKEN || "",
  signal: process.env.AIVIS_SIGNAL_TOKEN || "",
};

const issues = [];
const contradictions = [];
const breakpoints = [];
const repro = [];

function addIssue(type, explanation, details = {}) {
  issues.push({ type, explanation, ...details });
}

function addContradiction(summary, details = {}) {
  contradictions.push({ summary, ...details });
}

function addBreakpoint(summary, details = {}) {
  breakpoints.push({ summary, ...details });
}

function addRepro(step, expected, actual) {
  repro.push({ step, expected, actual });
}

async function fetchJson(endpoint, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      payload: { error: String(error?.message || "Network request failed") },
      headers: new Headers(),
      networkError: true,
    };
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    headers: response.headers,
    networkError: false,
  };
}

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

function passFail(flag) {
  return flag ? "PASS" : "FAIL";
}

async function auditPricingContract() {
  const pricing = await fetchJson("/api/payment/pricing");
  if (!pricing.ok || !Array.isArray(pricing.payload?.tiers)) {
    addIssue(
      "PRICING_ENDPOINT_UNAVAILABLE",
      "Cannot validate pricing contract without /api/payment/pricing.",
      {
        status: pricing.status,
      },
    );
    addBreakpoint("Revenue leakage risk: pricing contract unavailable.", {
      status: pricing.status,
    });
    addRepro("GET /api/payment/pricing", "200 + tiers[]", `${pricing.status}`);
    return null;
  }

  const tiers = pricing.payload.tiers;
  const byKey = Object.fromEntries(
    tiers.map((t) => [String(t.key || "").toLowerCase(), t]),
  );

  for (const key of ["observer", "starter", "alignment", "signal"]) {
    if (!byKey[key]) {
      addIssue(
        "MISSING_TIER_IN_PRICING",
        `Tier ${key} is missing from /api/payment/pricing.`,
      );
      addRepro(
        "GET /api/payment/pricing",
        `includes tier ${key}`,
        "tier missing",
      );
    }
  }

  const scorefix = byKey.scorefix;
  if (
    scorefix &&
    scorefix.billingModel !== "one_time" &&
    scorefix.billingModel !== "subscription"
  ) {
    addIssue("INVALID_BILLING_MODEL", "scorefix billingModel is invalid.", {
      actual: scorefix.billingModel,
    });
  }

  return { tiers, byKey };
}

async function auditUiVsBackend(pricing) {
  const pricingViewPath = path.join(
    process.cwd(),
    "client/src/views/PricingPage.tsx",
  );
  const reportsPath = path.join(
    process.cwd(),
    "client/src/views/ReportsPage.tsx",
  );
  const staticPricingPath = path.join(
    process.cwd(),
    "client/scripts/templates/pricing-static.html",
  );

  const [pricingView, reportsView, staticPricing] = await Promise.all([
    fs.readFile(pricingViewPath, "utf8"),
    fs.readFile(reportsPath, "utf8"),
    fs.readFile(staticPricingPath, "utf8"),
  ]);

  if (reportsView.includes("meetsMinimumTier(")) {
    addContradiction(
      "UI tier-guess gating detected in ReportsPage (tier name checks instead of resolved feature flags).",
      {
        file: "client/src/views/ReportsPage.tsx",
      },
    );
    addIssue(
      "UI_BACKEND_GATING_DRIFT",
      "ReportsPage still contains tier-based gating logic that may diverge from backend feature flags.",
    );
    addRepro(
      "Inspect ReportsPage gating",
      "Feature flags from refresh/pricing drive gating",
      "Tier label check via meetsMinimumTier(...) found",
    );
  }

  const backendScorefixModel = pricing?.byKey?.scorefix?.billingModel;
  const staticSaysOneTime = /score\s*fix[^\n]*\$299\s*one-time/i.test(
    staticPricing,
  );
  const viewSaysNonRecurring = /not a recurring subscription tier/i.test(
    pricingView,
  );

  if (backendScorefixModel === "subscription" && staticSaysOneTime) {
    addContradiction(
      "Static pricing says Score Fix is one-time while backend pricing reports subscription.",
      {
        expected: backendScorefixModel,
        actual: "one-time marketing copy",
      },
    );
    addBreakpoint(
      "Revenue leakage / trust risk: billing model contradiction for Score Fix.",
      {},
    );
    addRepro(
      "GET /api/payment/pricing + read pricing-static.html",
      "Same billing model in both layers",
      "Backend=subscription, static page=one-time",
    );
  }

  if (backendScorefixModel === "subscription" && viewSaysNonRecurring) {
    addContradiction(
      "Live pricing view says Score Fix is non-recurring while backend pricing reports subscription.",
      {
        expected: backendScorefixModel,
        actual: "non-recurring copy in PricingPage.tsx",
      },
    );
    addRepro(
      "GET /api/payment/pricing + inspect PricingPage.tsx",
      "UI wording matches backend billing model",
      "UI states non-recurring, backend states subscription",
    );
  }
}

async function runTierChecks(pricing) {
  const results = {};

  for (const tier of ["observer", "starter", "alignment", "signal"]) {
    const token = TOKENS[tier];
    if (!token) {
      results[tier] = {
        skipped: true,
        reason: `Missing token env AIVIS_${tier.toUpperCase()}_TOKEN`,
      };
      continue;
    }

    const refresh = await fetchJson("/api/user/refresh", {
      method: "POST",
      token,
    });
    if (!refresh.ok) {
      addIssue("AUTH_REFRESH_FAILED", `Refresh failed for tier ${tier}`, {
        status: refresh.status,
      });
      addRepro(
        `POST /api/user/refresh (${tier})`,
        "200 success",
        `${refresh.status}`,
      );
      results[tier] = { refreshOk: false };
      continue;
    }

    const ent = refresh.payload?.entitlements?.features || {};
    const audits = await fetchJson("/api/audits?limit=5", { token });

    const expectedHistory = Boolean(ent.reportHistory);
    if (expectedHistory && !audits.ok) {
      addIssue(
        "FEATURE_ACCESS_INTEGRITY",
        `${tier} expected reportHistory=true but /api/audits failed.`,
        {
          status: audits.status,
        },
      );
      addRepro(
        `GET /api/audits (${tier})`,
        "200 with audits list",
        `${audits.status}`,
      );
    }
    if (!expectedHistory && audits.ok) {
      addIssue(
        "UNAUTHORIZED_ACCESS_LEAK",
        `${tier} expected reportHistory=false but /api/audits succeeded.`,
      );
      addBreakpoint(
        "Unauthorized access risk: report history endpoint accessible when feature is disabled.",
        {
          tier,
        },
      );
      addRepro(
        `GET /api/audits (${tier})`,
        "403 feature locked",
        "200 success",
      );
    }

    let sampleAudit = null;
    if (
      audits.ok &&
      Array.isArray(audits.payload?.audits) &&
      audits.payload.audits.length > 0
    ) {
      sampleAudit = audits.payload.audits[0];
      const detail = await fetchJson(`/api/audits/${sampleAudit.id}`, {
        token,
      });
      if (!detail.ok) {
        addIssue(
          "AUDIT_SNAPSHOT_INCONSISTENT",
          `${tier} list has audit id but /api/audits/:id failed.`,
          {
            status: detail.status,
            auditId: sampleAudit.id,
          },
        );
      }
    }

    const pdfRes = await fetchJson("/api/features/exports/generate-pdf", {
      method: "POST",
      token,
      body: {
        html: "<!doctype html><html><body><h1>Audit</h1><p>Validation PDF payload for gating check.</p><p>0123456789abcdefghijklmnopqrstuvwxyz</p></body></html>",
        branded: false,
      },
    });

    const expectedExport = Boolean(ent.exports);
    if (expectedExport && !pdfRes.ok) {
      addIssue(
        "EXPORT_GATING_MISMATCH",
        `${tier} expected export=true but PDF export failed.`,
        {
          status: pdfRes.status,
        },
      );
      addRepro(
        `POST /api/features/exports/generate-pdf (${tier})`,
        "200/pdf",
        `${pdfRes.status}`,
      );
    }
    if (!expectedExport && pdfRes.ok) {
      addIssue(
        "UNAUTHORIZED_EXPORT",
        `${tier} expected export=false but PDF export succeeded.`,
      );
      addBreakpoint(
        "Revenue leakage risk: export endpoint accessible without entitlement.",
        { tier },
      );
      addRepro(
        `POST /api/features/exports/generate-pdf (${tier})`,
        "403 feature locked",
        "200 success",
      );
    }

    let shareStatuses = [];
    if (sampleAudit) {
      for (let i = 0; i < SHARE_SPAM_COUNT; i += 1) {
        const share = await fetchJson("/api/audits/share-link", {
          method: "POST",
          token,
          body: {
            url: sampleAudit.url,
            analyzedAt: sampleAudit.created_at,
            auditId: sampleAudit.id,
            expiration_days: 30,
          },
        });
        shareStatuses.push({
          status: share.status,
          ok: share.ok,
          path: share.payload?.share_path || "",
        });
      }

      const expectedShare = Boolean(ent.shareableLink);
      const anyShareOk = shareStatuses.some((s) => s.ok);
      if (expectedShare && !anyShareOk) {
        addIssue(
          "SHARE_GATING_MISMATCH",
          `${tier} expected shareableLink=true but share-link creation failed.`,
        );
        addRepro(
          "POST /api/audits/share-link",
          "200 with share_path",
          JSON.stringify(shareStatuses),
        );
      }
      if (!expectedShare && anyShareOk) {
        addIssue(
          "UNAUTHORIZED_SHARE_LINK",
          `${tier} expected shareableLink=false but share-link creation succeeded.`,
        );
        addBreakpoint(
          "Unauthorized access risk: share-link endpoint accessible without entitlement.",
          {
            tier,
          },
        );
      }

      const distinctPaths = new Set(
        shareStatuses
          .filter((s) => s.ok)
          .map((s) => s.path)
          .filter(Boolean),
      );
      if (distinctPaths.size > 1) {
        addIssue(
          "SHARE_LINK_REGEN_DRIFT",
          `${tier} share-link spam generated multiple distinct snapshot paths.`,
          {
            distinctPaths: Array.from(distinctPaths),
          },
        );
      }
    }

    // auth loop stability
    let refreshFailures = 0;
    for (let i = 0; i < REFRESH_LOOPS; i += 1) {
      const r = await fetchJson("/api/user/refresh", { method: "POST", token });
      if (!r.ok) refreshFailures += 1;
    }
    if (refreshFailures > 0) {
      addIssue(
        "AUTH_STABILITY_DRIFT",
        `${tier} had refresh loop failures (${refreshFailures}/${REFRESH_LOOPS}).`,
      );
      addRepro(
        `POST /api/user/refresh x${REFRESH_LOOPS} (${tier})`,
        "all 200 for stable token",
        `${refreshFailures} failures`,
      );
    }

    results[tier] = {
      refreshOk: true,
      featureFlags: ent,
      auditsStatus: audits.status,
      pdfStatus: pdfRes.status,
      shareStatuses,
      refreshFailures,
    };
  }

  return results;
}

async function runAnalyzeDeterminism(tierResults) {
  const firstTier = ["signal", "alignment", "starter", "observer"].find(
    (k) => TOKENS[k],
  );
  if (!firstTier) {
    addIssue(
      "ANALYZE_DETERMINISM_SKIPPED",
      "No tier token available for determinism test.",
    );
    return;
  }

  const token = TOKENS[firstTier];
  const runs = [];
  for (let i = 0; i < ANALYZE_RUNS; i += 1) {
    const run = await fetchJson("/api/analyze", {
      method: "POST",
      token,
      body: {
        url: TEST_URL,
      },
    });
    runs.push(run);
  }

  const successful = runs.filter(
    (r) => r.ok && r.payload && typeof r.payload === "object",
  );
  if (successful.length < 2) {
    addIssue(
      "AUDIT_DETERMINISM_UNVERIFIED",
      "Could not collect enough successful /api/analyze responses for determinism check.",
      {
        statuses: runs.map((r) => r.status),
      },
    );
    return;
  }

  const snapshots = successful.map((r) => ({
    visibility_score: r.payload.visibility_score,
    seo_diagnostics: r.payload.seo_diagnostics,
    strict_rubric: r.payload.strict_rubric,
  }));

  const first = snapshots[0];
  const drift = snapshots.some(
    (s) =>
      String(s.visibility_score) !== String(first.visibility_score) ||
      stableJson(s.seo_diagnostics) !== stableJson(first.seo_diagnostics) ||
      stableJson(s.strict_rubric) !== stableJson(first.strict_rubric),
  );

  if (drift) {
    addIssue(
      "NON_DETERMINISTIC_ENGINE",
      "Same URL produced unstable analysis fields across repeated runs.",
      {
        runs: snapshots,
      },
    );
    addBreakpoint(
      "Inconsistent AI visibility scoring risk: same input not replay-stable.",
      {
        url: TEST_URL,
      },
    );
    addRepro(
      `POST /api/analyze x${ANALYZE_RUNS} (${TEST_URL})`,
      "Stable visibility_score + seo_diagnostics + strict_rubric",
      JSON.stringify(snapshots),
    );
  }
}

function summarize() {
  const featureConsistencyPass = !issues.some((i) =>
    [
      "FEATURE_ACCESS_INTEGRITY",
      "UNAUTHORIZED_ACCESS_LEAK",
      "UNAUTHORIZED_EXPORT",
      "UNAUTHORIZED_SHARE_LINK",
    ].includes(i.type),
  );
  const pricingAlignmentPass = contradictions.length === 0;
  const auditDeterminismPass = !issues.some((i) =>
    ["NON_DETERMINISTIC_ENGINE", "AUDIT_SNAPSHOT_INCONSISTENT"].includes(
      i.type,
    ),
  );
  const shareExportPass = !issues.some((i) =>
    [
      "EXPORT_GATING_MISMATCH",
      "SHARE_GATING_MISMATCH",
      "SHARE_LINK_REGEN_DRIFT",
      "UNAUTHORIZED_EXPORT",
      "UNAUTHORIZED_SHARE_LINK",
    ].includes(i.type),
  );
  const authStabilityPass = !issues.some((i) =>
    ["AUTH_STABILITY_DRIFT", "AUTH_REFRESH_FAILED"].includes(i.type),
  );

  const overallPass =
    featureConsistencyPass &&
    pricingAlignmentPass &&
    auditDeterminismPass &&
    shareExportPass &&
    authStabilityPass;
  const confidence = Math.max(
    0,
    100 -
      (issues.length * 8 +
        contradictions.length * 10 +
        breakpoints.length * 12),
  );

  console.log(`STATUS: ${overallPass ? "PASS" : "FAIL"}`);
  console.log("");
  console.log("PASS / FAIL SUMMARY");
  console.log(`Feature consistency: ${passFail(featureConsistencyPass)}`);
  console.log(`Pricing alignment: ${passFail(pricingAlignmentPass)}`);
  console.log(`Audit determinism: ${passFail(auditDeterminismPass)}`);
  console.log(`Share/export integrity: ${passFail(shareExportPass)}`);
  console.log(`Auth stability: ${passFail(authStabilityPass)}`);
  console.log("");

  console.log("CONTRADICTIONS FOUND");
  if (contradictions.length === 0) {
    console.log("- None");
  } else {
    contradictions.forEach((c, idx) => {
      console.log(`${idx + 1}. ${c.summary}`);
      if (c.expected !== undefined || c.actual !== undefined) {
        console.log(`   expected: ${String(c.expected ?? "")}`);
        console.log(`   actual: ${String(c.actual ?? "")}`);
      }
    });
  }
  console.log("");

  console.log("ISSUES:");
  if (issues.length === 0) {
    console.log("- None");
  } else {
    issues.forEach((i) => {
      console.log(`- [${i.type}]: ${i.explanation}`);
    });
  }
  console.log("");

  console.log("CRITICAL BREAKPOINTS");
  if (breakpoints.length === 0) {
    console.log("- None");
  } else {
    breakpoints.forEach((b, idx) => {
      console.log(`${idx + 1}. ${b.summary}`);
    });
  }
  console.log("");

  console.log("REPRO STEPS");
  if (repro.length === 0) {
    console.log("- None");
  } else {
    repro.forEach((r, idx) => {
      console.log(`${idx + 1}. step: ${r.step}`);
      console.log(`   expected: ${r.expected}`);
      console.log(`   actual: ${r.actual}`);
    });
  }
  console.log("");

  console.log(`SYSTEM_CONFIDENCE_SCORE (0–100): ${confidence}`);
}

(async function main() {
  console.log(
    `[AiVIS system truth validator] base=${BASE_URL} testUrl=${TEST_URL}`,
  );

  const pricing = await auditPricingContract();
  await auditUiVsBackend(pricing);
  const tierResults = await runTierChecks(pricing);
  await runAnalyzeDeterminism(tierResults);

  // Explicitly mark scenarios that need privileged orchestration or browser runtime state.
  addIssue(
    "TIER_DOWNGRADE_SIMULATION_PARTIAL",
    "Immediate downgrade revocation requires privileged billing mutation or admin test harness; validate with webhook-triggered tier change in staging.",
  );
  addIssue(
    "OFFLINE_UI_SESSION_TEST_PARTIAL",
    "UI logout-on-transient-failure behavior requires browser automation with network throttling; API-only audit cannot prove client store transition correctness.",
  );

  summarize();
})();
