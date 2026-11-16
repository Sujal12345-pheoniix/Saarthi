export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-14" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton mt-4 h-10 w-80 max-w-full" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-36 rounded-3xl" />
        ))}
      </div>
      <div className="skeleton mt-6 h-80 rounded-3xl" />
    </div>
  );
}
