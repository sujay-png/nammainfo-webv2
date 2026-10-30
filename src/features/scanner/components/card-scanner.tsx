"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Nfc,
  X,
  Loader2,
  Zap,
  ZapOff,
  SwitchCamera,
  Upload,
  ArrowRight,
} from "lucide-react";
import { Html5Qrcode, type CameraDevice } from "html5-qrcode";

export default function ScannerPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check NFC support (Web NFC standard for Android)
    if (typeof window !== "undefined" && "NDEFReader" in window) {
      setNfcSupported(true);
    }

    return () => {
      // Ensure camera stops cleanly when navigating away
      stopScanner().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopScannerInternal() {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
        qrScannerRef.current.clear();
      } catch (err) {
        console.warn("Scanner stop cleanup:", err);
      }
      qrScannerRef.current = null;
    }
  }

  async function startScanner(cameraDeviceId?: string) {
    setError(null);
    setStarting(true);
    setScanning(true);

    // Give React time to render #qr-reader in the DOM
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Check secure context (camera requires HTTPS or localhost)
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setStarting(false);
      setScanning(false);
      setError("Camera scanner requires a secure connection (HTTPS or localhost).");
      return;
    }

    try {
      // Stop previous instance if running
      await stopScannerInternal();

      const qrElement = document.getElementById("qr-reader");
      if (!qrElement) {
        throw new Error("Scanner element not found in DOM");
      }

      // Create new Html5Qrcode instance attached to #qr-reader div
      const scanner = new Html5Qrcode("qr-reader");
      qrScannerRef.current = scanner;

      // Detect available video input devices
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
        }
      } catch {
        // Can fail if permission not granted yet - non-fatal
      }

      // Camera config: back camera preference on mobile, with fallback to any available camera
      const cameraConfig = cameraDeviceId
        ? { deviceId: { exact: cameraDeviceId } }
        : { facingMode: "environment" };

      try {
        await scanner.start(
          cameraConfig,
          {
            fps: 15,
          },
          (decodedText) => {
            handleScannedUrl(decodedText);
          },
          () => {}
        );
      } catch (primaryErr) {
        console.warn("Primary camera start failed, trying fallback camera:", primaryErr);
        // Fallback: try user facing camera or first available camera device
        try {
          await scanner.start(
            { facingMode: "user" },
            {
              fps: 15,
            },
            (decodedText) => {
              handleScannedUrl(decodedText);
            },
            () => {}
          );
        } catch (secondaryErr) {
          const availableDevices = await Html5Qrcode.getCameras().catch(() => []);
          if (availableDevices && availableDevices.length > 0) {
            await scanner.start(
              availableDevices[0].id,
              {
                fps: 15,
              },
              (decodedText) => {
                handleScannedUrl(decodedText);
              },
              () => {}
            );
          } else {
            throw secondaryErr;
          }
        }
      }

      setScanning(true);
      setStarting(false);

      // Check if camera supports torch (flashlight)
      try {
        const capabilities = (scanner as unknown as {
          getRunningTrackCameraCapabilities?: () => {
            torchFeature?: () => { isSupported: () => boolean };
          };
        }).getRunningTrackCameraCapabilities?.();
        if (capabilities?.torchFeature?.().isSupported()) {
          setTorchAvailable(true);
        }
      } catch {
        setTorchAvailable(false);
      }
    } catch (err: unknown) {
      await stopScannerInternal();
      setStarting(false);
      setScanning(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes("permission") ||
        msg.toLowerCase().includes("notallowed")
      ) {
        setError(
          "Camera access was denied. Please allow camera permissions in your browser or phone settings."
        );
      } else if (
        msg.toLowerCase().includes("notfound") ||
        msg.toLowerCase().includes("devices not found")
      ) {
        setError(
          "No camera detected on this device. You can scan by uploading a QR screenshot below."
        );
      } else {
        setError(
          "Unable to start camera scanner. Please ensure camera permissions are granted, or upload a QR screenshot below."
        );
      }
    }
  }

  async function stopScanner() {
    await stopScannerInternal();
    setScanning(false);
    setStarting(false);
    setTorchOn(false);
    setTorchAvailable(false);
  }

  async function toggleTorch() {
    if (!qrScannerRef.current || !torchAvailable) return;
    try {
      const nextState = !torchOn;
      await (qrScannerRef.current as unknown as {
        applyVideoConstraints: (constraints: {
          advanced: Array<{ torch?: boolean }>;
        }) => Promise<void>;
      }).applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      setTorchAvailable(false);
    }
  }

  async function switchCamera() {
    if (cameras.length <= 1) return;
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    const nextCamera = cameras[nextIndex];
    if (nextCamera) {
      await startScanner(nextCamera.id);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setStarting(true);

    try {
      // Use temporary scanner to parse image file
      const tempScanner = new Html5Qrcode("qr-file-helper");
      const decoded = await tempScanner.scanFile(file, false);
      tempScanner.clear();
      setStarting(false);
      handleScannedUrl(decoded);
    } catch {
      setStarting(false);
      setError("No valid QR code could be found in that image. Please try another.");
    }
  }

  async function startNfc() {
    setError(null);
    try {
      // @ts-expect-error NDEFReader is standard Web NFC on Android Chrome
      const ndef = new NDEFReader();
      await ndef.scan();
      setNfcReading(true);

      ndef.addEventListener(
        "reading",
        (event: {
          message: {
            records: Array<{ recordType: string; data: ArrayBuffer }>;
          };
        }) => {
          for (const record of event.message.records) {
            if (record.recordType === "url") {
              const decoder = new TextDecoder();
              const url = decoder.decode(record.data);
              handleScannedUrl(url);
            }
          }
        }
      );
    } catch {
      setError(
        "NFC reading failed. Please ensure NFC is enabled in your phone settings and try again."
      );
    }
  }

  function handleScannedUrl(url: string) {
    stopScanner().catch(() => {});
    setNfcReading(false);

    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(80);
      }
    } catch {}

    const clean = url.trim();

    try {
      // If it's a full URL e.g. https://nammainfo.in/username or /c/card_123
      const parsed = new URL(clean);
      const path = parsed.pathname.replace(/^\//, "");
      if (path) {
        router.push(`/${path}`);
        return;
      }
    } catch {
      // Not a full URL — may be a slug directly like 'sujay' or 'c/card_123'
      if (clean && !clean.includes(" ")) {
        router.push(`/${clean}`);
        return;
      }
    }

    setError("Could not recognize the scanned code as a valid Namma Info card link.");
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-6">
      {/* Hidden file element for scanning QR from photo library */}
      <div id="qr-file-helper" className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="w-full mb-5">
        <h1 className="font-headline text-xl font-bold tracking-tight text-[var(--foreground)]">
          Scan Card
        </h1>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          Point your camera at a Namma Info QR or tap an NFC card
        </p>
      </div>

      {/* Active Live Camera Viewfinder (Kept in DOM so Html5Qrcode attaches reliably) */}
      <div
        className={`relative w-full overflow-hidden rounded-[5px] border border-[var(--border)] bg-black shadow-xl mb-4 ${
          scanning ? "block" : "hidden"
        }`}
      >
        {/* Html5Qrcode video attaches into this container */}
        <div
          id="qr-reader"
          className="w-full aspect-square overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_#qr-shaded-region]:!hidden"
        />

        {/* Top Controls Bar */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-black/75 backdrop-blur-md text-[11px] font-mono font-medium text-white border border-white/15">
            Scanning for QR…
          </span>

          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="h-9 w-9 flex items-center justify-center rounded-[5px] bg-black/60 text-white backdrop-blur-md border border-white/15 hover:bg-black/80 transition-all cursor-pointer"
                title="Switch camera"
              >
                <SwitchCamera size={16} />
              </button>
            )}

            {torchAvailable && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`h-9 w-9 flex items-center justify-center rounded-[5px] backdrop-blur-md border transition-all cursor-pointer ${
                  torchOn
                    ? "bg-amber-400 text-black border-amber-300"
                    : "bg-black/60 text-white border-white/15 hover:bg-black/80"
                }`}
                title="Toggle flashlight"
              >
                {torchOn ? <Zap size={16} /> : <ZapOff size={16} />}
              </button>
            )}

            <button
              type="button"
              onClick={stopScanner}
              className="h-9 w-9 flex items-center justify-center rounded-[5px] bg-black/60 text-white backdrop-blur-md border border-white/15 hover:bg-red-500/80 transition-all cursor-pointer"
              title="Close camera"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Bottom helper text */}
        <div className="absolute bottom-3 inset-x-3 flex justify-center z-20">
          <button
            type="button"
            onClick={stopScanner}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[5px] bg-black/75 backdrop-blur-md text-xs font-semibold text-white border border-white/15 hover:bg-black transition-all cursor-pointer"
          >
            <X size={14} />
            Stop Scanning
          </button>
        </div>
      </div>

      {/* Main Options Menu (visible when not scanning) */}
      <div className={`flex w-full flex-col gap-3 ${scanning ? "hidden" : "flex"}`}>
        {/* Camera Scanner Trigger */}
        <button
          onClick={() => startScanner()}
          disabled={starting}
          className="flex w-full items-center gap-4 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 text-left shadow-sm transition hover:border-[var(--primary)]/60 hover:bg-[var(--accent)] active:scale-[0.99] cursor-pointer"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[5px] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm">
            {starting ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <Camera size={22} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {starting ? "Starting camera…" : "Open Camera Scanner"}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Scan instantly with live camera preview & auto-detect
            </p>
          </div>
          <ArrowRight size={16} className="text-[var(--muted-foreground)] shrink-0" />
        </button>

        {/* Upload Image from Photos Trigger */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={starting}
          className="flex w-full items-center gap-4 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 text-left shadow-sm transition hover:border-[var(--primary)]/60 hover:bg-[var(--accent)] active:scale-[0.99] cursor-pointer"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] border border-[var(--border)] text-[var(--foreground)]">
            <Upload size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Scan from Photo / Gallery
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Upload a screenshot or photo containing a QR code
            </p>
          </div>
          <ArrowRight size={16} className="text-[var(--muted-foreground)] shrink-0" />
        </button>

        {/* NFC Reader Trigger */}
        {nfcSupported && (
          <button
            onClick={startNfc}
            disabled={nfcReading}
            className="flex w-full items-center gap-4 rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 text-left shadow-sm transition hover:border-[var(--primary)]/60 hover:bg-[var(--accent)] active:scale-[0.99] cursor-pointer"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent)] border border-[var(--border)] text-[var(--foreground)]">
              <Nfc size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Tap Physical NFC Card
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Hold a physical Namma Info card to the back of your phone
              </p>
            </div>
            <ArrowRight size={16} className="text-[var(--muted-foreground)] shrink-0" />
          </button>
        )}

        {nfcReading && (
          <div className="flex items-center justify-center gap-2 rounded-[5px] border border-blue-500/20 bg-blue-500/10 p-3.5 text-xs font-medium text-blue-600 dark:text-blue-400">
            <Loader2 size={16} className="animate-spin" />
            Waiting for NFC card tap on back of device…
          </div>
        )}
      </div>

      {/* Error notification */}
      {error && (
        <div className="mt-4 w-full rounded-[5px] border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-400 leading-relaxed">
          {error}
        </div>
      )}

      {/* Manual link input */}
      <div className="mt-6 w-full rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
        <label
          htmlFor="manual-link"
          className="block mb-2 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]"
        >
          Or enter card link / username manually
        </label>
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
            id="manual-link"
            name="url"
            placeholder="nammainfo.in/username or card_id"
            className="flex-1 rounded-[5px] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] transition-colors"
          />
          <button
            type="submit"
            className="rounded-[5px] bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] transition hover:opacity-90 active:scale-[0.98] cursor-pointer"
          >
            Open
          </button>
        </form>
      </div>
    </div>
  );
}
