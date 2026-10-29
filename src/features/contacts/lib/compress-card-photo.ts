/**
 * Shrinks a phone camera photo of a business card (usually 3-5 MB) to
 * roughly 80-180 KB while keeping the text sharp:
 *  - longest side 1400 px (plenty for reading card text)
 *  - WebP (or JPEG on browsers that can't make WebP), quality stepped down
 *    only as far as needed to get under ~180 KB
 *  - photo rotation from the camera is respected
 */
const MAX_SIDE = 1400;
const TARGET_BYTES = 180 * 1024;
const HARD_LIMIT = 480 * 1024; // the storage bucket rejects anything over 500 KB

export interface CompressedPhoto {
  blob: Blob;
  format: "webp" | "jpeg";
}

async function loadImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() };
    } catch {
      /* fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressCardPhoto(file: File): Promise<CompressedPhoto> {
  const img = await loadImage(file);
  let scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not available");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);

      let format: "webp" | "jpeg" = "webp";
      let quality = 0.8;
      let blob = await toBlob(canvas, "image/webp", quality);
      if (!blob || blob.type !== "image/webp") {
        format = "jpeg"; // e.g. older Safari can't encode WebP
        blob = await toBlob(canvas, "image/jpeg", quality);
      }
      while (blob && blob.size > TARGET_BYTES && quality > 0.56) {
        quality -= 0.08;
        blob = await toBlob(canvas, format === "webp" ? "image/webp" : "image/jpeg", quality);
      }
      if (blob && blob.size <= HARD_LIMIT) return { blob, format };
      scale *= 0.8; // still too big (very busy photo): make it a bit smaller
    }
    throw new Error("Photo is too large");
  } finally {
    img.done();
  }
}
