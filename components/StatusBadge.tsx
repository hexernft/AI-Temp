type StatusBadgeProps = {
  status: string;
};

const statusLabels: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  no_response: "No Response",
  interested: "Interested",
  visited_again: "Visited Again",
  needs_attention: "Needs Attention",
  inactive: "Inactive",
  active: "Active",
};

const statusClasses: Record<string, string> = {
  new: "status-badge-blue",
  contacted: "status-badge-emerald",
  no_response: "status-badge-slate",
  interested: "status-badge-violet",
  visited_again: "status-badge-cyan",
  needs_attention: "status-badge-amber",
  inactive: "status-badge-red",
  active: "status-badge-emerald",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const label = statusLabels[status] || status;
  const className = statusClasses[status] || "status-badge-slate";

  return <span className={`status-badge ${className}`}>{label}</span>;
}
