import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { auditService } from "../services/auditService";
import toast from "react-hot-toast";

const AuditDetails = () => {
  const { id } = useParams();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const data = await auditService.getAuditById(id);
        setAudit(data);
      } catch (error) {
        toast.error("Failed to load audit details");
      } finally {
        setLoading(false);
      }
    };

    fetchAudit();
  }, [id]);

  const getStatusColor = (status) => {
    switch (status) {
      case "visible":
        return "text-green-600 bg-green-100";
      case "partially-visible":
        return "text-yellow-600 bg-yellow-100";
      case "invisible":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getImpactColor = (impact) => {
    switch (impact) {
      case "high":
        return "text-red-600 bg-red-100 border-red-200";
      case "medium":
        return "text-yellow-600 bg-yellow-100 border-yellow-200";
      case "low":
        return "text-blue-600 bg-blue-100 border-blue-200";
      default:
        return "text-gray-600 bg-gray-100 border-gray-200";
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div id="src_pages_AuditDetails_vpr6" className="min-h-screen flex items-center justify-center">
        <div id="src_pages_AuditDetails_ye2q" className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!audit || !audit._id) {
    return (
      <div id="src_pages_AuditDetails_2nov" className="min-h-screen flex items-center justify-center">
        <div id="src_pages_AuditDetails_5spz" className="text-center">
          <h2 id="src_pages_AuditDetails_id1j" className="text-2xl font-bold text-gray-900 mb-4">Audit not found</h2>
          <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-700">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="src_pages_AuditDetails_a6vs" className="min-h-screen bg-gray-50 py-12">
      <div id="src_pages_AuditDetails_ob3t" className="px-4 sm:px-6 lg:px-8">
        {/* AI Visibility Status Banner */}
        {audit.visibilityStatus && (
          <div id="src_pages_AuditDetails_visstat_banner" className={`mb-6 p-4 rounded-lg border-2 ${
            audit.visibilityStatus === 'visible' ? 'bg-green-50 border-green-400' :
            audit.visibilityStatus === 'partially-visible' ? 'bg-yellow-50 border-yellow-400' :
            audit.visibilityStatus === 'invisible' ? 'bg-red-50 border-red-400' :
            'bg-gray-50 border-gray-300'
          }`}>
            <div id="src_pages_AuditDetails_visstat_content" className="flex items-center gap-4">
              <span id="src_pages_AuditDetails_visstat_label" className="font-bold text-lg text-gray-900">AI Visibility Status:</span>
              <span id="src_pages_AuditDetails_visstat_badge" className={`px-4 py-2 rounded-full text-sm font-bold border ${
                audit.visibilityStatus === 'visible' ? 'bg-green-100 text-green-800 border-green-500' :
                audit.visibilityStatus === 'partially-visible' ? 'bg-yellow-100 text-yellow-700 border-yellow-500' :
                audit.visibilityStatus === 'invisible' ? 'bg-red-100 text-red-700 border-red-500' :
                'bg-gray-100 text-gray-500 border-gray-400'
              }`}>
                {audit.visibilityStatus.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              {audit.visibilityStatus === 'visible' && (
                <span id="src_pages_AuditDetails_visstat_desc_visible" className="text-green-700 text-sm">✓ This site is highly visible to AI search systems</span>
              )}
              {audit.visibilityStatus === 'partially-visible' && (
                <span id="src_pages_AuditDetails_visstat_desc_partial" className="text-yellow-700 text-sm">⚠ This site is partially visible to AI search systems</span>
              )}
              {audit.visibilityStatus === 'invisible' && (
                <span id="src_pages_AuditDetails_visstat_desc_invisible" className="text-red-700 text-sm">✗ This site is not visible to AI search systems</span>
              )}
            </div>
          </div>
        )}
        {!audit.visibilityStatus && audit.status === 'completed' && (
          <div id="src_pages_AuditDetails_visstat_unavail" className="mb-6 p-4 rounded-lg border-2 bg-gray-50 border-gray-300">
            <div id="src_pages_AuditDetails_oqd5" className="flex items-center gap-4">
              <span id="src_pages_AuditDetails_1vcf" className="font-bold text-lg text-gray-900">AI Visibility Status:</span>
              <span id="src_pages_AuditDetails_qb9b" className="px-4 py-2 rounded-full text-sm font-bold border bg-gray-100 text-gray-500 border-gray-400">
                Status Unavailable
              </span>
              <span id="src_pages_AuditDetails_6ygv" className="text-gray-600 text-sm">The AI visibility analysis did not complete successfully</span>
            </div>
          </div>
        )}
        <div id="src_pages_AuditDetails_9gqw" className="flex justify-between items-center mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-700"
          >
            <svg id="src_pages_AuditDetails_yr7s" className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path id="src_pages_AuditDetails_u9kc" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <Link
            to={`/export/${id}`}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
          >
            Export Report
          </Link>
        </div>

        <motion.div
          id="src_pages_AuditDetails_rtc5" initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-8"
        >
          <div id="src_pages_AuditDetails_8duq" className="flex justify-between items-start mb-6">
            <div id="src_pages_AuditDetails_6ihx">
              <h1 id="src_pages_AuditDetails_fpp3" className="text-3xl font-bold text-gray-900 mb-4">{audit.url}</h1>
              <div id="src_pages_AuditDetails_2kas" className="flex items-center space-x-4">
                <span id="src_pages_AuditDetails_2pgi" className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(audit.visibilityStatus)}`}>
                  {audit.visibilityStatus?.replace("-", " ").toUpperCase()}
                </span>
                {audit.overallScore !== undefined && (
                  <div id="src_pages_AuditDetails_s6ii" className="text-center">
                    <span id="src_pages_AuditDetails_6mbb" className={`text-5xl font-bold ${getScoreColor(audit.overallScore)}`}>
                      {audit.overallScore}
                    </span>
                    <span id="src_pages_AuditDetails_yyx9" className="text-gray-600 text-lg">/100</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {audit.summary && (
            <div id="src_pages_AuditDetails_ji9b" className="mb-6 p-4 bg-indigo-50 rounded-lg">
              <h3 id="src_pages_AuditDetails_a5sa" className="font-semibold text-gray-900 mb-2">Executive Summary</h3>
              <p id="src_pages_AuditDetails_dtm8" className="text-gray-700">{audit.summary}</p>
            </div>
          )}

          <div id="src_pages_AuditDetails_l2po" className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200">
            <div id="src_pages_AuditDetails_tsq3">
              <p id="src_pages_AuditDetails_7izd" className="text-sm text-gray-600">Status</p>
              <p id="src_pages_AuditDetails_mgx2" className="font-semibold text-gray-900">{audit.status}</p>
            </div>
            <div id="src_pages_AuditDetails_2xae">
              <p id="src_pages_AuditDetails_vb3e" className="text-sm text-gray-600">AI Provider</p>
              <p id="src_pages_AuditDetails_t9vz" className="font-semibold text-gray-900">{audit.aiProvider || "N/A"}</p>
            </div>
            <div id="src_pages_AuditDetails_5ucx">
              <p id="src_pages_AuditDetails_oa9g" className="text-sm text-gray-600">Processing Time</p>
              <p id="src_pages_AuditDetails_4ufa" className="font-semibold text-gray-900">
                {audit.processingTime ? `${(audit.processingTime / 1000).toFixed(2)}s` : "N/A"}
              </p>
            </div>
            <div id="src_pages_AuditDetails_je9r">
              <p id="src_pages_AuditDetails_0fus" className="text-sm text-gray-600">Date</p>
              <p id="src_pages_AuditDetails_7lxa" className="font-semibold text-gray-900">
                {new Date(audit.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          {audit._id && (
            <div id="src_pages_AuditDetails_audit_id" className="mt-4 pt-4 border-t border-gray-100">
              <p id="src_pages_AuditDetails_audit_id_label" className="text-sm text-gray-600 mb-1">Audit ID</p>
              <div id="src_pages_AuditDetails_audit_id_container" className="w-full overflow-hidden">
                <p 
                  id="src_pages_AuditDetails_audit_id_value" 
                  className="font-mono text-xs text-gray-900 break-all overflow-wrap-anywhere"
                  title={audit._id}
                >
                  {audit._id}
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {audit.categoryScores && (
          <motion.div
            id="src_pages_AuditDetails_scores" initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card mb-8"
          >
            <h2 id="src_pages_AuditDetails_scores_title" className="text-2xl font-bold text-gray-900 mb-6">Category Breakdown</h2>
            <div id="src_pages_AuditDetails_scores_grid" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(audit.categoryScores).map(([key, value]) => (
                <div id={`src_pages_AuditDetails_score_${key}`} key={key} className="bg-gray-50 p-4 rounded-lg text-center">
                  <div id={`src_pages_AuditDetails_score_label_${key}`} className="text-sm text-gray-600 mb-2 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div id={`src_pages_AuditDetails_score_value_${key}`} className={`text-4xl font-bold ${getScoreColor(value)}`}>
                    {value}
                  </div>
                  <div id={`src_pages_AuditDetails_score_max_${key}`} className="text-sm text-gray-500">/100</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {audit.risks && audit.risks.length > 0 && (
          <motion.div
            id="src_pages_AuditDetails_risks" initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card mb-8"
          >
            <h2 id="src_pages_AuditDetails_risks_title" className="text-2xl font-bold text-gray-900 mb-6">Identified Risks</h2>
            <div id="src_pages_AuditDetails_risks_list" className="space-y-4">
              {audit.risks.map((risk, index) => (
                <div id={`src_pages_AuditDetails_risk_${index}`} key={index} className="border-l-4 border-red-500 pl-4 py-3">
                  <div id={`src_pages_AuditDetails_risk_header_${index}`} className="flex items-center justify-between mb-2">
                    <span id={`src_pages_AuditDetails_risk_cat_${index}`} className="font-semibold text-gray-900">{risk.category}</span>
                    <span id={`src_pages_AuditDetails_risk_sev_${index}`} className={`px-3 py-1 rounded-full text-xs font-bold ${
                      risk.severity === 'high' ? 'bg-red-100 text-red-700' :
                      risk.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {risk.severity.toUpperCase()}
                    </span>
                  </div>
                  <p id={`src_pages_AuditDetails_risk_desc_${index}`} className="text-gray-700 mb-2">{risk.description}</p>
                  <div id={`src_pages_AuditDetails_risk_rec_${index}`} className="bg-gray-50 p-3 rounded">
                    <span id={`src_pages_AuditDetails_risk_rec_label_${index}`} className="text-sm font-semibold text-gray-600">Recommendation:</span>
                    <p id={`src_pages_AuditDetails_risk_rec_text_${index}`} className="text-sm text-gray-700 mt-1">{risk.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {audit.recommendations && audit.recommendations.length > 0 && (
          <motion.div
            id="src_pages_AuditDetails_recs" initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card mb-8"
          >
            <h2 id="src_pages_AuditDetails_recs_title" className="text-2xl font-bold text-gray-900 mb-6">Recommended Actions</h2>
            <div id="src_pages_AuditDetails_recs_list" className="space-y-4">
              {audit.recommendations.map((rec, index) => (
                <div id={`src_pages_AuditDetails_rec_${index}`} key={index} className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <div id={`src_pages_AuditDetails_rec_header_${index}`} className="flex items-center justify-between mb-2">
                    <span id={`src_pages_AuditDetails_rec_cat_${index}`} className="font-semibold text-gray-900">{rec.category}</span>
                    <span id={`src_pages_AuditDetails_rec_pri_${index}`} className={`px-3 py-1 rounded-full text-xs font-bold ${
                      rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {rec.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  <p id={`src_pages_AuditDetails_rec_action_${index}`} className="text-gray-900 font-medium mb-2">{rec.action}</p>
                  <p id={`src_pages_AuditDetails_rec_impact_${index}`} className="text-sm text-gray-600">{rec.impact}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {audit.evidence && audit.evidence.length > 0 && (
          <motion.div
            id="src_pages_AuditDetails_0ljw" initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card"
          >
            <h2 id="src_pages_AuditDetails_7nke" className="text-2xl font-bold text-gray-900 mb-6">Evidence Trail</h2>
            <div id="src_pages_AuditDetails_4xpe" className="space-y-6">
              {audit.evidence.map((item, index) => (
                <div
                  id={`src_pages_AuditDetails_vq7l_${index}`} key={index}
                  className={`border-2 rounded-lg p-6 ${getImpactColor(item.impact)}`}
                >
                  <div id={`src_pages_AuditDetails_re1b_${index}`} className="flex items-start justify-between mb-4">
                    <div id={`src_pages_AuditDetails_3zfw_${index}`}>
                      <span id={`src_pages_AuditDetails_uix6_${index}`} className="inline-block px-3 py-1 bg-white rounded-full text-sm font-semibold mb-2">
                        {item.category}
                      </span>
                      <h3 id={`src_pages_AuditDetails_7akd_${index}`} className="text-xl font-bold text-gray-900">{item.finding}</h3>
                    </div>
                    <span id={`src_pages_AuditDetails_uh1x_${index}`} className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getImpactColor(item.impact)}`}>
                      {item.impact} Impact
                    </span>
                  </div>

                  <div id={`src_pages_AuditDetails_k7sy_${index}`} className="mb-4">
                    <h4 id={`src_pages_AuditDetails_9ovy_${index}`} className="font-semibold text-gray-900 mb-2">
                      Evidence:
                      {item.evidence?.status === 'verified' && (
                        <span id={`src_pages_AuditDetails_evd_verified_${index}`} className="ml-2 text-green-600 text-sm">✓ Verified</span>
                      )}
                      {item.evidence?.status === 'unknown' && (
                        <span id={`src_pages_AuditDetails_evd_unknown_${index}`} className="ml-2 text-yellow-600 text-sm">⚠ Unknown</span>
                      )}
                    </h4>
                    <p id={`src_pages_AuditDetails_pkc7_${index}`} className="text-gray-700 italic">
                      {item.evidence?.description || item.rawEvidence || 'No evidence available'}
                    </p>
                    {item.evidence?.source && (
                      <p id={`src_pages_AuditDetails_evd_source_${index}`} className="text-xs text-gray-500 mt-1">
                        Source: {item.evidence.source}
                      </p>
                    )}
                  </div>

                  <div id={`src_pages_AuditDetails_gs7o_${index}`} className="bg-white bg-opacity-50 rounded-lg p-4">
                    <h4 id={`src_pages_AuditDetails_s2nu_${index}`} className="font-semibold text-gray-900 mb-2">Recommendation:</h4>
                    <p id={`src_pages_AuditDetails_pj3n_${index}`} className="text-gray-700">{item.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AuditDetails;
