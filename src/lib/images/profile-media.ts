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
