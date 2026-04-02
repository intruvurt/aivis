import React from "react";
import { motion } from "framer-motion";
import { useQuery } from "react-query";
import { getPlatformStats } from "../services/api";

export default function AnalyticalDashboard() {
  const { data: stats, isLoading, isError } = useQuery(
    "platformStats",
    getPlatformStats,
    {
      refetchInterval: 10000, // Refresh every 10 seconds for live stats
      retry: 2,
      staleTime: 5000
    }
  );

  // Show loading state
  if (isLoading) {
    return (
      <motion.div
        id="src_components_AnalyticalDashboard_loading"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.95 }}
        className="rounded-2xl bg-gradient-to-br from-gray-950 to-gray-900/85 shadow-2xl border border-indigo-800/60 px-4 sm:px-7 py-4 sm:py-6 flex justify-center items-center pointer-events-auto"
      >
        <span id="src_components_AnalyticalDashboard_oto7" className="text-gray-300 text-sm">Loading live stats...</span>
      </motion.div>
    );
  }

  // Show error state
  if (isError) {
    return (
      <motion.div
        id="src_components_AnalyticalDashboard_error"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.95 }}
        className="rounded-2xl bg-gradient-to-br from-gray-950 to-gray-900/85 shadow-2xl border border-red-800/60 px-4 sm:px-7 py-4 sm:py-6 flex justify-center items-center pointer-events-auto"
      >
        <span id="src_components_AnalyticalDashboard_mpy3" className="text-red-400 text-sm">Stats unavailable</span>
      </motion.div>
    );
  }

  // Map real stats to display metrics
  const metrics = [
    { 
      label: "Active Users", 
      value: stats?.activeUsers || 0, 
      color: "from-blue-500 to-cyan-500" 
    },
    { 
      label: "API Latency", 
      value: stats?.apiLatency || "-- ms", 
      color: "from-purple-500 to-indigo-600" 
    },
    { 
      label: "Platform Health", 
      value: stats?.status || "Unknown", 
      color: "from-green-500 to-teal-500" 
    },
    { 
      label: "Total Audits", 
      value: stats?.totalAudits || 0, 
      color: "from-pink-500 to-fuchsia-500" 
    }
  ];
  
  return (
    <motion.div
      id="src_components_AnalyticalDashboard_5vay"
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.95 }}
      className="rounded-2xl bg-gradient-to-br from-gray-950 to-gray-900/85 shadow-2xl border border-indigo-800/60 px-4 sm:px-7 py-4 sm:py-6 flex flex-wrap gap-2 sm:gap-6 justify-center pointer-events-auto"
      style={{ backgroundBlendMode: "multiply" }}
    >
      {metrics.map((m, i) => {
        const isHealthMetric = m.label === "Platform Health";
        const isHealthDegraded = isHealthMetric && m.value !== "Online";
        
        return (
          <div
            id={`src_components_AnalyticalDashboard_metric_${i}`}
            key={m.label}
            className={`flex flex-col items-center min-w-[70px] px-2 py-2 rounded-xl bg-gradient-to-b ${m.color} bg-clip-padding bg-opacity-10`}
          >
            <span 
              id={`src_components_AnalyticalDashboard_label_${i}`}
              className="text-xs font-semibold uppercase tracking-wide text-gray-300/90 drop-shadow-md"
            >
              {m.label}
            </span>
            <span 
              id={`src_components_AnalyticalDashboard_value_${i}`}
              className={`mt-0.5 text-lg md:text-xl font-mono font-bold ${
                isHealthDegraded 
                  ? "text-amber-400 animate-pulse" 
                  : "text-[#98fb98]"
              }`}
            >
              {m.value}
            </span>
          </div>
        );
      })}
    </motion.div>
  );
}
