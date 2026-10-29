export default function HomeLoading() {
  return (
    <div className="mx-auto max-w-lg px-5 py-6 space-y-5 animate-fade-in">
      {/* Header greeting */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-6 w-36 skeleton rounded-[5px]" />
          <div className="h-4 w-48 skeleton rounded-[5px]" />
        </div>
        <div className="h-9 w-9 skeleton rounded-full" />
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 skeleton rounded-[5px]" />
        <div className="h-24 skeleton rounded-[5px]" />
        <div className="h-24 skeleton rounded-[5px]" />
        <div className="h-24 skeleton rounded-[5px]" />
      </div>

      {/* Membership Plan Card */}
      <div className="h-40 skeleton rounded-[5px]" />

      {/* Quick Action / Review Section */}
      <div className="h-28 skeleton rounded-[5px]" />
    </div>
  );
}
