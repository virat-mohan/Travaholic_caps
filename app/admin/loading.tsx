export default function AdminLoading() {
  return (
    <div className="px-4 py-10 md:px-10" role="status" aria-live="polite">
      <div className="space-y-4">
        <div className="admin-skeleton h-8 w-48 rounded-lg" />
        <div className="admin-skeleton h-28 rounded-2xl" />
        <div className="admin-skeleton h-28 rounded-2xl" />
      </div>
      <p className="mt-6 text-body-s text-secondary-text">Loading — one moment…</p>
    </div>
  );
}
