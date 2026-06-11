import {
  LucideIcon,
  Sparkles,
} from "lucide-react";

type DashboardTone = "business" | "school" | "admin" | "neutral";

type DashboardPageShellProps = {
  title: string;
  description?: string;
  badge?: string;
  tone?: DashboardTone;
  icon?: LucideIcon;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

function getToneClasses(tone: DashboardTone) {
  if (tone === "school") {
    return {
      page:
        "bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.16),transparent_34%),radial-gradient(circle_at_top_left,rgba(15,23,42,0.7),transparent_30%)]",
      badge:
        "border-indigo-400/20 bg-indigo-400/10 text-indigo-200",
      iconBox:
        "border-indigo-400/20 bg-indigo-400/10 text-indigo-300",
      glow:
        "from-indigo-400/20 via-transparent to-transparent",
    };
  }

  if (tone === "admin") {
    return {
      page:
        "bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.15),transparent_34%),radial-gradient(circle_at_top_left,rgba(15,23,42,0.7),transparent_30%)]",
      badge:
        "border-sky-400/20 bg-sky-400/10 text-sky-200",
      iconBox:
        "border-sky-400/20 bg-sky-400/10 text-sky-300",
      glow:
        "from-sky-400/20 via-transparent to-transparent",
    };
  }

  if (tone === "business") {
    return {
      page:
        "bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_34%),radial-gradient(circle_at_top_left,rgba(15,23,42,0.7),transparent_30%)]",
      badge:
        "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
      iconBox:
        "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
      glow:
        "from-emerald-400/20 via-transparent to-transparent",
    };
  }

  return {
    page:
      "bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.12),transparent_34%),radial-gradient(circle_at_top_left,rgba(15,23,42,0.7),transparent_30%)]",
    badge:
      "border-slate-400/20 bg-slate-400/10 text-slate-200",
    iconBox:
      "border-slate-400/20 bg-slate-400/10 text-slate-300",
    glow:
      "from-slate-400/20 via-transparent to-transparent",
  };
}

export function DashboardPageShell({
  title,
  description,
  badge,
  tone = "neutral",
  icon: Icon = Sparkles,
  children,
  actions,
}: DashboardPageShellProps) {
  const toneClasses = getToneClasses(tone);

  return (
    <main className={`min-h-screen px-4 py-6 text-white ${toneClasses.page}`}>
      <div className="mx-auto max-w-7xl">
        <section className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/20 backdrop-blur">
          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${toneClasses.glow}`}
          />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneClasses.iconBox}`}
              >
                <Icon className="h-5 w-5" />
              </div>

              <div>
                {badge ? (
                  <div
                    className={`mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClasses.badge}`}
                  >
                    {badge}
                  </div>
                ) : null}

                <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">
                  {title}
                </h1>

                {description ? (
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 md:text-base md:leading-7">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>

            {actions ? (
              <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>
            ) : null}
          </div>
        </section>

        {children}
      </div>
    </main>
  );
}

export function SmartCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`dark-card rounded-[var(--radius-panel)] p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function SmartStatCard({
  label,
  value,
  icon: Icon,
  tone = "business",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: DashboardTone;
}) {
  const toneClasses = getToneClasses(tone);

  return (
    <div className="dark-card rounded-[var(--radius-panel)] p-5">
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border ${toneClasses.iconBox}`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <p className="text-3xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}