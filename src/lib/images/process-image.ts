/**
 * Shrinks a photo in the browser before it is uploaded to Supabase Storage,
 * so we store a few dozen KB instead of a 3-5 MB camera photo.
 *
 *  - "square":  centre-cropped square, e.g. a testimonial author's photo
 *  - "contain": whole image kept, fitted inside a box, e.g. a client logo
 *               (transparent PNG/WebP logos keep their transparency)
 *
 * Output is WebP (JPEG on old browsers that can't make WebP). Quality steps
 * down only as far as needed to get under the target size. Camera rotation
 * is respected.
 */

export interface ProcessOptions {
  mode: "square" | "contain";
  /** square: side in px. contain: max width in px. */
  width: number;
  /** contain only: max height in px. */
  height?: number;
  /** Aim for files under this many bytes. */
  targetBytes: number;
}

export interface ProcessedImage {
  blob: Blob;
  ext: "webp" | "jpg";
  contentType: "image/webp" | "image/jpeg";
}

export const AVATAR_IMAGE: ProcessOptions = { mode: "square", width: 320, targetBytes: 45 * 1024 };
export const LOGO_IMAGE: ProcessOptions = { mode: "contain", width: 480, height: 240, targetBytes: 60 * 1024 };
/** Square brand photo / logo for a branch (already cropped square). */
export const SQUARE_PHOTO_IMAGE: ProcessOptions = { mode: "square", width: 400, targetBytes: 60 * 1024 };
/** 16:9 cover photo (already cropped), max 1600 × 900. */
export const COVER_IMAGE: ProcessOptions = { mode: "contain", width: 1600, height: 900, targetBytes: 220 * 1024 };
/** Service / product photo, max 1000 × 1000, aspect kept. */
export const ITEM_IMAGE: ProcessOptions = { mode: "contain", width: 1000, height: 1000, targetBytes: 120 * 1024 };

const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export class ImageProcessError extends Error {}

async function load(file: File) {
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { source: bmp as CanvasImageSource, width: bmp.width, height: bmp.height, done: () => bmp.close() };
    } catch {
      /* fall back to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageProcessError("This photo type isn't supported. Please choose a JPG, PNG or WebP image.");
  }
  return { source: img as CanvasImageSource, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function processImage(file: File, opts: ProcessOptions): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name)) {
    throw new ImageProcessError("Please choose an image file.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageProcessError("That photo is too large (over 15 MB). Please choose a smaller one.");
  }

  const img = await load(file);
  try {
    if (!img.width || !img.height) throw new ImageProcessError("Couldn't read that image. Please try another.");

    // Source rectangle and output size.
    let sx = 0, sy = 0, sw = img.width, sh = img.height, ow: number, oh: number;
    if (opts.mode === "square") {
      const side = Math.min(img.width, img.height);
      sx = (img.width - side) / 2;
      sy = (img.height - side) / 2;
      sw = sh = side;
      ow = oh = Math.min(opts.width, side);
    } else {
      const scale = Math.min(1, opts.width / img.width, (opts.height ?? opts.width) / img.height);
      ow = Math.max(1, Math.round(img.width * scale));
      oh = Math.max(1, Math.round(img.height * scale));
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = ow;
      canvas.height = oh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ImageProcessError("Your browser couldn't process this photo.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img.source, sx, sy, sw, sh, 0, 0, ow, oh);

      let quality = 0.82;
      let blob = await toBlob(canvas, "image/webp", quality);
      let webp = !!blob && blob.type === "image/webp";
      if (!webp) {
        // JPEG has no transparency: put logos on white instead of black.
        const flat = document.createElement("canvas");
        flat.width = ow;
        flat.height = oh;
        const fctx = flat.getContext("2d")!;
        fctx.fillStyle = "#ffffff";
        fctx.fillRect(0, 0, ow, oh);
        fctx.drawImage(canvas, 0, 0);
        canvas.width = 0;
        blob = await toBlob(flat, "image/jpeg", quality);
        webp = false;
        while (blob && blob.size > opts.targetBytes && quality > 0.5) {
          quality -= 0.08;
          blob = await toBlob(flat, "image/jpeg", quality);
        }
      } else {
        while (blob && blob.size > opts.targetBytes && quality > 0.5) {
          quality -= 0.08;
          blob = await toBlob(canvas, "image/webp", quality);
        }
      }
      if (blob && blob.size <= opts.targetBytes * 2) {
        return webp
          ? { blob, ext: "webp", contentType: "image/webp" }
          : { blob, ext: "jpg", contentType: "image/jpeg" };
      }
      ow = Math.round(ow * 0.8);
      oh = Math.round(oh * 0.8);
    }
    throw new ImageProcessError("Couldn't make that photo small enough. Please try another.");
  } finally {
    img.done();
  }
}
