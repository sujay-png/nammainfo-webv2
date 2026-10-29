export default function TeamLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-4 animate-fade-in">
      <div className="h-7 w-36 skeleton rounded-[5px]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 skeleton rounded-[5px]" />
        <div className="h-20 skeleton rounded-[5px]" />
      </div>
      <div className="space-y-2.5 pt-2">
        <div className="h-16 skeleton rounded-[5px]" />
        <div className="h-16 skeleton rounded-[5px]" />
        <div className="h-16 skeleton rounded-[5px]" />
      </div>
    </div>
  );
}
