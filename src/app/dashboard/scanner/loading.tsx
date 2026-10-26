export default function ScannerLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-4 animate-fade-in">
      <div className="h-7 w-28 skeleton rounded-[5px]" />
      <div className="h-64 w-full skeleton rounded-2xl" />
      <div className="h-12 w-full skeleton rounded-2xl" />
    </div>
  );
}
