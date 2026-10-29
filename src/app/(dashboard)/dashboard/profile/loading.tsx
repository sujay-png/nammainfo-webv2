export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-lg pb-8 animate-fade-in">
      {/* Cover photo skeleton */}
      <div className="relative h-44 w-full skeleton" />

      {/* Avatar overlapping cover */}
      <div className="relative px-5">
        <div className="absolute -top-12 left-5 h-24 w-24 skeleton rounded-2xl border-4 border-[var(--background)]" />
        <div className="pt-14 space-y-2">
          <div className="h-6 w-48 skeleton rounded-[5px]" />
          <div className="h-4 w-32 skeleton rounded-[5px]" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-5 mt-5 flex gap-2">
        <div className="h-11 flex-1 skeleton rounded-2xl" />
        <div className="h-11 flex-1 skeleton rounded-2xl" />
      </div>

      {/* Section accordions */}
      <div className="px-5 mt-6 space-y-3">
        <div className="h-20 skeleton rounded-[5px]" />
        <div className="h-20 skeleton rounded-[5px]" />
        <div className="h-20 skeleton rounded-[5px]" />
      </div>
    </div>
  );
}
