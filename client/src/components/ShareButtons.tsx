import React, { useMemo, useState } from "react";
import { Share2, Twitter, Linkedin, Link2, Check, Facebook } from "lucide-react";
import toast from "react-hot-toast";
import { PUBLIC_APP_ORIGIN } from "../config";
import apiFetch from "../utils/api";
import { useSettingsStore } from "../stores/settingsStore";

interface ShareButtonsProps {
  url: string;
  score: number;
  title?: string;
  analyzedAt?: string;
  scanCount?: number;
  auditId?: string;
}

function formatScanLabel(scanCount?: number): string {
  return `Audit #${Math.max(1, Number(scanCount || 1))}`;
}

/**
 * Branded social share strip — Twitter / LinkedIn / Facebook / Copy Link.
 * Generates a share URL that opens the app with the audited URL pre-filled.
 */

/**
 * 3-layer clipboard write.
 * Layer 1: Async Clipboard API (modern, secure context required)
 * Layer 2: execCommand fallback (deprecated but broadly supported)
 * Layer 3: Returns false — caller shows window.prompt fallback
 */
async function writeToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return true;
  } catch {
    // fall through
  }
  return false;
}

export default function ShareButtons({ url, score, title, analyzedAt, scanCount, auditId }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [resolvedShareUrl, setResolvedShareUrl] = useState<string | null>(null);
  const [resolvedExpiresAt, setResolvedExpiresAt] = useState<string | undefined>(undefined);
  const [resolvedScanLabel, setResolvedScanLabel] = useState<string | null>(null);
  const shareBtnBase =
    "social-share-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all text-outline-white-strong";

  const displayDomain = (() => { try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname; } catch { return url; } })();

  const shareLabel = resolvedScanLabel || formatScanLabel(scanCount);

  // Score-based unique share messages — authentic, not AI-formatted
  const shareText = (() => {
    if (score >= 90) return `Visibility benchmark for ${displayDomain}: ${score}/100 — citation-ready across ChatGPT, Perplexity, Claude, and Google AI.`;
    if (score >= 75) return `Visibility benchmark for ${displayDomain}: ${score}/100 — strong AI visibility with room to tighten structured data and citation signals.`;
    if (score >= 60) return `Visibility benchmark for ${displayDomain}: ${score}/100 — decent foundation but missing key signals that AI models look for.`;
    if (score >= 40) return `Visibility benchmark for ${displayDomain}: ${score}/100 — most answer engines are overlooking this site. Fixable with structured markup.`;
    return `Visibility benchmark for ${displayDomain}: ${score}/100 — answer engines can barely read this site. Real fixes needed.`;
  })();

  function formatShareExpiryLabel(expiresAt?: string): string {
    if (!expiresAt) return 'Expiration follows your current share-link policy.';
    const dt = new Date(expiresAt);
    if (Number.isNaN(dt.getTime())) return 'Expiration follows your current share-link policy.';
    const diffMs = dt.getTime() - Date.now();
    if (diffMs > 60 * 60 * 24 * 365 * 5 * 1000) return 'Link set to never expire (long-lived public snapshot).';
    if (diffMs <= 0) return `Link already expired at ${dt.toLocaleString()}.`;
    return `Link expires ${dt.toLocaleString()}.`;
  }

  const canRequestPublicShare = useMemo(
    () => Boolean(analyzedAt && url && !url.startsWith("upload://")),
    [analyzedAt, url]
  );

  async function resolveShareUrl(): Promise<{ url: string; expiresAt?: string }> {
    if (resolvedShareUrl) return { url: resolvedShareUrl, expiresAt: resolvedExpiresAt };
    if (!canRequestPublicShare) {
      throw new Error("Public share link unavailable for this result.");
    }

    try {
      const response = await apiFetch("/api/audits/share-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          analyzedAt,
          auditId,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Shareable public links require Alignment or Signal.");
        }
        const errBody = await response.text().catch(() => "");
        let errMsg = `Could not create a public share link (${response.status}).`;
        try {
          const errPayload = JSON.parse(errBody);
          if (errPayload?.error) errMsg = errPayload.error;
        } catch { /* body not JSON */ }
        throw new Error(errMsg);
      }

      // Guard against non-JSON responses (e.g. SPA fallback returning HTML)
      const ct = String(response.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("application/json")) {
        console.error("[ShareButtons] Non-JSON content-type:", ct);
        throw new Error("Share endpoint returned a non-JSON response. Please try again.");
      }

      // Read body as text first so we can diagnose parse failures
      const rawText = await response.text();
      let payload: {
        token?: string;
        slug?: string;
        share_path?: string;
        expires_at?: string;
        scan_label?: string;
        scan_ordinal?: number;
      } | null = null;
      try {
        payload = JSON.parse(rawText);
      } catch {
        console.error("[ShareButtons] JSON parse failed. Body preview:", rawText.slice(0, 300));
        throw new Error("Share endpoint returned an unparseable response. Please try again.");
      }
      if (!payload?.token && !payload?.share_path) {
        console.error("[ShareButtons] Missing token/share_path:", JSON.stringify(payload).slice(0, 300));
        throw new Error("Share endpoint returned an incomplete response. Please retry.");
      }
      const publicPath = payload.share_path || `/reports/public/${payload.slug || payload.token}`;
      const publicUrl = `${PUBLIC_APP_ORIGIN}${publicPath}`;
      setResolvedShareUrl(publicUrl);
      setResolvedExpiresAt(payload.expires_at);
      setResolvedScanLabel(payload.scan_label || formatScanLabel(payload.scan_ordinal || scanCount));
      return { url: publicUrl, expiresAt: payload.expires_at };
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error("Could not create a public share link.");
    }
  }

  async function openSocial(platform: "twitter" | "linkedin" | "facebook") {
    try {
      const resolved = await resolveShareUrl();
      const shareUrl = resolved.url;
      const socialUrl =
        platform === "twitter"
          ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
          : platform === "linkedin"
            ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
            : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;

      window.open(socialUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create public share link");
    }
  }

  async function handleCopy() {
    let shareUrl: string;
    let expiresAt: string | undefined;
    try {
      const resolved = await resolveShareUrl();
      shareUrl = resolved.url;
      expiresAt = resolved.expiresAt;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create share link";
      toast.error(message);
      return;
    }

    const copyPayload = `${shareText}\n${shareUrl}`;
    const copied = await writeToClipboard(copyPayload);
    if (copied) {
      setCopied(true);
      toast.success(`Link copied! ${formatShareExpiryLabel(expiresAt)}`);
      setTimeout(() => setCopied(false), 2500);
    } else {
      // Last-resort: prompt so user can copy manually
      try { window.prompt("Copy this link (Ctrl+C / Cmd+C):", shareUrl); } catch {}
    }
  }

  async function handleNativeShare() {
    let shareUrl = "";
    try {
      const resolved = await resolveShareUrl();
      shareUrl = resolved.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create public share link");
      return;
    }

    if (navigator.share) {
      navigator
        .share({
          title: title || `AI Visibility Score: ${score}/100`,
          text: shareText,
          url: shareUrl,
        })
        .catch(() => {});
      return;
    }

    void handleCopy();
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-white/70 mr-1 flex items-center gap-1 font-medium">
        <Share2 className="w-3 h-3" /> Share:
      </span>

      {/* Twitter / X */}
      <button
        type="button"
        onClick={() => void openSocial("twitter")}
        className={`${shareBtnBase} brand-border-cyan`}
        title="Share on X / Twitter"
      >
        <Twitter className="w-3.5 h-3.5 text-cyan-300" /> X
      </button>

      {/* LinkedIn */}
      <button
        type="button"
        onClick={() => void openSocial("linkedin")}
        className={`${shareBtnBase} brand-border-violet`}
        title="Share on LinkedIn"
      >
        <Linkedin className="w-3.5 h-3.5 text-violet-300" /> LinkedIn
      </button>

      {/* Facebook */}
      <button
        type="button"
        onClick={() => void openSocial("facebook")}
        className={`${shareBtnBase} brand-border-amber`}
        title="Share on Facebook"
      >
        <Facebook className="w-3.5 h-3.5 text-amber-300" /> Facebook
      </button>

      {/* Copy link */}
      <button
        onClick={() => void handleCopy()}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
          copied
            ? "bg-charcoal border-white/10 text-white/80"
            : `${shareBtnBase} brand-border-cyan`
        }`}
        title="Copy share link"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
        {copied ? "Copied!" : "Copy Audit URL"}
      </button>

      {/* Share action (mobile native share, desktop copy fallback) */}
      <button
        onClick={() => void handleNativeShare()}
        className={`${shareBtnBase} brand-border-amber`}
        title="Share Link"
      >
        <Share2 className="w-3.5 h-3.5 text-amber-300" /> Share Public Audit
      </button>
    </div>
  );
}
