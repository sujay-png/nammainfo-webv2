export default function SavedLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-4 animate-fade-in">
      <div className="h-7 w-32 skeleton rounded-[5px]" />
      <div className="h-11 w-full skeleton rounded-2xl" />
      <div className="space-y-2.5 pt-2">
        <div className="h-20 skeleton rounded-[5px]" />
        <div className="h-20 skeleton rounded-[5px]" />
        <div className="h-20 skeleton rounded-[5px]" />
      </div>
    </div>
  );
}
