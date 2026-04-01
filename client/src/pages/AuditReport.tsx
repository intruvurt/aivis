import React from "react";
import PropTypes from "prop-types";

const AuditReport = ({ analysis, onBack }) => {
  if (!analysis) {
    return (
      <div id="src_pages_auditreport_a1b2" className="p-6 max-w-3xl mx-auto">
        <p id="src_pages_AuditReport_lg1f" className="italic text-gray-500">No analysis available.</p>
        {onBack && (
          <button id="src_pages_AuditReport_kb1w" onClick={onBack} className="mt-4 px-4 py-2 rounded bg-slate-500 text-white hover:bg-slate-600">
            Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div id="src_pages_auditreport_main" className="p-6 max-w-4xl mx-auto">
      <h1 id="src_pages_AuditReport_p6ve" className="text-3xl font-bold mb-6">AI-Driven Reflective-x3 Audit Report</h1>

      {/* Score Breakdown */}
      {analysis.scoreBreakdown && (
        <section id="src_pages_AuditReport_t4qz" className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 id="src_pages_AuditReport_n1oh" className="text-xl font-semibold mb-4">Score Breakdown</h2>
          <div id="src_pages_AuditReport_b2tw" className="space-y-3">
            {Object.entries(analysis.scoreBreakdown).map(([category, data]) => (
              <div key={category} id={`score_${category}`} className="flex items-center justify-between border-b pb-2">
                <span id="src_pages_AuditReport_ki8c" className="font-medium capitalize">{category.replace(/([A-Z])/g, " $1").trim()}</span>
                <div id="src_pages_AuditReport_1pvf" className="flex items-center gap-4">
                  <span id="src_pages_AuditReport_c1fd" className="font-mono text-lg font-bold">{data.score || 0} / 100</span>
                  {data.confidence && (
                    <span id="src_pages_AuditReport_vmh5" className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Confidence: {data.confidence}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <section id="src_pages_AuditReport_tzq3" className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 id="src_pages_AuditReport_lci2" className="text-xl font-semibold mb-4">Recommendations</h2>
          <ul id="src_pages_AuditReport_u2ah" className="space-y-3">
            {analysis.recommendations.map((r, idx) => (
              <li id="src_pages_AuditReport_v6ts" key={idx} className="flex items-start gap-2">
                <span id="src_pages_AuditReport_u1sy" className="text-blue-600 mt-1">•</span>
                <div id="src_pages_AuditReport_tsf3" className="flex-1">
                  <p id="src_pages_AuditReport_seo5" className="text-gray-800">{r.text || r}</p>
                  {r.evidenceIds && r.evidenceIds.length > 0 && (
                    <span id="src_pages_AuditReport_v2fq" className="text-xs text-gray-500 mt-1 inline-block">
                      [evidence: {r.evidenceIds.join(", ")}]
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Evidence List */}
      {analysis.evidenceList && analysis.evidenceList.length > 0 && (
        <section id="src_pages_AuditReport_mz6k" className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 id="src_pages_AuditReport_0jsa" className="text-xl font-semibold mb-4">Evidence</h2>
          <div id="src_pages_AuditReport_er4j" className="space-y-4">
            {analysis.evidenceList.map((ev) => (
              <div id="src_pages_AuditReport_m3wc" key={ev.id} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50">
                <div id="src_pages_AuditReport_no1v" className="flex items-start justify-between mb-2">
                  <div id="src_pages_AuditReport_9ixf">
                    <span id="src_pages_AuditReport_exo9" className="font-bold text-gray-900">{ev.type}</span>
                    <span id="src_pages_AuditReport_dl2s" className="text-gray-500 text-sm ml-2">({ev.id})</span>
                  </div>
                  {ev.confidence && (
                    <span id="src_pages_AuditReport_nc8a" className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {ev.confidence}
                    </span>
                  )}
                </div>
                <div id="src_pages_AuditReport_3dzs" className="text-sm text-gray-700 space-y-1">
                  <p id="src_pages_AuditReport_gl6a">
                    <span id="src_pages_AuditReport_z1vr" className="font-medium">Source:</span>{" "}
                    <code id="src_pages_AuditReport_l5bz" className="bg-gray-200 px-1 rounded text-xs">{ev.source_url}</code>
                    {ev.source_kind && <span id="src_pages_AuditReport_ua5s" className="ml-2 text-gray-500">[{ev.source_kind}]</span>}
                  </p>
                  {ev.hash && (
                    <p id="src_pages_AuditReport_nn7f">
                      <span id="src_pages_AuditReport_7niq" className="font-medium">Hash:</span>{" "}
                      <code id="src_pages_AuditReport_3ucn" className="bg-gray-200 px-1 rounded text-xs">{ev.hash}</code>
                    </p>
                  )}
                  {ev.observed_at && (
                    <p id="src_pages_AuditReport_6ntn">
                      <span id="src_pages_AuditReport_b0zd" className="font-medium">Observed:</span>{" "}
                      {new Date(ev.observed_at).toLocaleString()}
                    </p>
                  )}
                  {ev.notes && (
                    <p id="src_pages_AuditReport_r9ub" className="italic text-gray-600">
                      <span id="src_pages_AuditReport_euy1" className="font-medium">Notes:</span> {ev.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Validation */}
      {analysis.validation && (
        <section id="src_pages_AuditReport_w3bz" className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 id="src_pages_AuditReport_xc1z" className="text-xl font-semibold mb-4">Validation</h2>
          <pre id="src_pages_AuditReport_w0io" className="bg-gray-100 p-4 text-sm overflow-x-auto rounded">
            {JSON.stringify(analysis.validation, null, 2)}
          </pre>
        </section>
      )}

      {/* Explanation */}
      {analysis.explanation && (
        <section id="src_pages_AuditReport_p7iu" className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 id="src_pages_AuditReport_0pgk" className="text-xl font-semibold mb-4">Explanation</h2>
          <div id="src_pages_AuditReport_6mpn" className="prose max-w-none text-gray-700">
            {typeof analysis.explanation === "string" ? (
              <p id="src_pages_AuditReport_qrt9">{analysis.explanation}</p>
            ) : (
              <pre id="src_pages_AuditReport_2tmk" className="bg-gray-100 p-4 text-sm overflow-x-auto rounded">
                {JSON.stringify(analysis.explanation, null, 2)}
              </pre>
            )}
          </div>
        </section>
      )}

      {/* Provider Errors */}
      {analysis.providerErrors && analysis.providerErrors.length > 0 && (
        <section id="src_pages_AuditReport_v4ga" className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 id="src_pages_AuditReport_gia6" className="text-xl font-semibold mb-4 text-yellow-800">Provider Warnings</h2>
          <ul id="src_pages_AuditReport_5eqx" className="space-y-2">
            {analysis.providerErrors.map((err, idx) => (
              <li id="src_pages_AuditReport_ktc7" key={idx} className="text-sm text-yellow-700">
                <span id="src_pages_AuditReport_7khf" className="font-medium">{err.stage}</span> ({err.provider}): {err.error}
              </li>
            ))}
          </ul>
        </section>
      )}

      {onBack && (
        <button 
          id="src_pages_AuditReport_s9ek" onClick={onBack} 
          className="mt-6 px-6 py-3 rounded bg-slate-600 text-white hover:bg-slate-700 transition-colors"
        >
          Back to Dashboard
        </button>
      )}
    </div>
  );
};

AuditReport.propTypes = {
  analysis: PropTypes.object,
  onBack: PropTypes.func
};

export default AuditReport;
