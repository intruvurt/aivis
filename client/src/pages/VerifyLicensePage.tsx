import React, { useState } from "react";
import { CheckCircle, XCircle, Loader2, ShieldCheck } from "lucide-react";

import { API_URL } from '../config';

interface LicenseResult {
  productName: string;
  purchaseDate: string;
  activationCount: number;
  maxActivations: number;
}

type Status = "idle" | "loading" | "success" | "error";

export default function VerifyLicensePage() {
  const [licenseKey, setLicenseKey] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [license, setLicense] = useState<LicenseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setLicense(null);
    setErrorMessage("");

    try {
      const res = await fetch(`${API_URL}/licenses/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.valid) {
        setLicense(data.license);
        setStatus("success");
      } else {
        setErrorMessage(data.reason || "This license key could not be verified.");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Unable to reach the verification server. Please try again later.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-white/16 to-black" />
      </div>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 lonely-text">
          <div className="w-14 h-14 rounded-2xl card-charcoal/30 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-white/80" />
          </div>
          <h1 className="text-2xl font-bold text-white">License Verification</h1>
          <p className="text-white/55 text-sm mt-1">Verify your Content Generation Engine license</p>
        </div>

        {/* Card */}
        <div className="bg-charcoal-deep border border-white/10 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="licenseKey" className="block text-sm font-medium text-white/75 mb-1.5">
                License Key
              </label>
              <input
                id="licenseKey"
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                className="w-full px-4 py-3 bg-charcoal-deep border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/30 font-mono text-sm transition-colors"
                required
                disabled={status === "loading"}
              />
            </div>

            <button
              type="submit"
              disabled={status === "loading" || !licenseKey.trim()}
              className="w-full py-3 bg-charcoal hover:bg-charcoal disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {status === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying…
                </span>
              ) : (
                "Verify License"
              )}
            </button>
          </form>

          {/* Success */}
          {status === "success" && license && (
            <div className="mt-5 p-4 card-charcoal/30 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-white/80 flex-shrink-0" />
                <span className="text-white/80 font-semibold">Valid License</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/55">Product</span>
                  <span className="text-white font-medium">{license.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Purchase Date</span>
                  <span className="text-white font-medium">
                    {new Date(license.purchaseDate).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Activations</span>
                  <span className="text-white font-medium">
                    {license.activationCount} / {license.maxActivations}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Status</span>
                  <span className="text-white/80 font-medium">Active</span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="mt-5 p-4 card-charcoal rounded-xl">
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-white/80 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white/80 font-semibold">Invalid License</p>
                  <p className="text-white/80 text-sm mt-0.5">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 text-xs mt-6">
          Lost your license key?{" "}
          <a href="mailto:support@aivis.biz" className="text-white/55 hover:text-white transition-colors underline underline-offset-2">
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}
