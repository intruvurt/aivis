import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import axios from "axios";

const Export = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const canExport = user?.tier !== "Free";

  const handleExportPDF = async () => {
    if (!canExport) {
      toast.error("Upgrade to Jump Start or higher to export");
      navigate("/pricing");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/export/pdf/${id}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success("PDF export coming soon");
    } catch (error) {
      toast.error(error.response?.data?.error || "Export failed");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!canExport) {
      toast.error("Upgrade to Jump Start or higher to share");
      navigate("/pricing");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/export/share/${id}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        navigator.clipboard.writeText(response.data.data.shareUrl);
        toast.success("Share link copied to clipboard");
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "Share failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="src_pages_Export_main" className="min-h-screen bg-gray-50 py-12">
      <div id="src_pages_Export_container" className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          id="src_pages_Export_card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm p-8"
        >
          <h1 id="src_pages_Export_title" className="text-2xl font-bold text-gray-900 mb-6">
            Export Report
          </h1>

          {!canExport && (
            <div id="src_pages_Export_upgrade" className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p id="src_pages_Export_yl5u" className="text-sm text-yellow-800">
                Export features require Jump Start tier or higher.
              </p>
              <button
                id="src_pages_Export_2lii" onClick={() => navigate("/pricing")}
                className="mt-3 text-sm font-semibold text-yellow-900 underline"
              >
                View pricing
              </button>
            </div>
          )}

          <div id="src_pages_Export_options" className="space-y-4">
            <button
              id="src_pages_Export_pdf"
              onClick={handleExportPDF}
              disabled={!canExport || loading}
              className={`w-full py-3 px-4 rounded-lg font-semibold ${
                !canExport || loading
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {loading ? "Processing..." : "Export as PDF"}
            </button>

            <button
              id="src_pages_Export_share"
              onClick={handleShare}
              disabled={!canExport || loading}
              className={`w-full py-3 px-4 rounded-lg font-semibold ${
                !canExport || loading
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gray-600 text-white hover:bg-gray-700"
              }`}
            >
              {loading ? "Processing..." : "Generate Share Link"}
            </button>
          </div>

          <div id="src_pages_Export_back" className="mt-6">
            <button
              id="src_pages_Export_bkk3" onClick={() => navigate(`/audit/${id}`)}
              className="text-indigo-600 hover:text-indigo-700 text-sm"
            >
              ← Back to report
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Export;
