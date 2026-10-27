"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Lock } from "lucide-react";
import { createClient } from "@/supabase/client";
import { useAccount } from "@/hooks/use-account";
import EmployeeCardPreview from "@/features/employee-dashboard/components/employee-card-preview";
import { ui } from "@/components/ui/sheet";

const CropModal = dynamic(() => import("@/components/ui/image-crop-modal"), { ssr: false });

/**
 * Employee "Profile": their card, read-only, except the photos. Name,
 * designation, phone etc. are managed by the owner on the Team page.
 */
export default function EmployeeProfile() {
  const { employee, userId, refresh } = useAccount();
  const [crop, setCrop] = useState<{ src: string; field: "avatar_url" | "cover_url" } | null>(null);
  const [uploading, setUploading] = useState<"avatar_url" | "cover_url" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!employee || !userId) return null;

  function pick(field: "avatar_url" | "cover_url", file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }
    setError(null);
    setCrop({ src: URL.createObjectURL(file), field });
  }

  async function upload(blob: Blob) {
    if (!crop || !employee || !userId) return;
    const { field } = crop;
    URL.revokeObjectURL(crop.src);
    setCrop(null);
    setUploading(field);
    const supabase = createClient();
    // Own folder in the avatars bucket (storage rules allow a user's own folder).
    const path = `${userId}/emp-${employee.id}-${field}-${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      setUploading(null);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: rpcErr } = await supabase.rpc("update_my_employee_photo", { p_field: field, p_url: publicUrl } as never);
    if (rpcErr) setError("Could not save the photo. Please try again.");
    await refresh();
    setUploading(null);
  }

  const rows: [string, string | null][] = [
    ["Name", employee.name],
    ["Designation", employee.designation],
    ["Phone", employee.phone],
    ["Email", employee.email],
    ["Company", employee.owner_business_name],
  ];

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pb-8 pt-5">
      <div className="px-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">My card</h1>
        <p className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">You can change your photo and cover.</p>
      </div>

      <EmployeeCardPreview employee={employee} onPickPhoto={pick} uploading={uploading} />
      {error && <p className={ui.error}>{error}</p>}

      <section>
        <h2 className="mb-2 px-1 text-[13px] font-medium text-[var(--muted-foreground)]">Details</h2>
        <dl className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-[var(--muted-foreground)]">{label}</dt>
              <dd className={`truncate text-right ${value ? "" : "text-[var(--muted-foreground)]"}`}>{value || "Not added"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 flex items-start gap-1.5 px-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
          <Lock size={12} className="mt-0.5 shrink-0" />
          Managed by {employee.owner_business_name ?? "your company"}. Ask your manager to update these.
        </p>
      </section>

      {crop && (
        <CropModal
          imageSrc={crop.src}
          aspect={crop.field === "cover_url" ? 16 / 9 : 1}
          title={crop.field === "cover_url" ? "Crop cover photo" : "Crop your photo"}
          outputSize={crop.field === "cover_url" ? { width: 1200, height: 675 } : { width: 400, height: 400 }}
          onCancel={() => {
            URL.revokeObjectURL(crop.src);
            setCrop(null);
          }}
          onConfirm={upload}
        />
      )}
    </div>
  );
}
