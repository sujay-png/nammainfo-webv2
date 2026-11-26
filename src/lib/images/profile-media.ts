import { createClient } from "@/supabase/client";
import { processImage, type ProcessOptions } from "./process-image";

/**
 * Processes an image in the browser, then uploads it to the public
 * "profile-media" bucket under the owner's folder: <profileId>/<folder>/...
 * Returns the public URL.
 */
export async function uploadProfileImage(
  profileId: string,
  folder: "testimonials" | "clients" | "branches",
  file: File,
  opts: ProcessOptions
): Promise<string> {
  const img = await processImage(file, opts);
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${profileId}/${folder}/${Date.now()}-${rand}.${img.ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("profile-media")
    .upload(path, img.blob, { contentType: img.contentType, cacheControl: "31536000", upsert: false });
  if (error) throw new Error("Upload failed. Please check your connection and try again.");
  return supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
}

/** Best-effort delete of a file we uploaded (ignored if it fails). */
export async function deleteProfileImage(publicUrl: string | null | undefined) {
  if (!publicUrl) return;
  const marker = "/storage/v1/object/public/profile-media/";
  const i = publicUrl.indexOf(marker);
  if (i < 0) return;
  const path = decodeURIComponent(publicUrl.slice(i + marker.length).split("?")[0]);
  try {
    await createClient().storage.from("profile-media").remove([path]);
  } catch {
    /* leave it; not worth bothering the user */
  }
}

const FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Uploads a document as-is (PDF or image, max 10 MB) to the public
 * "profile-media" bucket: <profileId>/<folder>/<ts>-<rand>.<ext>.
 * Used for custom buttons such as a menu or price list. Returns the
 * public URL.
 */
export async function uploadProfileFile(profileId: string, folder: "buttons", file: File): Promise<string> {
  const ext = FILE_TYPES[file.type];
  if (!ext) throw new Error("Please choose a PDF, JPG, PNG or WebP file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("The file must be under 10 MB.");
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${profileId}/${folder}/${Date.now()}-${rand}.${ext}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from("profile-media")
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error("Upload failed. Please check your connection and try again.");
  return supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
}
