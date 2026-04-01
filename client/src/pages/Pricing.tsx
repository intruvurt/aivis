import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { paymentService } from "../services/paymentService";

const Pricing = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);

  const tiers = [
    {
      name: "Free",
      price: 0,
      period: "",
      limits: "5 audits per month • 1 project",
      description: "The doorway: For people testing one site and deciding if the engine is real",
      features: [
        "Single URL scan and score",
        "Basic findings and quick fixes",
        "Evidence links shown inside the report (no pure opinion)",
        "Copy summary to clipboard (plain text & markdown)",
        "Public share: summary only (no full public report page)",
        "Community or standard email support"
      ],
      cta: "Current Plan",
      disabled: true
    },
    {
      name: "Pro",
      price: 47,
      period: "per month",
      limits: "200 audits per month • up to 5 projects",
      description: "The operator tier: For founders and marketers iterating weekly",
      features: [
        "Full report history per project",
        "Compare mode: last scan vs current scan for visible progress",
        "Fix list workflow: Mark recommendations done then re-scan to confirm impact",
        "Share & export: private share links (token-based), optional public summary for social proof",
        "Exports: JSON snapshot, CSV, PDF, copy packs (LinkedIn post, Twitter thread, client email—all from the same snapshot)",
        "Priority support",
        "Rate limits higher than free tier",
        "API access",
        "Annual plan: $470/yr (2 months free)"
      ],
      cta: "Upgrade",
      tier: "Pro"
    },
    {
      name: "Business",
      price: 187,
      period: "per month",
      limits: "2,000 audits per month • up to 25 projects",
      description: "The accelerator: For agencies & teams managing many brands",
      features: [
        "Everything in Pro, plus:",
        "Team collaboration (invite/manage members)",
        "Role-based access controls",
        "Advanced compare: multi-period trend charts",
        "Automated scheduled scans & alerts",
        "White-label/share branded reports",
        "Integrations: Slack, Zapier, webhooks",
        "Chat/intercom support",
        "API: custom quota & higher concurrency",
        "Annual plan: $1,870/yr (2 months free)"
      ],
      cta: "Upgrade",
      tier: "Business"
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      limits: "Unlimited audits • Unlimited projects",
      description: "The architect: For enterprises & platforms with global needs",
      features: [
        "Everything in Business, plus:",
        "Unlimited audits/projects (custom SLAs)",
        "Dedicated account & onboarding",
        "Audit API: volume discount, batch mode",
        "SSO/SAML, custom integrations",
        "Custom contract/Master Service Agreement",
        "On-premise option",
        "Data pipeline (exports, BigQuery/Snowflake)",
        "24/7 phone/priority+ support"
      ],
      cta: "Contact Sales",
      tier: "Enterprise"
    },
    {
      name: "Eye-for-an-Eye",
      price: "2k-4k",
      period: "one-time",
      limits: "Custom platform build",
      features: [
        "Build your own AI search visibility platform",
        "Complete audit/assessment included",
        "Expert AI & traditional search implementation",
        "Additional pages: $100 each",
        "Feature add-ons: $279+ (complexity-based)",
        "Future-proof SaaS implementation"
      ],
      cta: "Contact Us",
      tier: "Eye-for-an-Eye"
    }
  ];

  const handleUpgrade = async (tier) => {
    if (!isAuthenticated) {
      toast.error("Login required");
      navigate("/login");
      return;
    }

    if (tier === "Eye-for-an-Eye" || tier === "Enterprise") {
      toast("Contact us for custom pricing and setup", { icon: "🤝" });
      return;
    }

    setLoading(tier);
    try {
      const url = await paymentService.createStripeCheckout(tier);
      window.location.href = url;
    } catch (error) {
      toast.error(error.response?.data?.error || "Payment failed");
      setLoading(null);
    }
  };

  return (
    <div id="src_pages_Pricing_main" className="min-h-screen bg-gray-50 py-12">
      <div id="src_pages_Pricing_container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          id="src_pages_Pricing_header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 id="src_pages_Pricing_title" className="text-4xl font-bold text-gray-900 mb-4">
            Pricing
          </h1>
          <p id="src_pages_Pricing_subtitle" className="text-lg text-gray-600">
            Clear limits. No hidden fees. Cancel anytime.
          </p>
        </motion.div>

        <div id="src_pages_Pricing_grid" className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              id={`src_pages_Pricing_tier_${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white rounded-lg shadow-sm p-6 ${
                tier.name === "Pro" ? "ring-2 ring-indigo-600" : ""
              }`}
            >
              <h3 id={`src_pages_Pricing_name_${index}`} className="text-xl font-bold text-gray-900 mb-2">
                {tier.name}
              </h3>
              {tier.description && (
                <p id={`src_pages_Pricing_desc_${index}`} className="text-sm text-gray-600 mb-3 italic">
                  {tier.description}
                </p>
              )}
              <div id={`src_pages_Pricing_price_${index}`} className="mb-4">
                <span id="src_pages_Pricing_nfj0" className="text-3xl font-bold text-gray-900">
                  {tier.price === 0 ? "Free" : tier.price === "2k-4k" ? "$2k-$4k" : `$${tier.price}`}
                </span>
                {tier.period && (
                  <span id="src_pages_Pricing_pt1q" className="text-gray-600 text-sm ml-2">{tier.period}</span>
                )}
              </div>
              <p id={`src_pages_Pricing_limits_${index}`} className="text-sm text-gray-600 mb-6">
                {tier.limits}
              </p>
              <ul id={`src_pages_Pricing_features_${index}`} className="space-y-3 mb-6">
                {tier.features.map((feature, fIndex) => (
                  <li id="src_pages_Pricing_yi4q" key={fIndex} className="flex items-start text-sm text-gray-700">
                    <span id="src_pages_Pricing_tb3j" className="mr-2">•</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                id={`src_pages_Pricing_cta_${index}`}
                onClick={() => handleUpgrade(tier.tier)}
                disabled={tier.disabled || loading !== null}
                className={`w-full py-2 px-4 rounded font-semibold ${
                  tier.disabled
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : loading === tier.tier
                    ? "bg-indigo-400 text-white cursor-wait"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {loading === tier.tier ? "Processing..." : tier.cta}
              </button>
            </motion.div>
          ))}
        </div>

        <div id="src_pages_Pricing_note" className="mt-12 text-center text-sm text-gray-600">
          <p id="src_pages_Pricing_dd8q">All limits enforced server side. Overages blocked with clear error messages.</p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
