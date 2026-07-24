import Card from '../ui/Card';

export function DashboardListItem({ title, subtitle, actionLabel, onAction }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
      </div>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          {actionLabel}
        </button>
      )}
    </li>
  );
}

export function DashboardListCard({ title, subtitle, items = [], actionLabel }) {
  return (
    <Card title={title} subtitle={subtitle}>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <DashboardListItem
            key={index}
            title={item.title}
            subtitle={item.subtitle}
            actionLabel={item.actionLabel ?? actionLabel}
          />
        ))}
      </ul>
    </Card>
  );
}

export function DashboardProgressList({ title, subtitle, items = [] }) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-900">{item.label}</span>
              <span className="text-slate-500">{item.progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-indigo-600 transition-all"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DashboardMetricCard({ title, subtitle, value, icon: Icon, tone = 'violet' }) {
  const toneClasses = {
    violet: 'text-indigo-600 bg-indigo-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    sky: 'text-sky-600 bg-sky-50',
  };

  return (
    <Card title={title}>
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-3xl font-semibold text-slate-900">{value}</div>
          {Icon && (
            <div className={`rounded-2xl p-3 ${toneClasses[tone] ?? toneClasses.violet}`}>
              <Icon size={20} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function DashboardChartCard({ title, subtitle, label, value, icon: Icon, gradient = 'from-indigo-400 to-indigo-600' }) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
        <div className="flex items-center justify-between">
          <div>
            {label && <p className="text-sm text-slate-500">{label}</p>}
            {value && <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>}
          </div>
          {Icon && <Icon size={24} className="text-indigo-600" />}
        </div>
        <div className={`mt-6 h-36 rounded-2xl bg-gradient-to-r ${gradient}`} />
      </div>
    </Card>
  );
}

export function DashboardActivityFeed({ title, items = [] }) {
  return (
    <Card title={title}>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.active ? 'bg-indigo-600' : 'bg-slate-300'}`} />
            <div>
              <div className="text-sm text-slate-900">{item.title}</div>
              <div className="mt-0.5 text-xs text-slate-500">{item.time}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function DashboardInfoRows({ title, items = [] }) {
  return (
    <Card title={title}>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
          >
            <div>
              <p className="font-medium text-slate-900">{item.label}</p>
              {item.subtitle && <p className="text-sm text-slate-500">{item.subtitle}</p>}
            </div>
            <div className={`text-sm font-semibold ${item.tone ?? 'text-slate-700'}`}>{item.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DashboardProfileCard({ name, meta, badge, stats = [] }) {
  return (
    <Card title="Ерөнхий мэдээлэл">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
              {name?.charAt(0) ?? '?'}
            </div>
            <div>
              <div className="text-sm text-slate-500">{badge}</div>
              <div className="text-lg font-semibold text-slate-900">{name}</div>
            </div>
          </div>
          {meta && <div className="text-sm text-slate-500">{meta}</div>}
        </div>

        {stats.map((stat, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">{stat.label}</div>
                <div className="text-3xl font-semibold text-slate-900">{stat.value}</div>
              </div>
              {stat.icon && (
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <stat.icon size={20} className="text-indigo-600" />
                </div>
              )}
            </div>
            {stat.progress !== undefined && (
              <>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${stat.progress}%` }}
                  />
                </div>
                {stat.hint && <div className="text-sm text-slate-500">{stat.hint}</div>}
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DashboardMessageCard({ title, messages = [] }) {
  return (
    <Card title={title}>
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div key={index} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">{message.subject}</div>
            <div className="mt-1 text-xs text-slate-500">{message.sender}</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{message.body}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
