import React, { useState } from "react";
import { auditService } from "../services/auditService";
import toast from "react-hot-toast";

const AuditForm = ({ onAuditCreated }) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!url.trim()) {
      toast.error("Please enter a website URL");
      return;
    }

    // Normalize scheme to lowercase before parsing (handles Https://, HTTP://, etc.)
    const schemeLowered = url.trim().replace(
      /^([A-Za-z][A-Za-z0-9+\-.]*):\/\//,
      (_match, scheme) => scheme.toLowerCase() + "://"
    );
    const withScheme = /^https?:\/\//.test(schemeLowered)
      ? schemeLowered
      : `https://${schemeLowered}`;

    try {
      new URL(withScheme);
    } catch (error) {
      toast.error("Please enter a valid URL (e.g. https://yourdomain.com)");
      return;
    }

    setLoading(true);

    try {
      const audit = await auditService.createAudit(url);
      toast.success("Audit created successfully");
      setUrl("");
      
      toast.loading("Starting AI analysis...", { duration: 2000 });
      
      const analyzedAudit = await auditService.analyzeWebsite(audit._id);
      toast.success("Analysis completed!");
      
      if (onAuditCreated) {
        onAuditCreated(analyzedAudit);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create audit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="src_components_AuditForm_8ozo" className="card">
      <h2 id="src_components_AuditForm_heb4" className="text-2xl font-bold text-white mb-6">
        Analyze Website Visibility
      </h2>
      <form id="src_components_AuditForm_lf7r" onSubmit={handleSubmit} className="space-y-4">
        <div id="src_components_AuditForm_0ltd">
          <label id="src_components_AuditForm_gnz1" htmlFor="url" className="block text-sm font-medium text-white/80 mb-2">
            Website URL
          </label>
          <input
            type="text"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            enterKeyHint="go"
            className="input-field"
            disabled={loading}
          />
        </div>
        <button
          id="src_components_AuditForm_zhd9" type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span id="src_components_AuditForm_6cns" className="flex items-center justify-center">
              <svg id="src_components_AuditForm_zkj8" className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle id="src_components_AuditForm_obl9" className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path id="src_components_AuditForm_1yud" className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing...
            </span>
          ) : (
            "Start Deep Analysis"
          )}
        </button>
      </form>
    </div>
  );
};

export default AuditForm;
