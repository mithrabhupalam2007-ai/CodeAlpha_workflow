import { useCallback, useEffect, useState } from "react";

import { getDashboardSummary } from "../api/dashboard.js";

/**
 * Loads GET /api/dashboard/summary with loading / error / refetch states.
 */
export function useDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardSummary();
      setSummary(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { summary, loading, error, refetch };
}

export default useDashboard;
