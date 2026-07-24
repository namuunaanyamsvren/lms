export default function FeatureCard({ icon, title, description }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:border-indigo-100">
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 shadow-sm">
        <span className="text-xl">{icon}</span>
      </div>
      <h3 className="mt-6 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}
