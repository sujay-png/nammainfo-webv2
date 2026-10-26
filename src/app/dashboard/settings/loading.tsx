export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-4 animate-fade-in">
      <div className="h-7 w-28 skeleton rounded-[5px]" />

      {/* Profile Card Skeleton */}
      <div className="flex items-center gap-3 p-4 border border-[var(--border)] rounded-[5px] bg-[var(--card)]">
        <div className="h-12 w-12 rounded-full skeleton shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 skeleton rounded-[5px]" />
          <div className="h-3 w-48 skeleton rounded-[5px]" />
        </div>
      </div>

      {/* Settings list items */}
      <div className="space-y-2 pt-2">
        <div className="h-14 skeleton rounded-[5px]" />
        <div className="h-14 skeleton rounded-[5px]" />
        <div className="h-14 skeleton rounded-[5px]" />
        <div className="h-14 skeleton rounded-[5px]" />
      </div>
    </div>
  );
}
