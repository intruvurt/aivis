import api from "./api.ts";

export const aiAnalysisService = {
  runAnalysis: async (extractedFacts, evidenceSummaries) => {
    const response = await api.post("/orchestrator/analyze", {
      extractedFacts,
      evidenceSummaries
    });
    return response.data.data;
  },

  getAuditLogs: async (params = {}) => {
    const response = await api.get("/orchestrator/logs", { params });
    return response.data.data;
  }
};
