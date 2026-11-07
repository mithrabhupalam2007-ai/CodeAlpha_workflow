import apiClient from "./client.js";

/** GET /api/health — verifies frontend -> backend -> MongoDB connectivity. */
export const fetchHealth = async () => {
  const { data } = await apiClient.get("/health");
  return data;
};
