import { Activity } from "lucide-react";

import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import ActivityItem from "./ActivityItem.jsx";

/** Latest workspace activity for the signed-in user. */
export default function ActivityFeedCard({ entries }) {
  return (
    <Card title="Recent Activity" subtitle="What's been happening">
      {!entries || entries.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Project and task updates will show up here."
        />
      ) : (
        <ul className="-mx-1 divide-y divide-slate-100">
          {entries.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </Card>
  );
}
