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
  Check,
} from "lucide-react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type CameraDevice,
  type Html5QrcodeCameraScanConfig,
} from "html5-qrcode";

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
  const [zoomAvailable, setZoomAvailable] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [zoomMin, setZoomMin] = useState(1);
  const [zoomMax, setZoomMax] = useState(1);
  const [scannedDetected, setScannedDetected] = useState(false);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingScanRef = useRef(false);

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
    setScannedDetected(false);

    // Ensure DOM container has rendered and has non-zero client dimensions
    isProcessingScanRef.current = false;
    let retries = 0;
    while (retries < 20) {
      const el = document.getElementById("qr-reader");
      if (el && el.clientWidth > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
      retries++;
    }

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
      // Restrict exclusively to QR_CODE for fast detection, low CPU usage, and hardware acceleration
      const scanner = new Html5Qrcode("qr-reader", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
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

      // Config with targeted qrbox crop and high-res video feed for sharp small-QR detection
      const scanConfig: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.max(160, Math.min(Math.floor(minEdge * 0.60), 190));
          return { width: boxSize, height: boxSize };
        },
        videoConstraints: cameraDeviceId
          ? {
              deviceId: { exact: cameraDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            }
          : {
              facingMode: "environment",
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
      };

      try {
        await scanner.start(
          cameraConfig,
          scanConfig,
          (decodedText) => {
            handleScannedUrl(decodedText);
          },
          () => {}
        );
      } catch (primaryErr) {
        console.warn("High-res camera start failed, trying fallback scan config:", primaryErr);
        const fallbackConfig: Html5QrcodeCameraScanConfig = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.max(160, Math.min(Math.floor(minEdge * 0.60), 190));
            return { width: boxSize, height: boxSize };
          },
        };

        try {
          await scanner.start(
            cameraConfig,
            fallbackConfig,
            (decodedText) => {
              handleScannedUrl(decodedText);
            },
            () => {}
          );
        } catch (secondaryErr) {
          try {
            await scanner.start(
              { facingMode: "user" },
              fallbackConfig,
              (decodedText) => {
                handleScannedUrl(decodedText);
              },
              () => {}
            );
          } catch (tertiaryErr) {
            const availableDevices = await Html5Qrcode.getCameras().catch(() => []);
            if (availableDevices && availableDevices.length > 0) {
              await scanner.start(
                availableDevices[0].id,
                fallbackConfig,
                (decodedText) => {
                  handleScannedUrl(decodedText);
                },
                () => {}
              );
            } else {
              throw tertiaryErr;
            }
          }
        }
      }

      setScanning(true);
      setStarting(false);

      // Check if camera supports torch (flashlight) and hardware zoom
      try {
        const capabilities = (scanner as unknown as {
          getRunningTrackCameraCapabilities?: () => {
            torchFeature?: () => { isSupported: () => boolean };
            zoomFeature?: () => {
              isSupported: () => boolean;
              min: () => number;
              max: () => number;
              step: () => number;
              value: () => number | null;
            };
          };
        }).getRunningTrackCameraCapabilities?.();

        if (capabilities?.torchFeature?.().isSupported()) {
          setTorchAvailable(true);
        }

        const zoom = capabilities?.zoomFeature?.();
        if (zoom && zoom.isSupported()) {
          const maxZ = zoom.max();
          if (maxZ > 1) {
            setZoomAvailable(true);
            setZoomMin(zoom.min() || 1);
            setZoomMax(maxZ);
            setCurrentZoom(zoom.value() || 1);
          }
        }
      } catch {
        // Fallback check on MediaStreamTrack
        try {
          const videoEl = document.querySelector("#qr-reader video") as HTMLVideoElement | null;
          const stream = videoEl?.srcObject as MediaStream | null;
          const track = stream?.getVideoTracks()?.[0];
          if (track && typeof track.getCapabilities === "function") {
            const trackCaps = track.getCapabilities() as unknown as {
              torch?: boolean;
              zoom?: { min: number; max: number; step: number };
            };
            if (trackCaps?.torch) setTorchAvailable(true);
            if (trackCaps?.zoom && trackCaps.zoom.max > 1) {
              setZoomAvailable(true);
              setZoomMin(trackCaps.zoom.min || 1);
              setZoomMax(trackCaps.zoom.max);
              setCurrentZoom(1);
            }
          }
        } catch {}
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
    setZoomAvailable(false);
    setCurrentZoom(1);
    setScannedDetected(false);
  }

  async function handleSetZoom(val: number) {
    if (!qrScannerRef.current) return;
    try {
      const caps = (qrScannerRef.current as unknown as {
        getRunningTrackCameraCapabilities?: () => {
          zoomFeature?: () => {
            isSupported: () => boolean;
            apply: (v: number) => Promise<void>;
          };
        };
      }).getRunningTrackCameraCapabilities?.();

      const zoom = caps?.zoomFeature?.();
      if (zoom && zoom.isSupported()) {
        await zoom.apply(val);
        setCurrentZoom(val);
        return;
      }

      const videoEl = document.querySelector("#qr-reader video") as HTMLVideoElement | null;
      const stream = videoEl?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks()?.[0];
      if (track && typeof track.applyConstraints === "function") {
        // @ts-expect-error advanced constraint
        await track.applyConstraints({ advanced: [{ zoom: val }] });
        setCurrentZoom(val);
      }
    } catch (err) {
      console.warn("Failed to set camera zoom:", err);
    }
  }

  async function toggleTorch() {
    if (!qrScannerRef.current || !torchAvailable) return;
    try {
      const nextState = !torchOn;
      const caps = (qrScannerRef.current as unknown as {
        getRunningTrackCameraCapabilities?: () => {
          torchFeature?: () => {
            isSupported: () => boolean;
            apply: (v: boolean) => Promise<void>;
          };
        };
      }).getRunningTrackCameraCapabilities?.();

      const torch = caps?.torchFeature?.();
      if (torch && torch.isSupported()) {
        await torch.apply(nextState);
        setTorchOn(nextState);
        return;
      }

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
      const tempScanner = new Html5Qrcode("qr-file-helper", {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      const decoded = await tempScanner.scanFile(file, false);
      tempScanner.clear();
      setStarting(false);
      handleScannedUrl(decoded);
    } catch {
      setStarting(false);
      setError("No valid QR code could be found in that image. Please try another.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
    if (isProcessingScanRef.current) return;
    isProcessingScanRef.current = true;
    setScannedDetected(true);

    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 50, 40]);
      }
    } catch {}

    const clean = url.trim();
    if (!clean) {
      isProcessingScanRef.current = false;
      setScannedDetected(false);
      return;
    }

    // Brief 400ms delay to display the iOS-style locked green/yellow checkmark feedback
    setTimeout(() => {
      stopScanner().catch(() => {});
      setNfcReading(false);

      try {
        let toParse = clean;
        if (!/^https?:\/\//i.test(toParse) && (toParse.includes("/") || toParse.includes("."))) {
          toParse = `https://${toParse}`;
        }

        if (/^https?:\/\//i.test(toParse)) {
          const parsed = new URL(toParse);
          const isCurrentSite =
            typeof window !== "undefined" &&
            (parsed.hostname === window.location.hostname ||
              parsed.hostname.endsWith("nammainfo.in"));

          if (isCurrentSite) {
            const path = parsed.pathname.replace(/^\//, "");
            if (path) {
              router.push(`/${path}${parsed.search || ""}${parsed.hash || ""}`);
              return;
            }
          } else {
            // If external link, navigate directly
            window.location.href = clean;
            return;
          }
        }
      } catch {
        // Fall through to slug handling
      }

      // Bare slug like 'sujay', 'c/card_123', or 'company/member'
      if (clean && !clean.includes(" ") && !clean.startsWith("http")) {
        const slug = clean.replace(/^\//, "");
        if (slug) {
          router.push(`/${slug}`);
          return;
        }
      }

      isProcessingScanRef.current = false;
      setScannedDetected(false);
      setError("Could not recognize the scanned code as a valid Namma Info card link.");
    }, 400);
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-4 sm:py-6">
      {/* Hidden file element for scanning QR from photo library */}
      <div id="qr-file-helper" className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className={`w-full ${scanning ? "mb-2" : "mb-5"}`}>
        <h1 className="font-headline text-xl font-bold tracking-tight text-[var(--foreground)]">
          Scan Card
        </h1>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          Point your camera at a Namma Info QR or tap an NFC card
        </p>
      </div>

      {/* Active Live Camera Viewfinder (Kept in DOM so Html5Qrcode attaches reliably) */}
      <div
        className={`relative w-full overflow-hidden rounded-[5px] border border-[var(--border)] bg-black shadow-xl mb-3 aspect-[3/4] max-h-[58dvh] sm:max-h-[440px] ${
          scanning ? "block" : "hidden"
        }`}
      >
        {/* Starting indicator while camera stream connects */}
        {starting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 z-30 text-white">
            <Loader2 size={24} className="animate-spin text-white/80" />
            <span className="text-xs font-mono text-white/70">Connecting camera…</span>
          </div>
        )}

        {/* Html5Qrcode video attaches into this container with natural undistorted aspect ratio */}
        <div
          id="qr-reader"
          className="w-full h-full bg-black flex items-center justify-center [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&_video]:!block [&_video]:!m-0 [&_video]:!p-0 [&_#qr-shaded-region]:!hidden"
        />

        {/* iOS-Style Yellow Targeting Viewfinder Overlay */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center p-4">
          {/* Target Reticle Box (matches qrbox crop) */}
          <div
            className={`relative transition-transform duration-200 ${
              scannedDetected ? "scale-95" : "scale-100"
            }`}
            style={{
              width: "190px",
              height: "190px",
              maxWidth: "52vw",
              maxHeight: "52vw",
            }}
          >
            {/* iOS Yellow Corner Brackets */}
            {/* Top-Left */}
            <div
              className={`absolute -top-0.5 -left-0.5 w-7 h-7 border-t-[3.5px] border-l-[3.5px] rounded-tl-[6px] transition-colors ${
                scannedDetected ? "border-emerald-400" : "border-yellow-400"
              }`}
            />
            {/* Top-Right */}
            <div
              className={`absolute -top-0.5 -right-0.5 w-7 h-7 border-t-[3.5px] border-r-[3.5px] rounded-tr-[6px] transition-colors ${
                scannedDetected ? "border-emerald-400" : "border-yellow-400"
              }`}
            />
            {/* Bottom-Left */}
            <div
              className={`absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-[3.5px] border-l-[3.5px] rounded-bl-[6px] transition-colors ${
                scannedDetected ? "border-emerald-400" : "border-yellow-400"
              }`}
            />
            {/* Bottom-Right */}
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-[3.5px] border-r-[3.5px] rounded-br-[6px] transition-colors ${
                scannedDetected ? "border-emerald-400" : "border-yellow-400"
              }`}
            />

            {/* Center target dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  scannedDetected ? "bg-emerald-400" : "bg-yellow-400/70"
                }`}
              />
            </div>

            {/* Smooth scanning beam */}
            {!scannedDetected && (
              <div className="absolute inset-x-2 h-[2px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent animate-qr-scanner-beam" />
            )}

            {/* Success checkmark indicator */}
            {scannedDetected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-black shadow-lg animate-scale-in">
                  <Check size={26} strokeWidth={3} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Controls Bar */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-black/75 backdrop-blur-md text-[11px] font-mono font-medium text-white border border-white/15">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            Scanning…
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

        {/* Bottom Bar: Stop button & iOS-style Zoom buttons */}
        <div className="absolute bottom-3 inset-x-3 flex items-center justify-between z-20">
          <button
            type="button"
            onClick={stopScanner}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] bg-black/75 backdrop-blur-md text-xs font-semibold text-white border border-white/15 hover:bg-black transition-all cursor-pointer shadow-md"
          >
            <X size={14} />
            Stop
          </button>

          {/* iOS Style Zoom Pill (Centered at bottom with safe clearance) */}
          {zoomAvailable && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center rounded-full bg-black/80 backdrop-blur-md border border-white/20 p-0.5 shadow-md">
              <button
                type="button"
                onClick={() => handleSetZoom(1)}
                className={`h-7 px-3 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
                  currentZoom <= 1.4
                    ? "bg-yellow-400 text-black shadow-sm"
                    : "text-white/80 hover:text-white"
                }`}
              >
                1x
              </button>
              <button
                type="button"
                onClick={() => handleSetZoom(Math.min(2, zoomMax))}
                className={`h-7 px-3 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
                  currentZoom > 1.4 && currentZoom <= 2.4
                    ? "bg-yellow-400 text-black shadow-sm"
                    : "text-white/80 hover:text-white"
                }`}
              >
                2x
              </button>
              {zoomMax >= 3 && (
                <button
                  type="button"
                  onClick={() => handleSetZoom(3)}
                  className={`h-7 px-2.5 rounded-full text-xs font-mono font-bold transition-all cursor-pointer ${
                    currentZoom > 2.4
                      ? "bg-yellow-400 text-black shadow-sm"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  3x
                </button>
              )}
            </div>
          )}

          <div />
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
      <div
        className={`mt-4 w-full rounded-[5px] border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm ${
          scanning ? "hidden" : "block"
        }`}
      >
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
