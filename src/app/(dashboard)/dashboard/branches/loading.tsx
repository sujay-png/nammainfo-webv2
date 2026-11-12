export default function BranchesLoading() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-5 animate-fade-in">
      <div className="h-7 w-36 skeleton rounded-[5px]" />
      <div className="h-28 skeleton rounded-[5px]" />
      <div className="h-28 skeleton rounded-[5px]" />
    </div>
  );
}
