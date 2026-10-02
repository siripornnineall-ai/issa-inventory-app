// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { guideRegionInVideo } from "./scanRegion";
import { decodeBarcodeFrame, setBarcodeDecoderOverridesForTests } from "./barcodeDecoder";
import { CODE128_QUIET_MODULES, encodeCode128 } from "./code128";

// ภาพจำลองจากกล้องมือถือ: พื้นสีเทาอ่อน + บาร์โค้ดจริงของเราอยู่กลางภาพ ความกว้างโมดูลเป็นพิกเซลทศนิยมได้
// วาดที่ความละเอียด 6 เท่าแล้วเฉลี่ยลงมา ให้ขอบแท่งเป็นสีเทาไล่ระดับเหมือนภาพจากกล้องจริง
function cameraFrame(text: string, modulePx: number, frameW: number, frameH: number): ImageData {
  const SS = 6;
  const bits = encodeCode128(text)!;
  const total = bits.length + CODE128_QUIET_MODULES * 2;
  const barW = Math.round(total * modulePx * SS);
  const barH = Math.round(frameH * 0.22 * SS);
  const x0 = Math.round((frameW * SS - barW) / 2);
  const y0 = Math.round((frameH * SS - barH) / 2);
  const hi = new Uint8Array(frameW * SS * frameH * SS).fill(235);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== "1") continue;
    const xa = x0 + Math.round((CODE128_QUIET_MODULES + i) * modulePx * SS);
    const xb = x0 + Math.round((CODE128_QUIET_MODULES + i + 1) * modulePx * SS);
    for (let y = y0; y < y0 + barH; y++) for (let x = xa; x < xb; x++) hi[y * frameW * SS + x] = 20;
  }
  const data = new Uint8ClampedArray(frameW * frameH * 4);
  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < frameW; x++) {
      let sum = 0;
      for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) sum += hi[(y * SS + dy) * frameW * SS + x * SS + dx];
      const v = sum / (SS * SS);
      const o = (y * frameW + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
      data[o + 3] = 255;
    }
  }
  return { data, width: frameW, height: frameH, colorSpace: "srgb" } as ImageData;
}

function crop(img: ImageData, r: { sx: number; sy: number; sw: number; sh: number }): ImageData {
  const data = new Uint8ClampedArray(r.sw * r.sh * 4);
  for (let y = 0; y < r.sh; y++) {
    const from = ((r.sy + y) * img.width + r.sx) * 4;
    data.set(img.data.subarray(from, from + r.sw * 4), y * r.sw * 4);
  }
  return { data, width: r.sw, height: r.sh, colorSpace: "srgb" } as ImageData;
}

// ย่อภาพด้วยการเฉลี่ยพื้นที่ (เหมือน canvas drawImage ตอนย่อ) — วิธีเดิมที่ย่อทั้งเฟรมเหลือกว้าง 1280
function downscale(img: ImageData, width: number): ImageData {
  const f = img.width / width;
  const h = Math.round(img.height / f);
  const data = new Uint8ClampedArray(width * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let n = 0;
      for (let yy = Math.floor(y * f); yy < Math.min(img.height, Math.ceil((y + 1) * f)); yy++) {
        for (let xx = Math.floor(x * f); xx < Math.min(img.width, Math.ceil((x + 1) * f)); xx++) {
          sum += img.data[(yy * img.width + xx) * 4];
          n++;
        }
      }
      const o = (y * width + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = sum / n;
      data[o + 3] = 255;
    }
  }
  return { data, width, height: h, colorSpace: "srgb" } as ImageData;
}

describe("guideRegionInVideo", () => {
  it("on a portrait phone shows only a middle strip of the landscape video, so the crop is small and centered", () => {
    const r = guideRegionInVideo({ videoWidth: 1920, videoHeight: 1080, clientWidth: 390, clientHeight: 844 });
    // scale = 844/1080 = 0.78 ; กรอบกว้าง 351px = 449 พิกเซลวิดีโอ x 1.3 = 584
    expect(r.sw).toBeGreaterThan(560);
    expect(r.sw).toBeLessThan(600);
    expect(r.sx + r.sw / 2).toBeCloseTo(960, -1);
    expect(r.sy + r.sh / 2).toBeCloseTo(540, -1);
  });

  it("never goes outside the video, and falls back to the whole frame when sizes are unknown", () => {
    const wide = guideRegionInVideo({ videoWidth: 640, videoHeight: 480, clientWidth: 1600, clientHeight: 900 });
    expect(wide.sx).toBeGreaterThanOrEqual(0);
    expect(wide.sx + wide.sw).toBeLessThanOrEqual(640);
    expect(wide.sy + wide.sh).toBeLessThanOrEqual(480);
    expect(guideRegionInVideo({ videoWidth: 640, videoHeight: 480, clientWidth: 0, clientHeight: 0 })).toEqual({ sx: 0, sy: 0, sw: 640, sh: 480 });
  });
});

describe("ทำไมสแกนบาร์โค้ดไม่เสถียร: ย่อภาพทั้งเฟรมทำให้แท่งบางเกินไป", () => {
  beforeAll(() => {
    const wasm = readFileSync(path.resolve(__dirname, "../../../public/zxing/zxing_reader.wasm"));
    setBarcodeDecoderOverridesForTests({ wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer });
  });

  // SKU ยาว 15 ตัวอักษร = 212 โมดูลรวมโซนเงียบ: กรอบกล้องกว้าง ~450px พอดี -> ราว 2.1 px ต่อโมดูลในภาพจริง
  const SKU = "IA-SZHJ-BLK-2XL";

  it("reads the long SKU when only the aiming frame is cut out at full resolution (new method)", async () => {
    const frame = cameraFrame(SKU, 2.1, 1920, 1080);
    const region = guideRegionInVideo({ videoWidth: 1920, videoHeight: 1080, clientWidth: 390, clientHeight: 844 });
    expect(await decodeBarcodeFrame(crop(frame, region))).toBe(SKU);
  }, 120000);

  it("fails on the same frame when the whole frame is first shrunk to 1280 px wide (old method)", async () => {
    const frame = cameraFrame(SKU, 2.1, 1920, 1080);
    expect(await decodeBarcodeFrame(downscale(frame, 1280))).toBeNull();
  }, 120000);
});
