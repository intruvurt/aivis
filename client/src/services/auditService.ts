import axios from "axios";

/**
 * Base URL strategy:
 * - If VITE_API_URL is set, use it (recommended for prod)
 * - Otherwise default to "/api" so dev proxy can handle it (Vite/React proxy)
 *
 * Examples:
 *   VITE_API_URL="http://localhost:8787/api"
 *   VITE_API_URL="https://api.aivis.biz"
 */
const API_BASE =
  (import.meta?.env?.VITE_API_URL && String(import.meta.env.VITE_API_URL)) || "/api";

const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // keep if you use cookies/sessions; safe to leave on
  timeout: 60_000,
});

function normalizeError(err) {
  // Consistent error shape for UI
  const message =
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    "Request failed";
  const status = err?.response?.status;
  return { message, status, raw: err };
}

export const auditService = {
  /**
   * Creates a new audit record for a URL.
   * Expected backend: POST /audits  { url }
   * Returns: audit object with _id
   */
  async createAudit(url) {
    try {
      const res = await http.post("/audits", { url });
      return res.data;
    } catch (err) {
      throw normalizeError(err);
    }
  },

  /**
   * Triggers analysis for an existing audit.
   * Expected backend: POST /audits/:id/analyze
   * Returns: analyzed audit object
   */
  async analyzeWebsite(auditId) {
    if (!auditId) throw { message: "Missing audit id" };
    try {
      const res = await http.post(`/audits/${auditId}/analyze`);
      return res.data;
    } catch (err) {
      throw normalizeError(err);
    }
  },

  /**
   * Optional helpers (use if your UI needs them)
   */
  async getAudit(auditId) {
    if (!auditId) throw { message: "Missing audit id" };
    try {
      const res = await http.get(`/audits/${auditId}`);
      return res.data;
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async listAudits() {
    try {
      const res = await http.get("/audits");
      return res.data;
    } catch (err) {
      throw normalizeError(err);
    }
  },
};