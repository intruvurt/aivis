import axios from "axios";
const BASE = import.meta.env.VITE_API_URL + "/api/aiaudit";

export function runAiAudit({ prompts, blueprint }) {
  if (!Array.isArray(prompts) || !blueprint)
    throw new Error("Prompts and build spec required");
  return axios.post(BASE + "/run", { prompts, blueprint }).then(r => r.data);
}

export function fetchAuditRun(auditId) {
  if (!auditId) throw new Error("auditId required");
  return axios.get(`${BASE}/result/${auditId}`).then(r => r.data);
}

export function fetchAvailableBuildSpecs() {
  return axios.get(BASE + "/buildspecs").then(r => r.data);
}
