export default function OrdersLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-4 animate-fade-in">
      <div className="h-7 w-40 skeleton rounded-[5px]" />
      <div className="space-y-3 pt-2">
        <div className="h-28 skeleton rounded-[5px]" />
        <div className="h-28 skeleton rounded-[5px]" />
        <div className="h-28 skeleton rounded-[5px]" />
      </div>
    </div>
  );
}
