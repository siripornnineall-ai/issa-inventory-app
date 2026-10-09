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

// ตัวอ่านบาร์โค้ดของเบราว์เซอร์เอง (BarcodeDetector) ใช้ ML Kit ของ Google บน Android Chrome/แอปที่ติดตั้งจากหน้าจอหลัก
// อ่านภาพที่เบลอเล็กน้อย/เอียงได้ดีกว่า ZXing มาก และทำงานเร็ว จึงลองตัวนี้ก่อนเสมอถ้าเครื่องมี
// iPhone Safari ไม่มี ก็ตกไปใช้ ZXing (wasm) เหมือนเดิม
interface NativeDetectedBarcode {
  rawValue: string;
}
interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<NativeDetectedBarcode[]>;
}
interface NativeBarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

let nativeDetector: Promise<NativeBarcodeDetector | null> | null = null;

function getNativeDetector(): Promise<NativeBarcodeDetector | null> {
  if (!nativeDetector) {
    nativeDetector = (async () => {
      const Ctor = (globalThis as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector;
      if (!Ctor) return null;
      try {
        const formats = Ctor.getSupportedFormats ? await Ctor.getSupportedFormats() : ["code_128"];
        if (!formats.includes("code_128")) return null;
        return new Ctor({ formats: ["code_128"] });
      } catch {
        return null;
      }
    })();
  }
  return nativeDetector;
}

export function nativeBarcodeSupported(): Promise<boolean> {
  return getNativeDetector().then((d) => d !== null);
}

// ใช้ในเทสต์เท่านั้น: ล้างตัวจำว่าเครื่องมี BarcodeDetector หรือไม่
export function resetNativeDetectorForTests() {
  nativeDetector = null;
}

// อ่านบาร์โค้ด Code 128 จากภาพ/วิดีโอด้วยตัวอ่านของเบราว์เซอร์ (null = เครื่องไม่รองรับหรืออ่านไม่เจอ)
export async function decodeBarcodeNative(source: CanvasImageSource): Promise<string | null> {
  const detector = await getNativeDetector();
  if (!detector) return null;
  try {
    const found = await detector.detect(source);
    const hit = found.find((b) => b.rawValue);
    return hit ? hit.rawValue : null;
  } catch {
    return null;
  }
}

// คืนข้อความของบาร์โค้ด Code 128 ที่เจอในภาพ (ถ้าไม่เจอคืน null)
export async function decodeBarcodeFrame(image: ImageData): Promise<string | null> {
  const m = await load();
  const results = await m.readBarcodes(image, { formats: ["Code128"], tryHarder: true, maxNumberOfSymbols: 1 });
  const hit = results.find((r) => r.isValid && r.text);
  return hit ? hit.text : null;
}
