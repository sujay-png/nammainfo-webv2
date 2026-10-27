"use client";

import { Camera, Loader2 } from "lucide-react";
import type { EmployeeRecord } from "@/hooks/use-account";
import Avatar from "@/components/ui/avatar";

/** The employee's card as others see it. Optional "Change" buttons for photos. */
export default function EmployeeCardPreview({
  employee,
  onPickPhoto,
  uploading,
}: {
  employee: EmployeeRecord;
  onPickPhoto?: (field: "avatar_url" | "cover_url", file: File) => void;
  uploading?: "avatar_url" | "cover_url" | null;
}) {
  const fileInput = (field: "avatar_url" | "cover_url") => (
    <input
      type="file"
      accept="image/*"
      className="hidden"
      disabled={!!uploading}
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f && onPickPhoto) onPickPhoto(field, f);
        e.target.value = "";
      }}
    />
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="relative h-24 bg-[var(--muted)]">
        {employee.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={employee.cover_url} alt="" className="h-full w-full object-cover" />
        )}
        {onPickPhoto && (
          <label className="absolute right-2.5 top-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-[#fff] backdrop-blur-sm transition hover:bg-black/70">
            {uploading === "cover_url" ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            Change cover
            {fileInput("cover_url")}
          </label>
        )}
      </div>
      <div className="flex items-end gap-3 px-4 pb-4">
        <div className="relative -mt-7 shrink-0 rounded-[22%] border-[3px] border-[var(--card)] bg-[var(--card)]">
          <Avatar name={employee.name} src={employee.avatar_url} size={64} shape="rounded" />
          {onPickPhoto && (
            <label
              aria-label="Change photo"
              className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--card)] bg-[var(--foreground)] text-[var(--background)] transition hover:opacity-90"
            >
              {uploading === "avatar_url" ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
              {fileInput("avatar_url")}
            </label>
          )}
        </div>
        <div className="min-w-0 pb-0.5">
          <p className="truncate text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{employee.name}</p>
          <p className="truncate text-[13px] text-[var(--muted-foreground)]">
            {[employee.designation, employee.owner_business_name].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}
