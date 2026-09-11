"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera } from "lucide-react";
import jsQR from "jsqr";

const RESCAN_COOLDOWN_MS = 1500;

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

export function CameraScanner({ onDetect, onClose }: { onDetect: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const onDetectRef = useRef(onDetect);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(false);

  useLockBodyScroll();

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    let cancelled = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
          const now = Date.now();
          const last = lastScanRef.current;
          if (result?.data && (!last || last.value !== result.data || now - last.at > RESCAN_COOLDOWN_MS)) {
            lastScanRef.current = { value: result.data, at: now };
            setFlash(true);
            setTimeout(() => setFlash(false), 200);
            onDetectRef.current(result.data);
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (err) {
        setError(err instanceof Error ? err.message : "เปิดกล้องไม่สำเร็จ");
      }
    }

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
          <div className={`pointer-events-none absolute inset-0 flex items-center justify-center transition ${flash ? "opacity-100" : "opacity-0"}`}>
            <div className="h-64 w-64 rounded-2xl ring-4 ring-[var(--color-success)]" />
          </div>
          {!flash && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-64 w-64 rounded-2xl border-2 border-white/60" />
            </div>
          )}
          <p
            className="pointer-events-none absolute left-0 right-0 text-center text-sm text-white/90 [text-shadow:0_1px_3px_rgb(0_0_0)]"
            style={{ bottom: "max(2rem, env(safe-area-inset-bottom))" }}
          >
            เล็งกล้องไปที่ QR บนป้ายสินค้า — สแกนต่อเนื่องได้เลย
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
