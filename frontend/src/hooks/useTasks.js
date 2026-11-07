import { useCallback, useEffect, useState } from "react";

import { getTasks } from "../api/tasks.js";

/**
 * Loads GET /api/tasks for the given filter/sort params with
 * loading / error / refetch states.
 *
 * `refetch(false)` refreshes silently (no loading flicker) — used after
 * mutations so the list stays in sync without re-showing skeletons.
 */
export function useTasks(params) {
  const [tasks, setTasks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Re-runs whenever any filter/sort value changes.
  const key = JSON.stringify(params);

  const refetch = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const data = await getTasks(JSON.parse(key));
        setTasks(data.tasks);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [key]
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { tasks, setTasks, loading, error, refetch };
}

export default useTasks;
