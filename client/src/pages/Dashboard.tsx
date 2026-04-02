import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AuditForm from "../components/AuditForm";
import AuditReport from "../components/AuditReport";
import { auditService } from "../services/auditService";
import toast from "react-hot-toast";

const Dashboard = () => {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAudits = async () => {
    try {
      const data = await auditService.getAudits({ limit: 10 });
      setAudits(data.audits);
    } catch (error) {
      toast.error("Failed to load audits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, []);

  const handleAuditCreated = (newAudit) => {
    setAudits(prevAudits => [newAudit, ...(prevAudits || [])]);
  };

  return (
    <div className="relative w-full">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">Monitor your AI visibility across all audits.</p>
          </div>
          <Link
            to="/app/analyze"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400 transition-colors shadow-md shadow-cyan-500/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Audit
          </Link>
        </motion.div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="score-card group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Audits</span>
              <span className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </span>
            </div>
            <p className="text-3xl font-bold text-white">{audits.length}</p>
          </div>
          <div className="score-card group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed</span>
              <span className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </span>
            </div>
            <p className="text-3xl font-bold text-emerald-400">{audits.filter(a => a.status === "completed").length}</p>
          </div>
          <div className="score-card group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Processing</span>
              <span className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </span>
            </div>
            <p className="text-3xl font-bold text-amber-400">{audits.filter(a => a.status === "processing").length}</p>
          </div>
        </div>

        {/* Audit Form */}
        <div className="card-charcoal rounded-xl p-5">
          <AuditForm onAuditCreated={handleAuditCreated} />
        </div>

        {/* Recent Audits */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Audits</h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500/30 border-t-cyan-400"></div>
            </div>
          ) : audits.length === 0 ? (
            <div className="card-charcoal rounded-xl text-center py-12 px-6">
              <p className="text-slate-400">No audits yet. Create your first audit above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {audits.map((audit) => (
                <div key={audit._id} className="card-charcoal rounded-xl p-5 hover:border-cyan-500/20 transition-all duration-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h3 className="text-base font-semibold text-white mb-2 truncate">{audit.url || audit.websiteId?.url}</h3>

                      {/* Category Scores */}
                      <div className="flex flex-wrap gap-3 mb-3">
                        {[
                          { label: "Content Clarity", value: audit.categoryScores?.contentClarity },
                          { label: "Entity Trust", value: audit.categoryScores?.entityTrust },
                          { label: "Technical Hygiene", value: audit.categoryScores?.technicalHygiene },
                          { label: "AI Readability", value: audit.categoryScores?.aiReadability },
                        ].map(({ label, value }) => (
                          <span key={label} className="inline-flex items-center gap-1.5 text-xs">
                            <span className="text-slate-500">{label}</span>
                            <span className="font-semibold text-white">{value ?? 0}</span>
                          </span>
                        ))}
                      </div>

                      {/* Status + Visibility Badges */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`px-2.5 py-1 rounded-md font-medium ${
                          audit.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                          audit.status === 'processing' ? 'bg-amber-500/10 text-amber-400' :
                          audit.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                          'bg-slate-500/10 text-slate-400'
                        }`}>
                          {audit.status === 'completed' ? 'Completed' :
                           audit.status === 'processing' ? 'Processing' :
                           audit.status === 'failed' ? 'Failed' : 'Pending'}
                        </span>
                        {audit.status === 'completed' && audit.visibilityStatus && (
                          <span className={`px-2.5 py-1 rounded-md font-medium ${
                            audit.visibilityStatus === 'visible' ? 'bg-emerald-500/10 text-emerald-400' :
                            audit.visibilityStatus === 'partially-visible' ? 'bg-amber-500/10 text-amber-400' :
                            audit.visibilityStatus === 'invisible' ? 'bg-red-500/10 text-red-400' :
                            'bg-slate-500/10 text-slate-400'
                          }`}>
                            AI: {audit.visibilityStatus.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        )}
                        {audit.createdAt && (
                          <span className="text-slate-500 ml-auto">{new Date(audit.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    {/* Score badge */}
                    {audit.overallScore != null && (
                      <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-white/[0.04] border border-white/[0.06] flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-white leading-none">{audit.overallScore}</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Score</span>
                      </div>
                    )}
                  </div>
                  <AuditReport audit={audit} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
