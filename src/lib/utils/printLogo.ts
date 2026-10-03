// โลโก้แบรนด์กลาง QR ต้องพิมพ์ออกเครื่องพิมพ์ฉลากความร้อนที่พิมพ์ได้แค่ "ดำ" กับ "ขาว"
// โลโก้พื้นสีอ่อน (เช่นฟ้าอ่อนของ ISSA Activewear) กลายเป็นขาวทั้งอัน จึงเห็นเป็นช่องว่างกลาง QR
// แก้โดยแปลงเป็นขาวดำที่ตัดกันชัด: ส่วนที่เข้มกว่าเป็นดำ ส่วนที่อ่อนกว่าเป็นขาว (เกณฑ์แบ่งหาจากตัวโลโก้เองด้วยวิธี Otsu)

interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

// ความสว่าง 0-255 ของแต่ละพิกเซล โดยพิกเซลโปร่งใสถือว่าเป็นสีขาว (พิมพ์บนกระดาษขาว)
function lumaOf(img: Pixels): Uint8Array {
  const out = new Uint8Array(img.width * img.height);
  for (let i = 0; i < out.length; i++) {
    const a = img.data[i * 4 + 3] / 255;
    const y = 0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2];
    out[i] = Math.round(y * a + 255 * (1 - a));
  }
  return out;
}

// หาเกณฑ์ที่แบ่งความสว่างเป็น 2 กลุ่มได้ชัดที่สุด (Otsu)
export function otsuThreshold(luma: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of luma) hist[v]++;
  const total = luma.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

export function binarizeLogo(img: Pixels): Pixels {
  const luma = lumaOf(img);
  const t = otsuThreshold(luma);
  const data = new Uint8ClampedArray(img.width * img.height * 4);
  for (let i = 0; i < luma.length; i++) {
    const v = luma[i] <= t ? 0 : 255;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { data, width: img.width, height: img.height };
}

const SIZE = 200;
const cache = new Map<string, string>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // ต้องมีเพื่ออ่านพิกเซลจาก canvas ได้ (Supabase Storage เปิด CORS ให้ไฟล์สาธารณะ)
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("โหลดโลโก้ไม่สำเร็จ"));
    img.src = url;
  });
}

// คืน data URL ของโลโก้ขาวดำสำหรับพิมพ์ ถ้าแปลงไม่สำเร็จ (เช่นอ่านพิกเซลไม่ได้) คืนลิงก์เดิม
export async function toPrintLogo(url: string): Promise<string> {
  const hit = cache.get(url);
  if (hit) return hit;
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return url;
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const out = binarizeLogo(ctx.getImageData(0, 0, SIZE, SIZE));
    const target = ctx.createImageData(out.width, out.height);
    target.data.set(out.data);
    ctx.putImageData(target, 0, 0);
    const result = canvas.toDataURL("image/png");
    cache.set(url, result);
    return result;
  } catch {
    return url;
  }
}

export async function buildPrintLogos(urls: (string | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(urls.filter((u): u is string => Boolean(u))));
  const entries = await Promise.all(unique.map(async (u) => [u, await toPrintLogo(u)] as const));
  return new Map(entries);
}
