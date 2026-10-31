import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import StockCountPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
const toastError = vi.fn();
vi.mock("@/lib/toast", () => ({ toastError: (m: string) => toastError(m), toastSuccess: vi.fn() }));
vi.mock("@/lib/utils/beep", () => ({ playBeep: vi.fn(), primeAudio: vi.fn() }));
vi.mock("@/components/stock/CameraScanner", () => ({
  CameraScanner: ({ onDetect }: { onDetect: (v: string) => void }) => (
    <button type="button" onClick={() => onDetect("IA-BS-CRM-L")}>
      จำลองสแกน
    </button>
  ),
}));

const iso = "2026-10-05T00:00:00.000Z";

function seed(qtyS: number, qtyM: number) {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "นับ", email: "c@x.com", role: "admin", active: true, createdAt: iso } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: iso } },
    brands: { b1: { id: "b1", name: "ISSA", code: "IA", active: true, createdAt: iso } },
    products: { p1: { id: "p1", sellingName: "Flow Wide", brandId: "b1", modelCode: "FW", images: [] } },
    variants: {
      vS: { id: "vS", productId: "p1", color: "ดำ", size: "S", sku: "IA-FW-BLK-S", active: true },
      vM: { id: "vM", productId: "p1", color: "ดำ", size: "M", sku: "IA-FW-BLK-M", active: true },
    },
    variantStock: {
      "vS::w1": { itemId: "vS", warehouseId: "w1", qtyOnHand: qtyS, qtyReserved: 0 },
      "vM::w1": { itemId: "vM", warehouseId: "w1", qtyOnHand: qtyM, qtyReserved: 0 },
    },
  } as never);
}

async function openProduct() {
  render(<StockCountPage />);
  fireEvent.change(screen.getByPlaceholderText("พิมพ์ชื่อรุ่นสินค้า..."), { target: { value: "Flow" } });
  fireEvent.click(await screen.findByRole("button", { name: "Flow Wide" }));
  await screen.findByText("ในระบบตอนนี้");
}

describe("นับสต็อก: เทียบยอดตอนเริ่มนับกับยอดปัจจุบัน", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("ยอดไม่เปลี่ยนระหว่างนับ ไม่มีแถบเตือน", async () => {
    seed(5, 3);
    await openProduct();
    expect(screen.queryByText(/ยอดในระบบเปลี่ยนไประหว่างที่นับ/)).toBeNull();
  });

// จำลองอีกเครื่องหนึ่งบันทึกของเข้า/ออกของ S (ยอดในระบบเปลี่ยน + มีรายการเคลื่อนไหว) offsetMs = เกิดหลัง(+)/ก่อน(-) ตอนนี้
let mvSeq = 0;
function otherDeviceMove(delta: number, offsetMs: number, qtyAfter: number) {
  mvSeq += 1;
  const st = useStore.getState();
  useStore.setState({
    variantStock: { ...st.variantStock, "vS::w1": { itemId: "vS", warehouseId: "w1", qtyOnHand: qtyAfter, qtyReserved: 0 } },
    movements: {
      ...st.movements,
      [`other${mvSeq}`]: {
        id: `other${mvSeq}`,
        refNo: `SOUT-OTHER-${mvSeq}`,
        itemType: "product",
        itemId: "vS",
        variantId: "vS",
        itemName: "Flow Wide",
        sku: "IA-FW-BLK-S",
        movementType: delta < 0 ? "sale" : "stock_in",
        qtyChange: delta,
        qtyBefore: qtyAfter - delta,
        qtyAfter,
        ...(delta < 0 ? { warehouseFromId: "w1" } : { warehouseToId: "w1" }),
        actorId: "u9",
        actorName: "เครื่องอื่น",
        createdAt: new Date(Date.now() + offsetMs).toISOString(),
      },
    },
  } as never);
}

  it("นับแล้วมีคนขายออกจากเครื่องอื่น (หลังนับ) → เตือน และบันทึกเป็น นับได้ + ของที่เข้า/ออกหลังนับ ไม่เอายอดนับไปทับของที่ขายไปแล้ว", async () => {
    seed(5, 3);
    await openProduct();
    // นับ S ได้ 5 (ตอนนั้นระบบมี 5)
    const countInputs = screen.getAllByPlaceholderText("ยังไม่นับ");
    fireEvent.change(countInputs[countInputs.length - 2], { target: { value: "5" } });
    expect(screen.queryByText(/หลังจากที่นับ มีของเข้า\/ออก/)).toBeNull();

    // หลังนับ มีคนเบิกออก S 2 ชิ้นจากเครื่องอื่น แล้วข้อมูลถูกรีเฟรชเข้ามา: ระบบเหลือ 3
    otherDeviceMove(-2, 60_000, 3);
    await waitFor(() => expect(screen.getByText(/หลังจากที่นับ มีของเข้า\/ออก 1 รายการ/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /บันทึกผลการนับ/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/หลังนับมีของเข้า\/ออก/)).toBeTruthy();
    // ยอดหลังปรับ = นับได้ 5 + (−2) = 3 → ตรงกับระบบตอนนี้ ของที่ขายไปแล้วไม่กลับมา
    fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันบันทึก" }));
    await waitFor(() => expect(useStore.getState().variantStock["vS::w1"].qtyOnHand).toBe(3));
    const adj = Object.values(useStore.getState().movements).filter((m) => m.movementType === "adjustment");
    expect(adj).toHaveLength(1);
    expect(adj[0]).toMatchObject({ qtyBefore: 3, qtyAfter: 3, qtyChange: 0 });
    expect(adj[0].reason).toContain("นับได้ 5");
    expect(adj[0].reason).toContain("เข้า/ออกหลังนับ 2");
  });

  it("นับได้ต่างจากระบบ และหลังนับมีคนขายเพิ่ม: ตั้งเป็น นับได้ − ที่ขายหลังนับ", async () => {
    seed(10, 3);
    await openProduct();
    const countInputs = screen.getAllByPlaceholderText("ยังไม่นับ");
    fireEvent.change(countInputs[countInputs.length - 2], { target: { value: "8" } }); // นับได้ 8 ระบบ 10
    otherDeviceMove(-3, 60_000, 7); // ขายหลังนับ 3
    fireEvent.click(screen.getByRole("button", { name: /บันทึกผลการนับ/ }));
    fireEvent.click(await screen.findByRole("button", { name: "ยืนยันบันทึก" }));
    await waitFor(() => expect(useStore.getState().variantStock["vS::w1"].qtyOnHand).toBe(5)); // 8 + (−3)
  });

  it("ขายออกก่อนนับ (เครื่องที่นับยังมีข้อมูลเก่า เพิ่งเห็นตอนรีเฟรช): ของบนชั้นไม่มีชิ้นนั้นแล้ว ไม่หักซ้ำ ตั้งเท่าที่นับ", async () => {
    seed(5, 3);
    await openProduct();
    const countInputs = screen.getAllByPlaceholderText("ยังไม่นับ");
    fireEvent.change(countInputs[countInputs.length - 2], { target: { value: "3" } }); // ชั้นเหลือ 3 จริง (ขายไป 2 ก่อนนับ)
    otherDeviceMove(-2, -60_000, 3); // รายการขายนั้นเกิด "ก่อน" เวลานับ แต่เครื่องนี้เพิ่งเห็น
    expect(screen.queryByText(/หลังจากที่นับ มีของเข้า\/ออก/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /บันทึกผลการนับ/ }));
    fireEvent.click(await screen.findByRole("button", { name: "ยืนยันบันทึก" }));
    await waitFor(() => expect(useStore.getState().variantStock["vS::w1"].qtyOnHand).toBe(3));
  });

  it("มีของรับเข้าหลังนับ: ตั้งเป็น นับได้ + ที่รับเข้าหลังนับ", async () => {
    seed(5, 3);
    await openProduct();
    const countInputs = screen.getAllByPlaceholderText("ยังไม่นับ");
    fireEvent.change(countInputs[countInputs.length - 2], { target: { value: "5" } });
    otherDeviceMove(+10, 60_000, 15); // รับเข้า 10 หลังนับ
    fireEvent.click(screen.getByRole("button", { name: /บันทึกผลการนับ/ }));
    fireEvent.click(await screen.findByRole("button", { name: "ยืนยันบันทึก" }));
    await waitFor(() => expect(useStore.getState().variantStock["vS::w1"].qtyOnHand).toBe(15)); // 5 + 10 ไม่ถูกทับเป็น 5
  });

  it("บันทึกแล้วตั้งสต็อกให้เท่ากับที่นับ (ไม่ใช่บวกเพิ่ม) และมีประวัติปรับยอด", async () => {
    seed(5, 3);
    await openProduct();
    const countInputs = screen.getAllByPlaceholderText("ยังไม่นับ");
    fireEvent.change(countInputs[countInputs.length - 2], { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: /บันทึกผลการนับ/ }));
    fireEvent.click(await screen.findByRole("button", { name: "ยืนยันบันทึก" }));
    await waitFor(() => expect(useStore.getState().variantStock["vS::w1"].qtyOnHand).toBe(4));
    expect(useStore.getState().variantStock["vM::w1"].qtyOnHand).toBe(3); // ไม่ได้นับ = ไม่แตะ
    const adj = Object.values(useStore.getState().movements).filter((m) => m.movementType === "adjustment");
    expect(adj).toHaveLength(1);
    expect(adj[0]).toMatchObject({ qtyBefore: 5, qtyAfter: 4, qtyChange: -1 });
    // สรุปผลหลังบันทึก: บอกว่ามีรายการที่ไม่ได้นับแต่ยังมีสต็อก (M ยังเป็นยอดเดิม 3)
    const summary = await screen.findByText("สรุปผลการนับสต็อก");
    expect(summary).toBeTruthy();
    expect(screen.getByText(/ปรับยอดตามที่นับ/)).toBeTruthy();
    expect(screen.getByText(/ที่ไม่ได้นับในรอบนี้แต่ยังมีสต็อก/)).toBeTruthy();
    expect(screen.getByText(/Flow Wide ดำ \/ M — ระบบ 3 ชิ้น/)).toBeTruthy();
  });

  it("นับแล้วทุกรายการตรงกับระบบ: ยังกดบันทึกได้ และบันทึกเป็นการยืนยันยอด (จำนวนไม่เปลี่ยน มีประวัติ)", async () => {
    seed(5, 3);
    await openProduct();
    expect(screen.getByText(/ยังไม่ได้นับรายการไหนเลย/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /บันทึกผลการนับ \(0\)/ }) as HTMLButtonElement).disabled).toBe(true);
    const countInputs = screen.getAllByPlaceholderText("ยังไม่นับ");
    fireEvent.change(countInputs[countInputs.length - 2], { target: { value: "5" } }); // S ระบบ 5 นับได้ 5 = ตรงกัน
    const btn = screen.getByRole("button", { name: /บันทึกผลการนับ \(1\)/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/นับแล้วตรงกับระบบ/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันบันทึก" }));
    await waitFor(() => expect(Object.values(useStore.getState().movements)).toHaveLength(1));
    expect(useStore.getState().variantStock["vS::w1"].qtyOnHand).toBe(5); // จำนวนไม่เปลี่ยน
    const mv = Object.values(useStore.getState().movements)[0];
    expect(mv).toMatchObject({ movementType: "adjustment", qtyBefore: 5, qtyAfter: 5, qtyChange: 0 });
    expect(mv.reason).toContain("ตรงกับระบบ");
  });

  it("นับหลายรุ่นพร้อมกัน: เพิ่มสองรุ่นเข้ารอบ นับทั้งคู่ แล้วบันทึกทีเดียว ทุกรุ่นถูกปรับและมีประวัติแยกตามรุ่น", async () => {
    seed(5, 3);
    // เพิ่มรุ่นที่สอง
    const s = useStore.getState();
    useStore.getState().actions.hydrate({
      ...s,
      products: { ...s.products, p2: { id: "p2", sellingName: "Billie Slim", brandId: "b1", modelCode: "BS", images: [] } },
      variants: { ...s.variants, vB: { id: "vB", productId: "p2", color: "ครีม", size: "L", sku: "IA-BS-CRM-L", active: true } },
      variantStock: { ...s.variantStock, "vB::w1": { itemId: "vB", warehouseId: "w1", qtyOnHand: 2, qtyReserved: 0 } },
    } as never);
    render(<StockCountPage />);
    for (const name of ["Flow", "Billie"]) {
      fireEvent.change(screen.getByPlaceholderText("พิมพ์ชื่อรุ่นสินค้า..."), { target: { value: name } });
      fireEvent.click(await screen.findByRole("button", { name: name === "Flow" ? "Flow Wide" : "Billie Slim" }));
    }
    expect(await screen.findByText(/รอบนับนี้ 2 รุ่น/)).toBeTruthy();
    // แต่ละรุ่นเป็นส่วนของตัวเอง (ช่องกรอกซ้ำกันทั้งการ์ดมือถือและตาราง ใช้ช่องแรกของแต่ละส่วน)
    const flow = screen.getByRole("region", { name: "Flow Wide" });
    const billie = screen.getByRole("region", { name: "Billie Slim" });
    fireEvent.change(within(flow).getAllByPlaceholderText("ยังไม่นับ")[0], { target: { value: "4" } }); // Flow Wide ดำ S 5 -> 4
    fireEvent.change(within(billie).getAllByPlaceholderText("ยังไม่นับ")[0], { target: { value: "6" } }); // Billie ครีม L 2 -> 6
    fireEvent.click(screen.getByRole("button", { name: /บันทึกผลการนับ \(2\)/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Flow Wide")).toBeTruthy();
    expect(within(dialog).getByText("Billie Slim")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันบันทึก" }));
    await waitFor(() => expect(useStore.getState().variantStock["vB::w1"].qtyOnHand).toBe(6));
    expect(useStore.getState().variantStock["vS::w1"].qtyOnHand).toBe(4);
    const reasons = Object.values(useStore.getState().movements).map((m) => m.reason).sort();
    expect(reasons).toEqual(["นับสต็อก — Billie Slim", "นับสต็อก — Flow Wide"]);
  });

  it("ล็อกเฉพาะรุ่นที่เลือก (ค่าเริ่มต้น): สแกนป้ายรุ่นอื่นพลาด ไม่ถูกนับ ไม่เพิ่มรุ่นเข้ารอบ และมีข้อความเตือน", async () => {
    seed(5, 3);
    const s = useStore.getState();
    useStore.getState().actions.hydrate({
      ...s,
      products: { ...s.products, p2: { id: "p2", sellingName: "Billie Slim", brandId: "b1", modelCode: "BS", images: [] } },
      variants: { ...s.variants, vB: { id: "vB", productId: "p2", color: "ครีม", size: "L", sku: "IA-BS-CRM-L", active: true } },
      variantStock: { ...s.variantStock, "vB::w1": { itemId: "vB", warehouseId: "w1", qtyOnHand: 2, qtyReserved: 0 } },
    } as never);
    render(<StockCountPage />);
    expect((screen.getByLabelText(/ล็อกเฉพาะรุ่นที่เลือก/) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("พิมพ์ชื่อรุ่นสินค้า..."), { target: { value: "Flow" } });
    fireEvent.click(await screen.findByRole("button", { name: "Flow Wide" }));
    fireEvent.click(await screen.findByRole("button", { name: /สแกน QR/ }));
    fireEvent.click(screen.getByRole("button", { name: "จำลองสแกน" })); // สแกนป้าย Billie Slim พลาด
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("สแกนผิดรุ่น"));
    expect(screen.queryByRole("region", { name: "Billie Slim" })).toBeNull();
    expect(screen.getByText(/รอบนับนี้ 1 รุ่น/)).toBeTruthy();
    expect(screen.getByText(/นับแล้ว 0 จาก 2 รายการ/)).toBeTruthy();
  });

  it("สแกนป้ายของรุ่นที่ยังไม่อยู่ในรอบ: เพิ่มรุ่นนั้นเข้ารอบให้เองและนับ 1 ชิ้น (ไม่ขึ้นสแกนผิดรุ่นอีก)", async () => {
    seed(5, 3);
    const s = useStore.getState();
    useStore.getState().actions.hydrate({
      ...s,
      products: { ...s.products, p2: { id: "p2", sellingName: "Billie Slim", brandId: "b1", modelCode: "BS", images: [] } },
      variants: { ...s.variants, vB: { id: "vB", productId: "p2", color: "ครีม", size: "L", sku: "IA-BS-CRM-L", active: true } },
      variantStock: { ...s.variantStock, "vB::w1": { itemId: "vB", warehouseId: "w1", qtyOnHand: 2, qtyReserved: 0 } },
    } as never);
    render(<StockCountPage />);
    fireEvent.change(screen.getByPlaceholderText("พิมพ์ชื่อรุ่นสินค้า..."), { target: { value: "Flow" } });
    fireEvent.click(await screen.findByRole("button", { name: "Flow Wide" }));
    fireEvent.click(screen.getByLabelText(/ล็อกเฉพาะรุ่นที่เลือก/)); // ปิดล็อก
    fireEvent.click(await screen.findByRole("button", { name: /สแกน QR/ }));
    fireEvent.click(screen.getByRole("button", { name: "จำลองสแกน" }));
    expect(await screen.findByText(/รอบนับนี้ 2 รุ่น/)).toBeTruthy();
    const billie = screen.getByRole("region", { name: "Billie Slim" });
    expect((within(billie).getAllByRole("spinbutton")[0] as HTMLInputElement).value).toBe("1");
  });

  it("ปุ่ม 'ตั้งรายการที่ยังไม่นับเป็น 0' ทำให้รายการที่ไม่ได้สแกนถูกปรับเป็น 0 ตอนบันทึก", async () => {
    seed(5, 3);
    await openProduct();
    const countInputs = screen.getAllByPlaceholderText("ยังไม่นับ");
    fireEvent.change(countInputs[countInputs.length - 2], { target: { value: "5" } }); // S นับได้ 5 (ตรงกัน)
    fireEvent.click(screen.getByRole("button", { name: "ตั้งรายการที่ยังไม่นับเป็น 0" }));
    fireEvent.click(screen.getByRole("button", { name: /บันทึกผลการนับ \(2\)/ }));
    fireEvent.click(await screen.findByRole("button", { name: "ยืนยันบันทึก" }));
    await waitFor(() => expect(useStore.getState().variantStock["vM::w1"].qtyOnHand).toBe(0));
    expect(useStore.getState().variantStock["vS::w1"].qtyOnHand).toBe(5);
  });
});
