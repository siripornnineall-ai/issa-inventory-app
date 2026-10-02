// ถอดรหัสบาร์โค้ดแท่ง Code 128 จากภาพกล้อง — jsQR (ที่ใช้อ่าน QR) อ่านบาร์โค้ดแท่งไม่ได้
// ใช้ ZXing แบบ WebAssembly (ทำงานได้บน iPhone Safari ที่ไม่มี BarcodeDetector) ไฟล์ .wasm เก็บเองที่ public/zxing
// ไม่ดึงจาก CDN ภายนอก เพื่อไม่ให้การสแกนพึ่งอินเทอร์เน็ตของบริการอื่นและเปิดใช้งานได้เร็วขึ้น
// โหลดแบบ lazy (import ตอนเปิดกล้องเท่านั้น) หน้ารับเข้า/เบิกออกที่ยังไม่เปิดกล้องจึงไม่ต้องดาวน์โหลดตัวถอดรหัส

type ReaderModule = typeof import("zxing-wasm/reader");
type Overrides = NonNullable<Parameters<ReaderModule["prepareZXingModule"]>[0]>["overrides"];

const WASM_URL = "/zxing/zxing_reader.wasm";
let extraOverrides: Overrides = {};
let loading: Promise<ReaderModule> | null = null;

// ใช้ในเทสต์เท่านั้น: ส่งไฟล์ wasm ตรง ๆ เพราะใน Node ไม่มีเว็บเซิร์ฟเวอร์ให้โหลด /zxing/...
export function setBarcodeDecoderOverridesForTests(overrides: Overrides) {
  extraOverrides = overrides;
  loading = null;
}

function load(): Promise<ReaderModule> {
  if (!loading) {
    loading = import("zxing-wasm/reader")
      .then(async (m) => {
        await m.prepareZXingModule({
          overrides: {
            locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? WASM_URL : prefix + path),
            ...extraOverrides,
          },
          fireImmediately: true,
        });
        return m;
      })
      .catch((e) => {
        loading = null; // โหลดไม่สำเร็จ (เช่นออฟไลน์) ให้ลองใหม่ได้รอบหน้า
        throw e;
      });
  }
  return loading;
}

export function preloadBarcodeDecoder(): Promise<unknown> {
  return load();
}

// คืนข้อความของบาร์โค้ด Code 128 ที่เจอในภาพ (ถ้าไม่เจอคืน null)
export async function decodeBarcodeFrame(image: ImageData): Promise<string | null> {
  const m = await load();
  const results = await m.readBarcodes(image, { formats: ["Code128"], tryHarder: true, maxNumberOfSymbols: 1 });
  const hit = results.find((r) => r.isValid && r.text);
  return hit ? hit.text : null;
}
