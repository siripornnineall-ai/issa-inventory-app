"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera } from "lucide-react";
import jsQR from "jsqr";
import { decodeBarcodeFrame, preloadBarcodeDecoder } from "@/lib/utils/barcodeDecoder";

const RESCAN_COOLDOWN_MS = 1500;
// บาร์โค้ดแท่งถอดรหัสช้ากว่า QR (WebAssembly) จึงลองเป็นรอบ ๆ ไม่ทุกเฟรม และย่อภาพให้กว้างไม่เกินนี้
const BARCODE_INTERVAL_MS = 200;
const BARCODE_MAX_WIDTH = 1280;

// ล็อกไม่ให้หน้าเว็บเบื้องหลังเลื่อน/ขยับตอนเปิดกล้อง — กัน iOS Safari ขยับ viewport ตามแถบ URL
// ที่ยุบ/ขยายเวลากล้องทำงาน ซึ่งทำให้ overlay แบบ fixed เดิมสั่น/ไม่เต็มจอ
function useLockBodyScroll() {
  useEffect(() => {
    const { style } = document.body;
    const prevOverflow = style.overflow;
    const prevPosition = style.position;
    const scrollY = window.scrollY;
    style.overflow = "hidden";
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.left = "0";
    style.right = "0";
    return () => {
      style.overflow = prevOverflow;
      style.position = prevPosition;
      style.top = "";
      style.left = "";
      style.right = "";
      window.scrollTo(0, scrollY);
    };
  }, []);
}

// อ่านได้ทั้ง QR (jsQR ทุกเฟรม) และบาร์โค้ดแท่ง Code 128 ของรหัส SKU (ZXing เป็นรอบ ๆ)
export function CameraScanner({ onDetect, onClose }: { onDetect: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barcodeBusyRef = useRef(false);
  const lastBarcodeAtRef = useRef(0);
  const onDetectRef = useRef(onDetect);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(false);

  useLockBodyScroll();

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let cancelled = false;

    // รหัสเดียวกันที่ยังอยู่ในกรอบกล้องไม่ถูกยิงซ้ำภายในช่วงพัก (สแกนต่อเนื่องแล้วไม่เบิ้ล)
    function emit(value: string) {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.value === value && now - last.at <= RESCAN_COOLDOWN_MS) return;
      lastScanRef.current = { value, at: now };
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
      onDetectRef.current(value);
    }

    function tryBarcode(video: HTMLVideoElement, now: number) {
      if (barcodeBusyRef.current || now - lastBarcodeAtRef.current < BARCODE_INTERVAL_MS) return;
      barcodeBusyRef.current = true;
      lastBarcodeAtRef.current = now;
      try {
        const scale = Math.min(1, BARCODE_MAX_WIDTH / video.videoWidth);
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);
        const canvas = barcodeCanvasRef.current ?? (barcodeCanvasRef.current = document.createElement("canvas"));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          barcodeBusyRef.current = false;
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        decodeBarcodeFrame(ctx.getImageData(0, 0, w, h))
          .then((text) => {
            if (text && !cancelled) emit(text);
          })
          .catch(() => {
            // ตัวถอดรหัสบาร์โค้ดโหลดไม่สำเร็จ (เช่นออฟไลน์ครั้งแรก) ยังสแกน QR ต่อได้ตามปกติ
          })
          .finally(() => {
            barcodeBusyRef.current = false;
          });
      } catch {
        barcodeBusyRef.current = false;
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          if (result?.data) emit(result.data);
          else tryBarcode(video, Date.now());
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      try {
        // ความละเอียดสูงช่วยให้แท่งบาร์โค้ดเล็ก ๆ ยังแยกออกจากกัน
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        // โฟกัสต่อเนื่อง ถ้าเครื่องรองรับ (บาง Android) — ไม่รองรับก็ข้ามเงียบ ๆ
        try {
          await stream.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: "continuous" } as unknown as MediaTrackConstraintSet] });
        } catch {
          // ignore
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (err) {
        setError(err instanceof Error ? err.message : "เปิดกล้องไม่สำเร็จ");
      }
    }

    // เริ่มโหลดตัวถอดรหัสบาร์โค้ดไว้ล่วงหน้า ระหว่างกล้องกำลังเปิด
    preloadBarcodeDecoder().catch(() => {});
    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed left-0 top-0 z-50 h-[100dvh] w-[100dvw] overflow-hidden bg-black">
      {error ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-white">
          <Camera className="h-10 w-10" />
          <p className="text-sm">{error}</p>
          <p className="text-xs text-white/70">ตรวจสอบว่าอนุญาตให้เว็บนี้ใช้กล้อง และเปิดผ่าน HTTPS</p>
          <button type="button" onClick={onClose} className="mt-4 rounded-full bg-white/10 px-5 py-2 text-sm text-white hover:bg-white/20">
            ปิด
          </button>
        </div>
      ) : (
        <>
          <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover transition ${flash ? "brightness-150" : ""}`} />
          {/* กรอบเล็งแนวนอน: เหมาะกับบาร์โค้ดแท่ง และยังครอบ QR ได้ */}
          <div className={`pointer-events-none absolute inset-0 flex items-center justify-center transition ${flash ? "opacity-100" : "opacity-0"}`}>
            <div className="h-44 w-[min(90vw,28rem)] rounded-2xl ring-4 ring-[var(--color-success)]" />
          </div>
          {!flash && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-[min(90vw,28rem)] rounded-2xl border-2 border-white/60" />
            </div>
          )}
          <p
            className="pointer-events-none absolute left-0 right-0 px-4 text-center text-sm text-white/90 [text-shadow:0_1px_3px_rgb(0_0_0)]"
            style={{ bottom: "max(2rem, env(safe-area-inset-bottom))" }}
          >
            เล็งกล้องไปที่ QR หรือบาร์โค้ดบนป้ายสินค้า — สแกนต่อเนื่องได้เลย
            <span className="mt-1 block text-xs text-white/70">บาร์โค้ดวางให้อยู่แนวนอนในกรอบ ห่างป้ายราว 15-20 ซม. ให้ภาพคมชัด</span>
          </p>
        </>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="ปิด"
        className="absolute right-4 z-10 rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        <X className="h-6 w-6" />
      </button>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
