import React from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";

export default function PartnershipAgreementPage() {
  const navigate = useNavigate();
  usePageMeta({
    title: "Referral and Delivery Partnership Terms | AiVIS",
    description: "Private commercial terms for AiVIS referral and delivery partnerships.",
    path: "/partnership-terms",
    noIndex: true,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#09090d] to-[#0f1017] text-[#f5f7fb]">
      <header className="border-b border-white/10 bg-[#12121a] sticky top-0 z-20">
        <div className="max-w-[980px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/")} className="rounded-full p-2 transition-colors hover:bg-white/8" type="button" aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img src="/aivis-logo.png" alt="AiVIS" className="h-8 w-8 rounded-lg" />
            <span className="text-white/30 text-lg select-none">/</span>
            <img src="https://zeeniith.in/favicon.ico" alt="Zeeniith" className="h-8 w-8 rounded-lg" />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-xl font-semibold">
                <FileText className="h-5 w-5 text-[#7c5cff]" />
                Partnership Terms
              </h1>
              <p className="text-sm text-white/50 leading-tight mt-0.5">AiVIS &times; Zeeniith</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[980px] mx-auto px-5 py-10 space-y-5">
        {/* Hero card */}
        <section className="rounded-2xl border border-[#7c5cff]/28 bg-[radial-gradient(circle_at_top_right,rgba(124,92,255,0.18),transparent_32%),rgba(18,18,26,0.96)] p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
          <span className="inline-block text-[0.8rem] text-[#d7ddff] bg-[rgba(124,92,255,0.15)] border border-[#7c5cff]/35 px-2.5 py-1.5 rounded-full mb-3">
            Private commercial terms
          </span>
          <h2 className="text-[2rem] font-bold leading-tight tracking-tight mb-3">Referral and Delivery Partnership Terms</h2>
          <p className="text-white/75 mb-5 leading-relaxed">
            This page sets the working terms between the parties for lead origination, project closing, development delivery, payment handling, client protection, and commission entitlement.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-4.5">
            <MetaBox label="Effective date" value="April 1, 2026" />
            <MetaBox label="Party A" value="Ryan Mason, Founder, AiVIS" />
            <MetaBox label="Signature reference" value="R. Mason" />
            <MetaBox label="Party B" value="[Insert full legal company name]" />
          </div>
        </section>

        {/* Main terms */}
        <section className="rounded-2xl border border-[#2a2f3a] bg-[rgba(18,18,26,0.94)] p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)] space-y-0">
          <TermSection num="1" title="Purpose">
            <p>Party A introduces clients and commercial opportunities. Party B provides the development, implementation, technical execution, testing, and delivery for accepted projects. These terms define ownership of leads, how compensation is earned, how payments are handled, and how both parties are protected.</p>
          </TermSection>

          <TermSection num="2" title="Roles">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 mt-2">
              <RoleBox title="Party A" items={[
                "Sources and introduces leads and clients",
                "May support positioning, discovery, and sales conversations",
                "May handle payment collection from the client unless otherwise agreed in writing",
                "Retains the commission defined in these terms",
              ]} />
              <RoleBox title="Party B" items={[
                "Scopes the technical work and delivery approach",
                "Builds, tests, and delivers the approved scope",
                "Communicates blockers, dependencies, and delivery timing promptly",
                "Remains responsible for delivery quality and fulfillment of approved scope",
              ]} />
            </div>
          </TermSection>

          <TermSection num="3" title="Lead ownership">
            <p>A lead is deemed owned by Party A if Party A first introduced the client to Party B through email, message, call, document, meeting, website form, or any other verifiable written or recorded communication. In the event of a dispute, the earliest verifiable record controls.</p>
          </TermSection>

          <TermSection num="4" title="Closing">
            <p>Closing may be handled by Party A, Party B, or both parties together. Regardless of who closes the deal, if the lead originated from Party A, the commission terms in this agreement apply in full.</p>
          </TermSection>

          <TermSection num="5" title="Commission and revenue split">
            <p>For every client introduced by Party A that becomes a signed and paid project, Party A earns a fixed commission of <strong className="text-white">10 percent of the total gross project value</strong>. Party B receives <strong className="text-white">90 percent of the total gross project value</strong>.</p>
            <p className="mt-3">The 10 percent commission applies to:</p>
            <ul className="list-disc ml-5 mt-2 space-y-2 text-white/80">
              <li>Initial project value</li>
              <li>Approved scope increases</li>
              <li>Upsells tied to the same client relationship during the protected period</li>
              <li>Recurring retainer work derived from the same introduced client during the protected period</li>
            </ul>
          </TermSection>

          <TermSection num="6" title="Payment handling">
            <p>Unless otherwise agreed in writing, Party A may collect payment from the client. Party A retains the 10 percent commission and remits 90 percent to Party B from each cleared client payment.</p>
            <p className="mt-3">Where possible, payments should be milestone based rather than only final delivery based. That means the 10 percent and 90 percent split applies to each milestone payment as received.</p>
            <p className="mt-3">Party B shall be paid within <strong className="text-white">[3]</strong> business days after Party A receives cleared funds from the client for the relevant milestone or project payment.</p>
          </TermSection>

          <TermSection num="7" title="Deposit rule">
            <p>No development work begins until the client has paid a non-refundable upfront deposit of at least <strong className="text-white">50 percent</strong>, unless both parties approve a different structure in writing.</p>
          </TermSection>

          <TermSection num="8" title="Scope control">
            <p>Before work starts, the parties must have written agreement on project scope, deliverables, pricing, timeline, assumptions, and exclusions. Any change outside approved scope must be approved in writing and priced separately.</p>
          </TermSection>

          <TermSection num="9" title="Non-circumvention and client protection">
            <p>Party B shall not bypass Party A or contract directly with any client introduced by Party A except through Party A's written consent. This protection remains in effect during the active relationship and for <strong className="text-white">12 months</strong> after the last active project, invoice, or commercial discussion involving that client.</p>
            <p className="mt-3">If Party B directly accepts work from a protected client introduced by Party A during that protected period, Party A remains entitled to the 10 percent commission on all resulting work from that client during that period.</p>
          </TermSection>

          <TermSection num="10" title="Client-facing position">
            <p>Projects may be white label or openly collaborative depending on the deal. If the work is white label, Party B agrees not to identify itself to the client as the primary commercial counterparty unless Party A approves it in writing.</p>
          </TermSection>

          <TermSection num="11" title="Refunds, disputes, and chargebacks">
            <p>Both parties agree to cooperate in good faith if a client requests a refund, disputes payment, or files a chargeback. Delivery-related failures sit with Party B. Misrepresentation or payment handling failures caused by Party A sit with Party A. Any refund allocation should follow the actual cause of the dispute and the amounts already paid out.</p>
          </TermSection>

          <TermSection num="12" title="Evidence and records">
            <p>All lead introductions, scope approvals, pricing approvals, invoices, payment confirmations, revision approvals, and delivery acceptances should be kept in written or electronic records. Email trails, signed proposals, messaging screenshots, invoice receipts, and timestamped project records are all valid business records for determining ownership, payment entitlement, and performance history.</p>
          </TermSection>

          <TermSection num="13" title="Confidentiality">
            <p>Both parties agree to keep confidential any client data, pricing, business strategy, code, technical methods, access credentials, and non-public commercial information shared under this agreement.</p>
          </TermSection>

          <TermSection num="14" title="Independent contractors">
            <p>The parties are independent contractors. Nothing in these terms creates an employer relationship, equity relationship, or general partnership beyond the limited commercial structure described here.</p>
          </TermSection>

          <TermSection num="15" title="Governing law">
            <p>These terms shall be governed by the laws of <strong className="text-white">United States - Georgia, Hall Co.</strong>, unless replaced by a later written agreement signed by both parties.</p>
          </TermSection>

          <TermSection num="16" title="Acceptance">
            <p>These terms become effective when both parties sign or otherwise electronically accept them in a way that identifies the signer and preserves a record of the acceptance.</p>
          </TermSection>
        </section>

        {/* Signature block */}
        <section className="rounded-2xl border border-[#2a2f3a] bg-[rgba(18,18,26,0.94)] p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
          <h2 className="text-xl font-semibold mb-5">Signature block</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
            <div className="rounded-xl border border-[#2a2f3a] bg-[#171722] p-4">
              <span className="block text-[#a6adbb] text-[0.85rem] uppercase tracking-wider mb-1.5">Party A</span>
              <p className="font-semibold mb-4">Ryan Mason, Founder, AiVIS</p>
              <div className="border-b border-[#5f6677] h-8 mb-2" />
              <p className="text-[#a6adbb] text-sm">Signature: R. Mason</p>
              <p className="text-[#a6adbb] text-sm">Date: 4-1-2026</p>
            </div>
            <div className="rounded-xl border border-[#2a2f3a] bg-[#171722] p-4">
              <span className="block text-[#a6adbb] text-[0.85rem] uppercase tracking-wider mb-1.5">Party B</span>
              <p className="font-semibold mb-4">[Full legal name and title]</p>
              <div className="border-b border-[#5f6677] h-8 mb-2" />
              <p className="text-[#a6adbb] text-sm">Signature: __________________</p>
              <p className="text-[#a6adbb] text-sm">Date: __________________</p>
            </div>
          </div>
        </section>

        {/* Partnership branding */}
        <section className="rounded-2xl border border-[#2a2f3a] bg-[rgba(18,18,26,0.94)] p-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a href="https://aivis.biz" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
              <img src="/aivis-logo.png" alt="AiVIS" className="h-10 w-10 rounded-xl" />
              <div>
                <p className="font-semibold text-white group-hover:text-cyan-300 transition-colors">AiVIS</p>
                <p className="text-xs text-white/40">aivis.biz</p>
              </div>
            </a>
            <span className="text-white/20 text-2xl select-none hidden sm:block">&times;</span>
            <a href="https://zeeniith.in" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
              <img src="https://zeeniith.in/favicon.ico" alt="Zeeniith" className="h-10 w-10 rounded-xl" />
              <div>
                <p className="font-semibold text-white group-hover:text-emerald-300 transition-colors">Zeeniith</p>
                <p className="text-xs text-white/40">zeeniith.in</p>
              </div>
            </a>
          </div>
          <p className="text-center text-[#a6adbb] text-xs mt-4">Private commercial page for review and execution</p>
        </section>
      </div>
    </div>
  );
}

/* ── Subcomponents ───────────────────────────────────── */

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#2a2f3a] bg-[#171722] px-4 py-3.5">
      <span className="block text-[#a6adbb] text-[0.85rem] uppercase tracking-wider mb-1.5">{label}</span>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function TermSection({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="pt-2 border-t border-[#2a2f3a] mt-4.5 first:border-none first:mt-0 first:pt-0">
      <h2 className="text-lg font-semibold mt-2 mb-3">{num}. {title}</h2>
      <div className="text-white/80 leading-relaxed">{children}</div>
    </div>
  );
}

function RoleBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-[#2a2f3a] bg-[#171722] px-4 py-3.5">
      <h3 className="font-semibold mb-3">{title}</h3>
      <ul className="list-disc ml-5 space-y-2 text-white/80">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
