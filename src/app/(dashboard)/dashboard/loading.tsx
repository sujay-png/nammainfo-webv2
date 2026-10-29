export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-lg px-5 py-6 space-y-4 animate-fade-in">
      <div className="h-8 w-44 skeleton rounded-[5px]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 skeleton rounded-[5px]" />
        <div className="h-24 skeleton rounded-[5px]" />
      </div>
      <div className="h-36 skeleton rounded-[5px]" />
      <div className="space-y-2 pt-2">
        <div className="h-16 skeleton rounded-[5px]" />
        <div className="h-16 skeleton rounded-[5px]" />
      </div>
    </div>
  );
}
