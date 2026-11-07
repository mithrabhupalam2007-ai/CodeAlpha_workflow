import { useCallback, useEffect, useState } from "react";

import { fetchHealth } from "../api/health.js";

/**
 * Polls /api/health to keep a live read on the API + database.
 * Used by the connection badge and the dashboard system card.
 */
export function useHealth(pollMs = 30000) {
  const [state, setState] = useState({
    loading: true,
    online: false,
    data: null,
    error: null,
  });

  const check = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setState({ loading: false, online: true, data, error: null });
    } catch (error) {
      setState({ loading: false, online: false, data: null, error });
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, pollMs);
    return () => clearInterval(id);
  }, [check, pollMs]);

  return { ...state, refetch: check };
}

export default useHealth;
