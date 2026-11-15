"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";

// แบนเนอร์ด้านบนของแดชบอร์ด: สไลด์รูปของแต่ละแบรนด์ เปลี่ยนเองทุก 6 วินาที (หยุดเมื่อเอาเมาส์ชี้ และเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว) กดลูกศรหรือจุดเพื่อเลือกเองได้
// รูป ISSA Apparel เป็นไฟล์ในแอป (public/banners) ส่วนแบรนด์อื่นดึงจากแบนเนอร์ของเว็บหน้าร้าน (ตาราง storefront_brand_banners) ถ้าดึงไม่ได้ก็โชว์เท่าที่มี
// รูปแสดงเต็มความกว้างจอด้วยสัดส่วนจริงของรูป ไม่ตัดส่วนไหนเลย (ความสูงเปลี่ยนตามรูป) จึงไม่เปลี่ยนสไลด์เอง เพื่อไม่ให้หน้าเลื่อนขึ้นลง กดลูกศรหรือจุดเพื่อเลือกรูป
// แนะนำให้ทำรูปสัดส่วนกว้างประมาณ 2.4:1 (เช่น 2400x1000) จะไม่สูงเกินไปบนจอกว้าง

export interface BannerSlide {
  id: string;
  src: string;
  alt: string;
}

const APPAREL_SLIDE: BannerSlide = { id: "apparel-static", src: "/banners/issa-apparel.jpg", alt: "ISSA Apparel — Comfortable Confident in every situation" };

// รวมสไลด์: แบรนด์ที่มีแบนเนอร์ในฐานข้อมูลใช้ของฐานข้อมูล แบรนด์ ISSA Apparel (รหัส IS) ที่ไม่มีของตัวเองใช้รูปในแอป
export interface BannerRow {
  brand_id: string;
  image_url: string | null;
}

export function buildSlides(brands: { id: string; name: string; code: string }[], rows: BannerRow[]): BannerSlide[] {
  const slides: BannerSlide[] = [];
  const byBrand = new Map(brands.map((b) => [b.id, b]));
  const apparelIds = new Set(brands.filter((b) => b.code === "IS").map((b) => b.id));
  const hasApparelOwn = rows.some((r) => r.image_url && apparelIds.has(r.brand_id));
  if (!hasApparelOwn) slides.push(APPAREL_SLIDE);
  for (const r of rows) {
    if (!r.image_url) continue;
    const brand = byBrand.get(r.brand_id);
    slides.push({ id: `db-${r.brand_id}`, src: r.image_url, alt: brand?.name ?? "แบนเนอร์แบรนด์" });
  }
  return slides;
}

export function DashboardBanner() {
  const brands = useStore((s) => s.brands);
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await createClient().from("storefront_brand_banners").select("brand_id, image_url");
        if (!cancelled && !res.error && Array.isArray(res.data)) setRows(res.data as BannerRow[]);
      } catch {
        // ดึงแบนเนอร์ของแบรนด์อื่นไม่ได้ ก็โชว์เท่าที่มี
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const slides = buildSlides(Object.values(brands), rows);
  const count = slides.length;
  const current = count > 0 ? index % count : 0;
  const go = useCallback((delta: number) => setIndex((i) => (count > 0 ? (i + delta + count) % count : 0)), [count]);

  if (count === 0) return null;
  const slide = slides[current];
  return (
    <section
      aria-roledescription="carousel"
      aria-label="แบนเนอร์แบรนด์"
      className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={slide.id} src={slide.src} alt={slide.alt} className="block h-auto w-full" />
      {count > 1 && (
        <>
          <button type="button" aria-label="แบนเนอร์ก่อนหน้า" onClick={() => go(-1)} className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow hover:bg-white">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" aria-label="แบนเนอร์ถัดไป" onClick={() => go(1)} className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/80 p-1.5 shadow hover:bg-white">
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`ไปแบนเนอร์ ${s.alt}`}
                aria-current={i === current}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${i === current ? "w-5 bg-white" : "w-2 bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
