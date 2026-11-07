import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import WeeklyBarChart from "../ui/WeeklyBarChart.jsx";
import { BarChart3 } from "lucide-react";

/** Tasks completed per day over the last 7 days. */
export default function WeeklyCompletionsCard({ data }) {
  return (
    <Card title="Tasks Completed" subtitle="Last 7 days">
      {data && data.length > 0 ? (
        <WeeklyBarChart data={data} />
      ) : (
        <EmptyState
          icon={BarChart3}
          title="No history yet"
          description="Completed tasks will be charted here."
        />
      )}
    </Card>
  );
}
