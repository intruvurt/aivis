import api from "./api";

export const updateStatus = async (newStatus) => {
  if (!newStatus || !["active", "paused", "archived"].includes(newStatus)) {
    throw new Error("Invalid status value");
  }
  
  const response = await api.post("/status/update", { status: newStatus });
  
  if (!response.data.success) {
    throw new Error(response.data.error || "Status update failed");
  }
  
  return response.data;
};

export const getStatus = async () => {
  const response = await api.get("/status");
  
  if (!response.data.success) {
    throw new Error(response.data.error || "Failed to fetch status");
  }
  
  return response.data.data;
};
