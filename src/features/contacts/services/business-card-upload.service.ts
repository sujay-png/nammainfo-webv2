import { createClient } from "@/supabase/client";

/**
 * Business card photo uploads from the visitor popup.
 * 1. Ask our server for two one-time upload links (front + back).
 * 2. Upload the compressed photos straight to Supabase Storage.
 */
const BUCKET = "business-cards";

export interface CardUploadLinks {
  front: { path: string; token: string };
  back: { path: string; token: string };
}

export async function requestCardUploadLinks(
  ownerId: string,
  employeeId: string | null,
  format: "webp" | "jpeg"
): Promise<CardUploadLinks> {
  const res = await fetch("/api/contacts/card-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerId, employeeId, format }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Upload not available");
  return (await res.json()) as CardUploadLinks;
}

export async function uploadCardPhoto(link: { path: string; token: string }, blob: Blob) {
  const { error } = await createClient()
    .storage.from(BUCKET)
    .uploadToSignedUrl(link.path, link.token, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  return link.path;
}

/** Short-lived links so the owner/employee can view the photos. */
export async function getCardPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await createClient().storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  const out: Record<string, string> = {};
  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  });
  return out;
}

export async function deleteCardPhotos(paths: (string | null)[]) {
  const list = paths.filter(Boolean) as string[];
  if (list.length) await createClient().storage.from(BUCKET).remove(list);
}
