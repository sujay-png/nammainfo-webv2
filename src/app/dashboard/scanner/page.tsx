"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Camera, Nfc, X, Loader2 } from "lucide-react";

export default function ScannerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Check NFC support
    if ("NDEFReader" in window) {
      setNfcSupported(true);
    }
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startScanner() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        setError(null);

        // Use BarcodeDetector if available
        if ("BarcodeDetector" in window) {
          // @ts-expect-error BarcodeDetector is not yet in TS lib
          const detector = new BarcodeDetector({ formats: ["qr_code"] });
          scanIntervalRef.current = setInterval(async () => {
            if (!videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const url = barcodes[0].rawValue;
                handleScannedUrl(url);
              }
            } catch {
              // scan frame failed — continue
            }
          }, 300);
        } else {
          setError(
            "QR scanning requires a modern browser. Try Chrome on Android or Safari on iOS."
          );
        }
      }
    } catch {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }

  function stopScanner() {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }

  async function startNfc() {
    try {
      // @ts-expect-error NDEFReader is not yet in TS lib
      const ndef = new NDEFReader();
      await ndef.scan();
      setNfcReading(true);

      ndef.addEventListener("reading", (event: { message: { records: Array<{ recordType: string; data: ArrayBuffer }> } }) => {
        for (const record of event.message.records) {
          if (record.recordType === "url") {
            const decoder = new TextDecoder();
            const url = decoder.decode(record.data);
            handleScannedUrl(url);
          }
        }
      });
    } catch {
      setError("NFC reading failed. Make sure NFC is enabled on your device.");
    }
  }

  function handleScannedUrl(url: string) {
    stopScanner();
    setNfcReading(false);

    // Extract slug from URL
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.replace(/^\//, "");
      if (path) {
        router.push(`/${path}`);
        return;
      }
    } catch {
      // Not a URL — might be a slug directly
      if (url && !url.includes(" ")) {
        router.push(`/${url}`);
        return;
      }
    }
    setError("Could not recognize the scanned code.");
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-5">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">
        Scan Card
      </h1>

      {!scanning ? (
        <div className="flex w-full flex-col items-center gap-4">
          {/* QR Scanner */}
          <button
            onClick={startScanner}
            className="flex w-full items-center gap-4 rounded-2xl border border-ink-200 bg-white p-5 text-left transition hover:shadow-card"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-950 text-white">
              <Camera size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold">Scan QR Code</p>
              <p className="text-xs text-ink-400">
                Use your camera to scan a business card QR
              </p>
            </div>
          </button>

          {/* NFC Reader */}
          {nfcSupported && (
            <button
              onClick={startNfc}
              className="flex w-full items-center gap-4 rounded-2xl border border-ink-200 bg-white p-5 text-left transition hover:shadow-card"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-950 text-white">
                <Nfc size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold">Tap NFC Card</p>
                <p className="text-xs text-ink-400">
                  Hold a Namma Info card to the back of your phone
                </p>
              </div>
            </button>
          )}

          {nfcReading && (
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <Loader2 size={14} className="animate-spin" />
              Waiting for NFC card…
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full overflow-hidden rounded-3xl bg-ink-950">
          <video
            ref={videoRef}
            className="aspect-square w-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Viewfinder overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-48 w-48 rounded-3xl border-2 border-white/30" />
          </div>

          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <button
              onClick={stopScanner}
              className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-medium text-ink-950 backdrop-blur-sm"
            >
              <X size={14} />
              Stop scanning
            </button>
          </div>

          <div className="absolute left-0 right-0 top-4 text-center">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-ink-950 backdrop-blur-sm">
              Point at a QR code
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">
          {error}
        </p>
      )}

      {/* Manual entry */}
      <div className="mt-8 w-full">
        <p className="mb-2 text-xs font-medium text-ink-400">
          Or enter a card link manually
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.target as HTMLFormElement).elements.namedItem(
              "url"
            ) as HTMLInputElement;
            if (input.value) handleScannedUrl(input.value);
          }}
          className="flex gap-2"
        >
          <input
            name="url"
            placeholder="nammainfo.in/username"
            className="flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-ink-950 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-ink-800"
          >
            Go
          </button>
        </form>
      </div>
    </div>
  );
}
