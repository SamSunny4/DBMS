export default function StatCard({ title, value, icon: Icon, color = "text-accent" }) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          {title}
        </p>
        {Icon && <Icon size={18} className={color} />}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value ?? "—"}</p>
    </div>
  );
}
