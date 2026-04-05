// client/src/components/CryptoIntelligencePanel.tsx
import React, { useState } from "react";
import {
  AlertTriangle,
  Bitcoin,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FlaskConical,
  Info,
  MessageSquare,
  Shield,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import type { CryptoIntelligence } from "@shared/types";

interface CryptoIntelligencePanelProps {
  data: CryptoIntelligence;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sentimentColor(s: string) {
  if (s === "positive") return "text-white/80";
  if (s === "negative") return "text-white/80";
  return "text-white/55";
}

function sentimentLabel(s: string) {
  if (s === "positive") return " Positive";
  if (s === "negative") return " Negative";
  return " Neutral";
}

function chainIcon(chain: string) {
  if (chain === "ethereum") return "Ξ";
  if (chain === "solana")   return "◎";
  return "₿";
}

function explorerUrl(address: string, chain: string) {
  if (chain === "ethereum")
    return `https://etherscan.io/address/${address}`;
  if (chain === "solana")
    return `https://solscan.io/account/${address}`;
  return `https://www.blockchain.com/explorer/addresses/btc/${address}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ExperimentalBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-charcoal text-white/80 border border-white/10">
      <FlaskConical className="w-3 h-3" />
      Experimental
    </span>
  );
}

function FeedbackNote() {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg card-charcoal/20 p-3 text-xs text-white/80">
      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <span>
        This feature is experimental and may see <strong>frequent updates</strong>. Your feedback is
        welcome - results may vary, especially for on-chain enrichment, which depends on API availability.
      </span>
    </div>
  );
}

function OnchainCard({ item }: { item: NonNullable<CryptoIntelligence["onchain_data"]>[number] }) {
  const short = `${item.address.slice(0, 8)}…${item.address.slice(-6)}`;
  const url   = explorerUrl(item.address, item.chain);

  return (
    <div className="bg-charcoal-deep rounded-lg p-4 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-mono font-bold text-white/80">
            {chainIcon(item.chain)}
          </span>
          <code className="text-xs font-mono text-white/75 bg-charcoal-deep px-2 py-0.5 rounded">
            {short}
          </code>
          {item.isContract && (
            <span className="text-xs bg-charcoal text-white/80 border border-white/10 px-1.5 py-0.5 rounded">
              Contract
            </span>
          )}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/80 hover:text-white/80 transition-colors"
          title="View on explorer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {item.balance && (
          <>
            <span className="text-white/60">Balance</span>
            <span className="text-white/85 font-mono">{item.balance}</span>
          </>
        )}
        {typeof item.txCount === "number" && (
          <>
            <span className="text-white/60">Transactions</span>
            <span className="text-white/85 font-mono">
              {item.txCount.toLocaleString()}
              {item.txCount >= 1000 ? "+" : ""}
            </span>
          </>
        )}
        {item.tokenName && (
          <>
            <span className="text-white/60">Token</span>
            <span className="text-white/85">{item.tokenName} ({item.tokenSymbol})</span>
          </>
        )}
        {item.tags && item.tags.length > 0 && (
          <>
            <span className="text-white/60">Tags</span>
            <span className="text-white/80">{item.tags.join(", ")}</span>
          </>
        )}
        {item.error && (
          <>
            <span className="text-white/60">Note</span>
            <span className="text-white/80 text-xs">{item.error}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const CryptoIntelligencePanel: React.FC<CryptoIntelligencePanelProps> = ({ data }) => {
  const [expanded, setExpanded] = useState(false);

  // Always render - even if no signals, show the "not detected" summary
  const hasCrypto  = data.has_crypto_signals;
  const hasOnchain = data.onchain_enriched && Array.isArray(data.onchain_data) && data.onchain_data.length > 0;

  return (
    <div className="card-charcoal/50 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-charcoal rounded-lg border border-white/10">
            <Bitcoin className="w-5 h-5 text-white/80" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Crypto Intelligence</h3>
            <p className="text-xs text-white/60 mt-0.5">
              Blockchain signal detection &amp; on-chain analysis
            </p>
          </div>
        </div>
        <ExperimentalBadge />
      </div>

      {/* Summary banner */}
      <div
        className={`rounded-lg p-4 border mb-4 ${
          hasCrypto
            ? "bg-charcoal border-white/10"
            : "bg-charcoal border-white/10"
        }`}
      >
        <div className="flex items-start gap-2">
          <Info className={`w-4 h-4 flex-shrink-0 mt-0.5 ${hasCrypto ? "text-white/80" : "text-white/60"}`} />
          <p className={`text-sm leading-relaxed ${hasCrypto ? "text-white/80" : "text-white/55"}`}>
            {data.summary}
          </p>
        </div>
      </div>

      {hasCrypto ? (
        <>
          {/* Quick stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {/* Sentiment */}
            <div className="bg-charcoal rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs text-white/60 uppercase tracking-wide">Sentiment</span>
              </div>
              <span className={`text-sm font-semibold ${sentimentColor(data.sentiment)}`}>
                {sentimentLabel(data.sentiment)}
              </span>
            </div>

            {/* Networks */}
            <div className="bg-charcoal rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs text-white/60 uppercase tracking-wide">Networks</span>
              </div>
              <span className="text-sm font-semibold text-white">
                {(data.chain_networks || []).length > 0
                  ? (data.chain_networks || []).join(", ")
                  : "N/A"}
              </span>
            </div>

            {/* Addresses found */}
            <div className="bg-charcoal rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs text-white/60 uppercase tracking-wide">Addresses</span>
              </div>
              <span className="text-sm font-semibold text-white">
                {(data.wallet_addresses || []).length}
              </span>
            </div>

            {/* On-chain status */}
            <div className="bg-charcoal rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Shield className="w-3.5 h-3.5 text-white/60" />
                <span className="text-xs text-white/60 uppercase tracking-wide">On-chain</span>
              </div>
              <span
                className={`text-sm font-semibold ${
                  hasOnchain ? "text-white/80" : "text-white/60"
                }`}
              >
                {hasOnchain ? "Enriched" : "Not fetched"}
              </span>
            </div>
          </div>

          {/* Detected assets */}
          {(data.detected_assets || []).length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-white/55 uppercase tracking-wide mb-2">
                Detected Assets
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.detected_assets.map((asset, i) => (
                  <span
                    key={i}
                    className="text-xs px-2.5 py-1 rounded-full bg-charcoal text-white/80 border border-white/10"
                  >
                    {asset}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Risk notes */}
          {(data.risk_notes || []).length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-white/55 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-white/80" />
                Risk / Caution Notes
              </h4>
              <ul className="space-y-1.5">
                {data.risk_notes.map((note, i) => (
                  <li key={i} className="text-sm text-white/80/80 flex items-start gap-2">
                    <span className="mt-0.5 flex-shrink-0">•</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Expand / collapse for deeper details */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-white/55 hover:text-white/85 transition-colors border border-white/10 rounded-lg hover:bg-charcoal"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Hide details
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Show {hasOnchain ? "on-chain data & " : ""}keywords &amp; addresses
              </>
            )}
          </button>

          {expanded && (
            <div className="mt-4 space-y-4">
              {/* On-chain data */}
              {hasOnchain && (
                <div>
                  <h4 className="text-xs font-semibold text-white/55 uppercase tracking-wide mb-2">
                    On-chain Address Data
                  </h4>
                  <div className="space-y-2">
                    {(data.onchain_data || []).map((item, i) => (
                      <OnchainCard key={i} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {/* All wallet addresses */}
              {(data.wallet_addresses || []).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-white/55 uppercase tracking-wide mb-2">
                    Addresses Found on Page
                  </h4>
                  <div className="space-y-1">
                    {data.wallet_addresses.map((addr, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono text-white/75 bg-charcoal px-3 py-1.5 rounded border border-white/10">
                        <span className="text-white/60 select-none">{i + 1}.</span>
                        <span className="truncate">{addr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {(data.keywords || []).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-white/55 uppercase tracking-wide mb-2">
                    Crypto Keywords Detected
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {data.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded bg-charcoal-deep text-white/55 border border-white/10"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* No crypto signals - minimal view */
        <div className="text-center py-4">
          <p className="text-sm text-white/60">
            No blockchain or cryptocurrency content was detected on this page.
          </p>
          <p className="text-xs text-white/70 mt-1">
            If this page does have crypto content, re-run the analysis or check the URL.
          </p>
        </div>
      )}

      <FeedbackNote />
    </div>
  );
};

export default CryptoIntelligencePanel;
