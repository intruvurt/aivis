import React, { useState } from "react";
import { updateStatus } from "../services/statusService";
import toast from "react-hot-toast";

export default function StatusUpdate({ currentStatus, onStatusChanged }) {
  const [status, setStatus] = useState(currentStatus || "active");
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    setLoading(true);
    
    try {
      await updateStatus(newStatus);
      toast.success("Status updated successfully!");
      if (onStatusChanged) onStatusChanged(newStatus);
    } catch (err) {
      toast.error(err.message || "Failed to update status");
      setStatus(currentStatus || "active");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="src_components_StatusUpdate_main" className="flex items-center space-x-3">
      <label id="src_components_StatusUpdate_1hhc" htmlFor="status" className="font-medium text-gray-300">
        Status:
      </label>
      <select
        id="status"
        className="border border-gray-700 bg-gray-800 text-gray-200 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        value={status}
        onChange={handleStatusChange}
        disabled={loading}
      >
        <option id="src_components_StatusUpdate_v1ky" value="active">Active</option>
        <option id="src_components_StatusUpdate_p4ge" value="paused">Paused</option>
        <option id="src_components_StatusUpdate_w9lu" value="archived">Archived</option>
      </select>
      {loading && (
        <span id="src_components_StatusUpdate_loading" className="text-sm text-gray-400 animate-pulse">
          Updating...
        </span>
      )}
    </div>
  );
}
