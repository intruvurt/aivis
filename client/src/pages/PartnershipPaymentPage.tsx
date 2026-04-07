import React, { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  FileText,
  Check,
  Shield,
  AlertTriangle,
  Loader2,
  Lock,
  Mail,
  CreditCard,
  ExternalLink,
  Clock,
  Plus,
} from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import PublicPageFrame from "../components/PublicPageFrame";
import { API_URL } from "../config";

const AGREEMENT_SLUG = "aivis-zeeniith-referral-delivery-2026";

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get("token"),
    slug: params.get("slug") || AGREEMENT_SLUG,
    email: params.get("email"),
    invoiceId: params.get("invoice"),
    capture: params.get("capture") === "true",
    cancelled: params.get("cancelled") === "true",
  };
}

interface Invoice {
  id: string;
  agreement_slug: string;
  description: string;
  amount_usd: string;
  status: "pending" | "paid";
  paypal_order_id: string | null;
  paid_by_email: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AgreementBasic {
  title: string;
  party_a_name: string;
  party_a_org: string;
  party_b_name: string;
  party_b_org: string;
  status: string;
}

export default function PartnershipPaymentPage() {
  usePageMeta({
    title: "Partnership Payments | AiVIS",
    description: "Private payment portal for AiVIS partnership agreements.",
    path: "/partnership-payments",
    noIndex: true,
  });

  const [agreement, setAgreement] = useState<AgreementBasic | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Email gate
  const [emailRequired, setEmailRequired] = useState(false);
  const [gateEmail, setGateEmail] = useState("");
  const [gateEmailError, setGateEmailError] = useState<string | null>(null);
  const [gateEmailLoading, setGateEmailLoading] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  // PayPal payment
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  // Capture feedback
  const [captureMsg, setCaptureMsg] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const params = getUrlParams();
  const slug = params.slug;
  const token = params.token || "";

  // Fetch agreement + invoices
  const fetchData = useCallback(
    async (email: string) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ token, email });

        // Fetch agreement metadata
        const agRes = await fetch(`${API_URL}/api/agreements/${encodeURIComponent(slug)}?${qs}`);
        if (agRes.status === 403) {
          const body = await agRes.json().catch(() => ({}));
          if (body.email_required) {
            setEmailRequired(true);
            setLoading(false);
            return;
          }
          setAccessDenied(true);
          setLoading(false);
          return;
        }
        if (!agRes.ok) throw new Error("Failed to load agreement.");
        const agData = await agRes.json();
        setAgreement({
          title: agData.title,
          party_a_name: agData.party_a_name,
          party_a_org: agData.party_a_org,
          party_b_name: agData.party_b_name,
          party_b_org: agData.party_b_org,
          status: agData.status,
        });

        // Fetch invoices
        const invRes = await fetch(
          `${API_URL}/api/agreements/${encodeURIComponent(slug)}/invoices?${qs}`
        );
        if (invRes.ok) {
          const invData = await invRes.json();
          setInvoices(invData.invoices || []);
        }

        setVerifiedEmail(email);
      } catch (err: any) {
        setError(err.message || "Failed to load data.");
      } finally {
        setLoading(false);
      }
    },
    [slug, token]
  );

  // Initial load — try email from URL
  useEffect(() => {
    if (params.email) {
      fetchData(params.email);
    } else {
      setEmailRequired(true);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-capture after PayPal redirect
  useEffect(() => {
    if (params.capture && params.invoiceId && verifiedEmail) {
      handleCapture(params.invoiceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedEmail]);

  // Email gate submit
  const handleEmailGate = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = gateEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setGateEmailError("Enter a valid email address.");
      return;
    }
    setGateEmailError(null);
    setGateEmailLoading(true);
    await fetchData(email);
    setGateEmailLoading(false);
  };

  // Pay invoice via PayPal
  const handlePay = async (invoiceId: string) => {
    if (!verifiedEmail) return;
    setPayingInvoiceId(invoiceId);
    try {
      const res = await fetch(
        `${API_URL}/api/agreements/${encodeURIComponent(slug)}/invoices/${encodeURIComponent(invoiceId)}/pay?token=${encodeURIComponent(token)}&email=${encodeURIComponent(verifiedEmail)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: verifiedEmail }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create payment.");
      }
      const data = await res.json();
      if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPayingInvoiceId(null);
    }
  };

  // Capture after PayPal redirect
  const handleCapture = async (invoiceId: string) => {
    if (!verifiedEmail) return;
    setCaptureMsg(null);
    setCaptureError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/agreements/${encodeURIComponent(slug)}/invoices/${encodeURIComponent(invoiceId)}/capture?token=${encodeURIComponent(token)}&email=${encodeURIComponent(verifiedEmail)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: verifiedEmail }),
        }
      );
      const data = await res.json();
      if (data.captured) {
        setCaptureMsg("Payment captured successfully. Thank you!");
        // Refresh invoices
        await fetchData(verifiedEmail);
      } else {
        setCaptureError(`Payment not yet completed. PayPal status: ${data.paypal_status || "unknown"}`);
      }
    } catch (err: any) {
      setCaptureError(err.message || "Capture failed.");
    }
  };

  // ── Render ──

  // Email gate screen
  if (emailRequired && !verifiedEmail) {
    return (
      <PublicPageFrame>
        <div className="max-w-lg mx-auto py-20 px-4">
          <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Partnership Payments</h1>
            <p className="text-slate-400 mb-6 text-sm">
              This is a private payment portal. Enter your party email to access invoices.
            </p>
            <form onSubmit={handleEmailGate} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={gateEmail}
                  onChange={(e) => setGateEmail(e.target.value)}
                  placeholder="your-email@company.com"
                  className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {gateEmailError && <p className="text-red-400 text-sm">{gateEmailError}</p>}
              <button
                type="submit"
                disabled={gateEmailLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {gateEmailLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                  </span>
                ) : (
                  "Access Payment Portal"
                )}
              </button>
            </form>
          </div>
        </div>
      </PublicPageFrame>
    );
  }

  // Access denied
  if (accessDenied) {
    return (
      <PublicPageFrame>
        <div className="max-w-lg mx-auto py-20 px-4 text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400">
            This page is restricted to authorized partnership parties only.
          </p>
        </div>
      </PublicPageFrame>
    );
  }

  // Loading
  if (loading) {
    return (
      <PublicPageFrame>
        <div className="flex items-center justify-center py-20">
          <img src="/aivis-progress-spinner.png" alt="" className="w-8 h-8 animate-spin" />
        </div>
      </PublicPageFrame>
    );
  }

  // Error
  if (error && !agreement) {
    return (
      <PublicPageFrame>
        <div className="max-w-lg mx-auto py-20 px-4 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Error</h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </PublicPageFrame>
    );
  }

  const pendingInvoices = invoices.filter((i) => i.status === "pending");
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const totalOwed = pendingInvoices.reduce((s, i) => s + Number(i.amount_usd), 0);
  const totalPaid = paidInvoices.reduce((s, i) => s + Number(i.amount_usd), 0);

  return (
    <PublicPageFrame>
      <div className="max-w-3xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Partnership Payments</h1>
              <p className="text-sm text-slate-400">
                Private payment portal &bull; {agreement?.title}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-400 mt-4">
            <span>
              <strong className="text-slate-200">{agreement?.party_a_name}</strong> ({agreement?.party_a_org})
            </span>
            <span className="text-slate-600">&times;</span>
            <span>
              <strong className="text-slate-200">{agreement?.party_b_name}</strong> ({agreement?.party_b_org})
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Authenticated as {verifiedEmail} &bull; Agreement status: {agreement?.status?.replace(/_/g, " ")}
          </div>
        </div>

        {/* Capture feedback */}
        {captureMsg && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-emerald-300 text-sm">{captureMsg}</p>
          </div>
        )}
        {captureError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-300 text-sm">{captureError}</p>
          </div>
        )}
        {params.cancelled && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-amber-300 text-sm">Payment was cancelled. You can try again when ready.</p>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-5">
            <div className="text-sm text-slate-400 mb-1">Outstanding</div>
            <div className="text-2xl font-bold text-amber-400">${totalOwed.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-1">{pendingInvoices.length} invoice{pendingInvoices.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-5">
            <div className="text-sm text-slate-400 mb-1">Total Paid</div>
            <div className="text-2xl font-bold text-emerald-400">${totalPaid.toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-1">{paidInvoices.length} invoice{paidInvoices.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-5">
            <div className="text-sm text-slate-400 mb-1">Total Invoiced</div>
            <div className="text-2xl font-bold text-white">${(totalOwed + totalPaid).toFixed(2)}</div>
            <div className="text-xs text-slate-500 mt-1">{invoices.length} total</div>
          </div>
        </div>

        {/* Pending invoices */}
        {pendingInvoices.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Outstanding Invoices
            </h2>
            <div className="space-y-3">
              {pendingInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium">{inv.description}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Created {new Date(inv.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      {inv.id && <span className="ml-2 text-slate-600">#{inv.id.slice(0, 8)}</span>}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-amber-400 whitespace-nowrap">
                    ${Number(inv.amount_usd).toFixed(2)}
                  </div>
                  <button
                    onClick={() => handlePay(inv.id)}
                    disabled={payingInvoiceId === inv.id}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                  >
                    {payingInvoiceId === inv.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" /> Pay with PayPal
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No invoices */}
        {invoices.length === 0 && (
          <div className="text-center py-12 bg-slate-900/60 border border-slate-700/40 rounded-xl">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No invoices yet.</p>
            <p className="text-slate-500 text-sm mt-1">Invoices will appear here when issued.</p>
          </div>
        )}

        {/* Paid invoices */}
        {paidInvoices.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-400" />
              Paid Invoices
            </h2>
            <div className="space-y-3">
              {paidInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-slate-900/80 border border-emerald-500/20 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium">{inv.description}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Paid {inv.paid_at
                        ? new Date(inv.paid_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                      {inv.paid_by_email && (
                        <span className="ml-2">by {inv.paid_by_email}</span>
                      )}
                      {inv.id && <span className="ml-2 text-slate-600">#{inv.id.slice(0, 8)}</span>}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-emerald-400 whitespace-nowrap">
                    ${Number(inv.amount_usd).toFixed(2)}
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Paid
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Protections info */}
        <div className="mt-10 bg-slate-900/60 border border-slate-700/40 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            Payment Protections
          </h3>
          <ul className="text-xs text-slate-400 space-y-2">
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              All payments are processed securely through PayPal with buyer and seller protection.
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              Invoice records are linked to the signed partnership agreement for auditability.
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              Payment timestamps and payer emails are permanently recorded.
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              Both parties can view the full invoice and payment history at any time.
            </li>
          </ul>
        </div>
      </div>
    </PublicPageFrame>
  );
}
