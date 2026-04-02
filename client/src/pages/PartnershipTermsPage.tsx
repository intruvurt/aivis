import React, { useEffect } from "react";
import { usePageMeta } from "../hooks/usePageMeta";

export default function PartnershipTermsPage() {
  usePageMeta({
    title: "Private Partnership Terms",
    description:
      "Private partnership terms for approved organizations operating cross-platform lead workflows with AiVIS.",
    path: "/partnership-terms",
  });

  useEffect(() => {
    const robotsMetaName = "robots";
    let robotsMeta = document.querySelector(`meta[name=\"${robotsMetaName}\"]`) as HTMLMetaElement | null;
    const previous = robotsMeta?.getAttribute("content") || null;

    if (!robotsMeta) {
      robotsMeta = document.createElement("meta");
      robotsMeta.setAttribute("name", robotsMetaName);
      document.head.appendChild(robotsMeta);
    }

    robotsMeta.setAttribute("content", "noindex, nofollow, noarchive");

    return () => {
      if (!robotsMeta) return;
      if (previous) {
        robotsMeta.setAttribute("content", previous);
      } else {
        robotsMeta.remove();
      }
    };
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-12 text-white">
      <h1 className="text-3xl font-bold mb-4">Private Partnership Terms</h1>
      <p className="text-white/70 mb-6">
        This page documents private operational terms for approved partnership workflows.
        It is intentionally excluded from search indexing.
      </p>

      <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Scope</h2>
        <p className="text-white/70">
          The partnership between <strong>AiVIS</strong> and <strong>zeeniith.in</strong> is limited to private lead-routing and
          qualification operations. zeeniith.in is not a public product surface of AiVIS.
        </p>

        <h2 className="text-xl font-semibold">Access policy</h2>
        <ul className="list-disc pl-5 text-white/70 space-y-2">
          <li>Direct-link access only for approved stakeholders.</li>
          <li>No public indexing, syndication, or scraping permission.</li>
          <li>No redistribution of commercial terms without written approval.</li>
        </ul>

        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="text-white/70">For partnership verification, contact: partners@aivis.biz.</p>
      </section>
    </main>
  );
}