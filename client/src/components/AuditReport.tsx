import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const AuditReport = ({ audit }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case "visible":
        return "text-white/80 bg-charcoal";
      case "partially-visible":
        return "text-white/80 bg-charcoal";
      case "invisible":
        return "text-white/80 bg-charcoal";
      default:
        return "text-white/70 bg-charcoal-light";
    }
  };

  const getImpactColor = (impact) => {
    switch (impact) {
      case "high":
        return "text-white/80 bg-charcoal";
      case "medium":
        return "text-white/80 bg-charcoal";
      case "low":
        return "text-white/80 bg-charcoal";
      default:
        return "text-white/70 bg-charcoal-light";
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-white/80";
    if (score >= 60) return "text-white/80";
    if (score >= 40) return "text-white/80";
    return "text-white/80";
  };

  return (
    <motion.div
      id="src_components_AuditReport_xq1m" initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div id="src_components_AuditReport_f9dt" className="flex justify-between items-start mb-6">
        <div id="src_components_AuditReport_q6uw">
          <h3 id="src_components_AuditReport_vf6o" className="text-lg font-bold text-white mb-2">{audit.url}</h3>
          <div id="src_components_AuditReport_b9vi" className="flex items-center space-x-4">
            <span id="src_components_AuditReport_fjm7" className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(audit.visibilityStatus)}`}>
              {audit.visibilityStatus?.replace("-", " ").toUpperCase()}
            </span>
            {audit.overallScore !== undefined && (
              <span id="src_components_AuditReport_2vux" className={`text-3xl font-bold ${getScoreColor(audit.overallScore)}`}>
                {audit.overallScore}/100
              </span>
            )}
          </div>
        </div>
        <Link
          to={`/audit/${audit._id}`}
          className="text-white/80 hover:text-white/80 font-medium"
        >
          View Details →
        </Link>
      </div>

      {audit.summary && (
        <div id="src_components_AuditReport_awt9" className="mb-6">
          <h4 id="src_components_AuditReport_h4kx" className="font-semibold text-white mb-2">Summary</h4>
          <p id="src_components_AuditReport_5ort" className="text-white/80">{audit.summary}</p>
        </div>
      )}

      {audit.categoryScores && (
        <div id="src_components_AuditReport_cat1" className="mb-6">
          <h4 id="src_components_AuditReport_cat2" className="font-semibold text-white mb-3">Category Scores</h4>
          <div id="src_components_AuditReport_cat3" className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(audit.categoryScores).map(([key, value]) => (
              <div id={`src_components_AuditReport_cat_${key}`} key={key} className="bg-charcoal-light p-3 rounded-xl">
                <div id={`src_components_AuditReport_cat_label_${key}`} className="text-xs text-white/70 mb-1 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div id={`src_components_AuditReport_cat_score_${key}`} className={`text-2xl font-bold ${getScoreColor(value)}`}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {audit.risks && audit.risks.length > 0 && (
        <div id="src_components_AuditReport_risk1" className="mb-6">
          <h4 id="src_components_AuditReport_risk2" className="font-semibold text-white mb-3">Top Risks</h4>
          <div id="src_components_AuditReport_risk3" className="space-y-2">
            {audit.risks.slice(0, 3).map((risk, index) => (
              <div id={`src_components_AuditReport_risk_${index}`} key={index} className="flex items-start space-x-2 text-sm">
                <span id={`src_components_AuditReport_risk_icon_${index}`} className={`px-2 py-1 rounded-full text-xs font-bold ${
                  risk.severity === 'high' ? 'bg-charcoal text-white/80' :
                  risk.severity === 'medium' ? 'bg-charcoal text-white/80' :
                  'bg-charcoal text-white/80'
                }`}>
                  {risk.severity.toUpperCase()}
                </span>
                <span id={`src_components_AuditReport_risk_desc_${index}`} className="text-white/80">{risk.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {audit.evidence && audit.evidence.length > 0 && (
        <div id="src_components_AuditReport_r6ur">
          <h4 id="src_components_AuditReport_7diy" className="font-semibold text-white mb-4">Key Findings</h4>
          <div id="src_components_AuditReport_2qgx" className="space-y-4">
            {audit.evidence.slice(0, 3).map((item, index) => (
              <div id="src_components_AuditReport_7otz" key={index} className="border-l-4 border-white/10 pl-4">
                <div id="src_components_AuditReport_ukr7" className="flex items-center justify-between mb-2">
                  <span id="src_components_AuditReport_b6tp" className="font-medium text-white">{item.category}</span>
                  <span id="src_components_AuditReport_sv1a" className={`px-2 py-1 rounded-full text-xs font-semibold ${getImpactColor(item.impact)}`}>
                    {item.impact.toUpperCase()}
                  </span>
                </div>
                <p id="src_components_AuditReport_vur1" className="text-sm text-white/80 mb-1">{item.finding}</p>
                <div id="src_components_AuditReport_evd1" className="mt-2 p-2 bg-charcoal-light rounded-xl">
                  <span id="src_components_AuditReport_evd2" className="block text-xs font-semibold text-white/70 mb-1">
                    Evidence: 
                    {item.evidence?.status === 'verified' && (
                      <span id="src_components_AuditReport_evd3" className="ml-1 text-white/80"> Verified</span>
                    )}
                    {item.evidence?.status === 'unknown' && (
                      <span id="src_components_AuditReport_evd4" className="ml-1 text-white/80"> Unknown</span>
                    )}
                  </span>
                  <p id="src_components_AuditReport_evd5" className="text-xs text-white/70 italic">
                    {item.evidence?.description || item.rawEvidence || 'No evidence available'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {audit.evidence.length > 3 && (
            <Link
              to={`/audit/${audit._id}`}
              className="text-white/80 hover:text-white/80 text-sm font-medium mt-4 inline-block"
            >
              View all {audit.evidence.length} findings →
            </Link>
          )}
        </div>
      )}

      <div id="src_components_AuditReport_0aig" className="mt-6 pt-6 border-t border-white/14 flex justify-between items-center text-sm text-white/70">
        <span id="src_components_AuditReport_4dwp">Analyzed by: {audit.aiProvider || "AI"}</span>
        <span id="src_components_AuditReport_0aqp" className="text-right">
          {new Date(audit.createdAt).toLocaleDateString()} at{" "}
          {new Date(audit.createdAt).toLocaleTimeString()}
        </span>
      </div>
      {audit._id && (
        <div id="src_components_AuditReport_id_section" className="mt-2 pt-2 border-t border-white/10">
          <div id="src_components_AuditReport_id_wrapper" className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span id="src_components_AuditReport_id_label" className="text-xs text-white/60 flex-shrink-0">
              Audit ID:
            </span>
            <span 
              id="src_components_AuditReport_id_value" 
              className="font-mono text-xs text-white/60 break-all overflow-wrap-anywhere w-full"
              title={audit._id}
            >
              {audit._id}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AuditReport;
