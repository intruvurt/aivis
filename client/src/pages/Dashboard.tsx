import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import AuditForm from "../components/AuditForm";
import AuditReport from "../components/AuditReport";
import BackgroundDecoration from "../components/BackgroundDecoration";
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
    <div id="src_pages_Dashboard_k9cg" className="relative min-h-screen py-6 px-3 sm:px-6 md:px-10 lg:px-12 flex flex-col overflow-x-hidden" style={{fontFamily:'DM Sans, Inter, system-ui, sans-serif'}}>
      <BackgroundDecoration />
      
      <div id="src_pages_Dashboard_zz0w" className="relative z-10 max-w-7xl mx-auto w-full">
        {/* Back to Home Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-gray-400 hover:text-accent transition-colors group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Home</span>
          </Link>
          <Link
            to="/profile"
            className="flex items-center gap-2 text-gray-400 hover:text-accent transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium">Settings</span>
          </Link>
        </div>

        <section id="dashboard_brushsteel_wrap" className="dashboard-wrapper backdrop-blur-md bg-sectionBg rounded-3xl px-4 sm:px-6 lg:px-10 py-8 md:py-12 border border-borderGray shadow-steel">
          <motion.div
            id="src_pages_Dashboard_zul1" 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 id="src_pages_Dashboard_dd5v" className="text-2xl sm:text-3xl lg:text-5xl tracking-tight font-extrabold brushsteel-text drop-shadow-lg mb-2" style={{letterSpacing:'-0.02em'}}>
              AiVis Audit Dashboard
            </h1>
            <p id="src_pages_Dashboard_brm1" className="text-xl md:text-2xl font-medium text-gray-400 max-w-2xl">
              Engraved audit reports. Next-level protection. Seamless operations.
            </p>
          </motion.div>

          <div id="src_pages_Dashboard_ok2t" className="grid lg:grid-cols-3 gap-4 lg:gap-8 mb-12">
            <div id="src_pages_Dashboard_gi8e" className="lg:col-span-2">
              <AuditForm onAuditCreated={handleAuditCreated} />
            </div>
            <div id="src_pages_Dashboard_pyp9" className="stat-card rounded-2xl p-6 bg-steel/40 border border-borderGray shadow-steel">
              <h3 id="src_pages_Dashboard_pp8h" className="text-lg font-semibold text-contentGray mb-6 tracking-wide">Quick Stats</h3>
              <div id="src_pages_Dashboard_rh0y" className="space-y-5">
                <div id="src_pages_Dashboard_8buz" className="engrave-border p-4 rounded-lg bg-brushsteel/30 border border-borderGray">
                  <p id="src_pages_Dashboard_k4tg" className="text-sm text-gray-400 uppercase tracking-wider mb-1">Total Audits</p>
                  <p id="src_pages_Dashboard_a4sl" className="text-3xl font-bold text-contentGray">{audits.length}</p>
                </div>
                <div id="src_pages_Dashboard_2qag" className="engrave-border p-4 rounded-lg bg-brushsteel/30 border border-borderGray">
                  <p id="src_pages_Dashboard_0qze" className="text-sm text-gray-400 uppercase tracking-wider mb-1">Completed</p>
                  <p id="src_pages_Dashboard_f7ys" className="text-3xl font-bold text-green-400">
                    {audits.filter(a => a.status === "completed").length}
                  </p>
                </div>
                <div id="src_pages_Dashboard_a1ib" className="engrave-border p-4 rounded-lg bg-brushsteel/30 border border-borderGray">
                  <p id="src_pages_Dashboard_m1ul" className="text-sm text-gray-400 uppercase tracking-wider mb-1">Processing</p>
                  <p id="src_pages_Dashboard_ey6i" className="text-3xl font-bold text-yellow-400">
                    {audits.filter(a => a.status === "processing").length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div id="src_pages_Dashboard_l3pc">
            <h2 id="src_pages_Dashboard_rg1h" className="text-3xl font-bold text-contentGray mb-6 tracking-tight">Recent Audits</h2>
            {loading ? (
              <div id="src_pages_Dashboard_spg7" className="flex justify-center py-12">
                <div id="src_pages_Dashboard_e8zf" className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
              </div>
            ) : audits.length === 0 ? (
              <div id="src_pages_Dashboard_d5ol" className="audit-card rounded-2xl text-center py-12 px-6 bg-steel/40 border border-borderGray">
                <p id="src_pages_Dashboard_bj8y" className="text-gray-400 text-lg">No audits yet. Create your first audit above!</p>
              </div>
            ) : (
              <div id="src_pages_Dashboard_nox6" className="space-y-6">
                {audits.map((audit) => (
                  <div id="src_pages_Dashboard_xz3y" key={audit._id} className="audit-card rounded-2xl p-6 hover:border-indigo-500/50 transition-all duration-300 bg-steel/50 border border-borderGray shadow-steel">
                    <div id="src_pages_Dashboard_yjc4" className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                      <div id="src_pages_Dashboard_7rbe" className="flex-1 min-w-0 overflow-hidden">
                        <h3 id="src_pages_Dashboard_sa0y" className="text-xl font-semibold text-gray-100 mb-3 break-words">{audit.url || audit.websiteId?.url}</h3>
                        
                        {/* Audit Metrics Display */}
                        <div id="src_pages_Dashboard_metrics" className="mb-3 p-4 rounded-lg bg-brushsteel/30 border border-borderGray overflow-hidden">
                          <div id="src_pages_Dashboard_n3nk" className="flex flex-wrap gap-x-4 gap-y-2 text-sm leading-relaxed font-medium w-full">
                            <span id="src_pages_Dashboard_8qyo" className="flex items-center gap-1">
                              <span id="src_pages_Dashboard_n4og" className="text-accent font-semibold">Content Clarity:</span>
                              <span id="src_pages_Dashboard_0vuc" className="text-contentGray">{audit.categoryScores?.contentClarity ?? 0}</span>
                            </span>
                            <span id="src_pages_Dashboard_x8tg" className="flex items-center gap-1">
                              <span id="src_pages_Dashboard_o1tw" className="text-accent font-semibold">Entity Trust:</span>
                              <span id="src_pages_Dashboard_i3fw" className="text-contentGray">{audit.categoryScores?.entityTrust ?? 0}</span>
                            </span>
                            <span id="src_pages_Dashboard_fdd6" className="flex items-center gap-1">
                              <span id="src_pages_Dashboard_m5wh" className="text-accent font-semibold">Technical Hygiene:</span>
                              <span id="src_pages_Dashboard_cr1i" className="text-contentGray">{audit.categoryScores?.technicalHygiene ?? 0}</span>
                            </span>
                            <span id="src_pages_Dashboard_sr2y" className="flex items-center gap-1">
                              <span id="src_pages_Dashboard_8bjd" className="text-accent font-semibold">AI Readability:</span>
                              <span id="src_pages_Dashboard_gv1u" className="text-contentGray">{audit.categoryScores?.aiReadability ?? 0}</span>
                            </span>
                          </div>
                          <div id="src_pages_Dashboard_ex0l" className="mt-2 pt-2 border-t border-borderGray/50 text-xs text-gray-400 overflow-hidden">
                            <div id="src_pages_Dashboard_pat5" className="flex flex-col sm:flex-row sm:items-center gap-1">
                              <span id="src_pages_Dashboard_ntw6" className="font-bold text-logo whitespace-nowrap">_id:</span>
                              <span id="src_pages_Dashboard_4coo" className="break-all font-mono text-gray-300 overflow-wrap-anywhere">{audit._id}</span>
                            </div>
                          </div>
                          {audit.createdAt && (
                            <div id="src_pages_Dashboard_0qpk" className="text-xs text-contentGray mt-1 italic break-words">
                              Analyzed by: <span id="src_pages_Dashboard_6wsr" className="text-logo font-semibold">AI</span> on {new Date(audit.createdAt).toLocaleString()}
                            </div>
                          )}
                        </div>

                        <div id="src_pages_Dashboard_pyk0" className="flex flex-wrap items-center gap-3 text-sm">
                          <span id="src_pages_Dashboard_4cgz" className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            audit.status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                            audit.status === 'processing' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                            audit.status === 'failed' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                            'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                          }`}>
                            {audit.status === 'completed' ? 'Completed' :
                             audit.status === 'processing' ? 'Processing' :
                             audit.status === 'failed' ? 'Failed' : 'Pending'}
                          </span>
                          {/* AI Visibility Status Badge */}
                          {audit.status === 'completed' && audit.visibilityStatus && (
                            <span id={`src_pages_Dashboard_visstat_${audit._id}`} className={
                              `px-3 py-1 rounded-full text-xs font-bold border ` +
                              (audit.visibilityStatus === 'visible' ? 'bg-green-100 text-green-800 border-green-400' :
                               audit.visibilityStatus === 'partially-visible' ? 'bg-yellow-100 text-yellow-700 border-yellow-400' :
                               audit.visibilityStatus === 'invisible' ? 'bg-red-100 text-red-700 border-red-400' :
                               'bg-gray-100 text-gray-500 border-gray-300')
                            }>
                              AI: {audit.visibilityStatus.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          )}
                          {audit.status === 'completed' && !audit.visibilityStatus && (
                            <span id={`src_pages_Dashboard_visstat_unavail_${audit._id}`} className="px-3 py-1 rounded-full text-xs font-bold border bg-gray-100 text-gray-500 border-gray-300">
                              AI: Status unavailable
                            </span>
                          )}
                        </div>
                      </div>
                      {audit.overallScore && (
                        <div id="src_pages_Dashboard_x0dj" className="stat-card px-6 py-4 rounded-xl text-center bg-brushsteel/40 border border-borderGray shadow-steel">
                          <p id="src_pages_Dashboard_kdv5" className="text-sm text-gray-400 uppercase tracking-wider mb-1">Score</p>
                          <p id="src_pages_Dashboard_3gmq" className="text-3xl font-bold text-accent">{audit.overallScore}</p>
                        </div>
                      )}
                    </div>
                    <AuditReport audit={audit} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
