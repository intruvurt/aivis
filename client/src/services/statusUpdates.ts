import api from "./api";

const API_URL = "/status-updates";

export const fetchStatusUpdates = async () => {
  const res = await api.get(API_URL);
  return res.data.statusUpdates;
};

export const createStatusUpdate = async (data) => {
  const res = await api.post(API_URL, data);
  return res.data.statusUpdate;
};

export const deleteStatusUpdate = async (id) => {
  await api.delete(`${API_URL}/${id}`);
};
