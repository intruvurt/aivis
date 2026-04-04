import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, ClipboardList, Clock3, Gauge, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import AppPageFrame from "../components/AppPageFrame";
import { auditService } from "../services/auditService";

type AuditRecord = {
  _id?: string;
  url?: string;
  createdAt?: string;
  status?: string;
  overallScore?: number;
  visibilityStatus?: string;
};

function normalizeAudits(payload: any): AuditRecord[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.audits)) return payload.audits;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export default function Dashboard() {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await auditService.listAudits();
        setAudits(normalizeAudits(response));
      } catch {
        toast.error("Failed to load audits");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const metrics = useMemo(() => {
    const completed = audits.filter((audit) => audit.status === "completed").length;
    const processing = audits.filter((audit) => audit.status === "processing").length;
    const scored = audits.filter((audit) => typeof audit.overallScore === "number");
    const averageScore = scored.length
      ? Math.round(scored.reduce((total, audit) => total + (audit.overallScore || 0), 0) / scored.length)
      : 0;
    const needsAttention = audits.filter((audit) => (audit.overallScore || 0) < 70).length;
    return [
      { label: "Total audits", value: audits.length, icon: ClipboardList },
      { label: "Completed", value: completed, icon: Gauge },
      { label: "Average score", value: averageScore, icon: Activity },
      { label: "Needs attention", value: needsAttention + processing, icon: Clock3 },
    ];
  }, [audits]);

  return (
    <AppPageFrame
      icon={<Gauge className="h-5 w-5 text-orange-300" />}
      title="Dashboard"
      subtitle="Track audit volume, surface the latest visibility work, and move straight into the next run."
      actions={
        <Link
          to="/app/analyze"
          className="inline-flex items-center gap-2 rounded-2xl bg-orange-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-300"
        >
          New audit
          <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/46">{metric.label}</p>
              <metric.icon className="h-4 w-4 text-cyan-200" />
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Recent audits</h2>
            <p className="mt-1 text-sm text-white/56">Recent runs only. The dashboard no longer inlines full report chrome.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-white/60">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : audits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center text-sm text-white/58">
            No audits yet. Run your first audit to start building a visibility history.
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.03] text-white/46">
                <tr>
                  <th className="px-4 py-3 font-semibold">Site</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {audits.slice(0, 12).map((audit) => (
                  <tr key={audit._id || audit.url} className="bg-transparent text-white/76">
                    <td className="px-4 py-4">
                      <div className="max-w-[26rem] truncate font-medium text-white">{audit.url || "Untitled audit"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium capitalize text-white/72">
                        {audit.status || "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-4">{typeof audit.overallScore === "number" ? audit.overallScore : "—"}</td>
                    <td className="px-4 py-4 text-white/58">{audit.createdAt ? new Date(audit.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-4">
                      {audit._id ? (
                        <Link to={`/audit/${audit._id}`} className="inline-flex items-center gap-1 text-sm font-medium text-cyan-200 transition hover:text-white">
                          View
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-white/40">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppPageFrame>
  );
}
