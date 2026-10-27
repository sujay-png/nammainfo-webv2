"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Canvas helper – crops the image client-side and returns a Blob     */
/* ------------------------------------------------------------------ */

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function getCroppedBlob(
  imageSrc: string,
  crop: Area,
  outputSize?: { width: number; height: number }
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const outW = outputSize?.width ?? crop.width;
  const outH = outputSize?.height ?? crop.height;
  canvas.width = outW;
  canvas.height = outH;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outW,
    outH
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas empty"))),
      "image/jpeg",
      0.92
    );
  });
}

/* ------------------------------------------------------------------ */
/*  CropModal                                                          */
/* ------------------------------------------------------------------ */

interface CropModalProps {
  /** Object URL or data URL of the image to crop */
  imageSrc: string;
  /** 16/9 for cover, 1 for logo */
  aspect: number;
  /** Label shown at the top */
  title?: string;
  /** Output pixel size (optional – uses crop area if omitted) */
  outputSize?: { width: number; height: number };
  onCancel: () => void;
  /** Called with the cropped Blob when user confirms */
  onConfirm: (blob: Blob) => void;
}

export default function CropModal({
  imageSrc,
  aspect,
  title = "Crop Image",
  outputSize,
  onCancel,
  onConfirm,
}: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback(
    (_croppedAreaPct: Area, croppedAreaPx: Area) => {
      setCroppedArea(croppedAreaPx);
    },
    []
  );

  async function handleConfirm() {
    if (!croppedArea) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea, outputSize);
      onConfirm(blob);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[var(--card)] shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="font-headline text-base font-semibold">{title}</h3>
          <button
            onClick={onCancel}
            className="rounded-full p-1.5 hover:bg-[var(--muted)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cropper area */}
        <div className="relative h-72 w-full bg-black sm:h-80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            cropShape={aspect === 1 ? "round" : "rect"}
            showGrid={aspect !== 1}
          />
        </div>

        {/* Zoom control */}
        <div className="flex items-center gap-3 px-5 py-3">
          <ZoomOut size={16} className="text-[var(--muted-foreground)]" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--muted)] accent-[var(--accent)]
              [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)]"
          />
          <ZoomIn size={16} className="text-[var(--muted-foreground)]" />
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-[var(--border)] px-4 py-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium transition hover:bg-[var(--muted)]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Check size={16} />
            )}
            {saving ? "Cropping…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
