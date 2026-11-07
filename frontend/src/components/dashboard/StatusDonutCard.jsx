import { ListChecks } from "lucide-react";

import Card from "../ui/Card.jsx";
import ChartDonut from "../ui/ChartDonut.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { STATUS_HEX } from "../../utils/projectColors.js";

/** Donut: done vs in-progress vs to-do across the workspace. */
export default function StatusDonutCard({ byStatus, completionRate }) {
  const segments = [
    { label: "Done", value: byStatus?.done ?? 0, color: STATUS_HEX.done },
    {
      label: "In progress",
      value: byStatus?.["in-progress"] ?? 0,
      color: STATUS_HEX["in-progress"],
    },
    {
      label: "In review",
      value: byStatus?.["in-review"] ?? 0,
      color: STATUS_HEX["in-review"],
    },
    { label: "To do", value: byStatus?.todo ?? 0, color: STATUS_HEX.todo },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <Card title="Task Status" subtitle="Across all projects">
      {total === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          description="Task statuses will appear here once projects have tasks."
        />
      ) : (
        <ChartDonut
          segments={segments}
          centerValue={`${completionRate ?? 0}%`}
          centerLabel="completed"
        />
      )}
    </Card>
  );
}
