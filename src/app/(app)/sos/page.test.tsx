import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import SosPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

const DB: Record<string, unknown[]> = {
  sos_branches: [{ id: "b1", name: "SOS MEGA", rent_monthly: 10000 }],
  sos_imports: [{ id: "i1", branch_id: "b1", period_start: "2026-09-01", period_end: "2026-09-30", stock_as_of: "2026-10-01", file_name: "x.xls" }],
  sos_summaries: [{ import_id: "i1", sales_total: 34570, gp: 5185.5, other_fees: 606.9, received_ex_vat: 28940, main_qty: 48, main_net: 34570, credit_qty: 28, credit_net: 20230, main_cogs: 9600 }],
  sos_code_map: [],
  sos_feedback: [{ id: "f1", created_at: "2026-11-12T03:00:00Z", branch_id: "b1", product_name: "Billie Slim", sos_code: null, kind: "good", note: "ลูกค้าถามหาไซซ์ XL", author_id: "u1", author_name: "น้องหน้าร้าน" }],
  sos_sales_lines: [
    { id: "s1", import_id: "i1", branch_id: "b1", section: "main", sos_code: "C1", description: "Billie Wide ทรงกระบอกใหญ่ black XL", qty: 2, net: 1290, variant_id: null },
    { id: "s2", import_id: "i1", branch_id: "b1", section: "main", sos_code: "C2", description: "Billie Wide ทรงกระบอกใหญ่ navy XL", qty: 1, net: 690, variant_id: null },
    { id: "s3", import_id: "i1", branch_id: "b1", section: "main", sos_code: "C3", description: "Wendy Mid ทรงกระบอกกลาง white L", qty: 1, net: 645, variant_id: null },
    { id: "s4", import_id: "i1", branch_id: "b1", section: "credit", sos_code: "C9", description: "Pocky Mid ทรงกระบอกกลาง brown M", qty: 9, net: 6000, variant_id: null },
  ],
  sos_stock_lines: [
    { id: "t1", import_id: "i1", branch_id: "b1", as_of: "2026-10-01", sos_code: "C7", description: "Old Model ทรงกระบอกเล็ก black M", qty: 6, variant_id: null },
    { id: "t2", import_id: "i1", branch_id: "b1", as_of: "2026-10-01", sos_code: "C1", description: "Billie Wide ทรงกระบอกใหญ่ black XL", qty: 1, variant_id: null },
  ],
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const f of ["select", "order", "limit", "in", "is", "eq"]) chain[f] = () => chain;
      chain.then = (resolve: (r: unknown) => unknown) => Promise.resolve(resolve({ data: DB[table] ?? [], error: null }));
      return chain;
    },
  }),
}));

const iso = "2026-11-12T00:00:00.000Z";
function seed(role: "admin" | "sales") {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "ผู้ใช้", email: "a@x.com", role, active: true, createdAt: iso } },
    currentUserId: "u1",
  } as never);
}

describe("หน้าสาขาหน้าร้าน SOS", () => {
  beforeEach(() => cleanup());

  it("ผู้มีสิทธิ์ดูรายงาน: เห็นแท็บการเงิน และตารางกำไรสุทธิหักค่าเช่า", async () => {
    seed("admin");
    render(<SosPage />);
    await waitFor(() => expect(screen.getByText(/SOS MEGA/, { selector: "td p, td" })).toBeTruthy());
    for (const name of ["สรุป", "ยอดขาย", "สต็อก", "จัดอันดับ/แนะนำ", "นำเข้าไฟล์"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(screen.getAllByText("฿9,340.00").length).toBeGreaterThan(0); // 28,940 - 9,600 - 10,000 = 9,340 (กำไรสุทธิ)
    expect(screen.getByRole("note").textContent).toContain("ยังไม่นับ"); // แจ้งเรื่องส่วนบัตรเครดิตครั้งเดียวที่หัวหน้า
  });

  it("ทีมขายที่ไม่มีสิทธิ์ดูรายงาน: เห็นเฉพาะ Feedback ไม่เห็นตัวเลขการเงิน", async () => {
    seed("sales");
    render(<SosPage />);
    await waitFor(() => expect(screen.getByText("ลูกค้าถามหาไซซ์ XL")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "สรุป" })).toBeNull();
    expect(screen.queryByRole("button", { name: "นำเข้าไฟล์" })).toBeNull();
    expect(screen.getByText("บันทึก feedback")).toBeTruthy();
  });

  it("เปลี่ยนแท็บไปนำเข้าไฟล์ได้", async () => {
    seed("admin");
    render(<SosPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "นำเข้าไฟล์" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "นำเข้าไฟล์" }));
    expect(screen.getByLabelText("เลือกไฟล์ SOS")).toBeTruthy();
  });

  it("ยอดขาย: จัดอันดับรุ่น (นับเฉพาะส่วนปกติ) กดขยายดูสี/ไซซ์ได้", async () => {
    seed("admin");
    render(<SosPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "ยอดขาย" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "ยอดขาย" }));
    await waitFor(() => expect(screen.getByText("#1")).toBeTruthy());
    expect(screen.getByText("Billie Wide")).toBeTruthy();
    expect(screen.getByText("#2")).toBeTruthy();
    expect(screen.queryByText(/Pocky/)).toBeNull(); // ส่วนบัตรเครดิตยังไม่นับ
    // ตารางสี x ไซซ์ (ไม่ใช่รายการยาว): แถวสี คอลัมน์ไซซ์ มีรวมต่อไซซ์
    expect(screen.getAllByText("รวมต่อไซซ์").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("columnheader", { name: "XL" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("cell", { name: "ดำ" }).length).toBeGreaterThan(0);
  });

  it("สต็อก: บอกรุ่นที่ค้าง (มีของแต่ไม่ขาย) และรุ่นที่ใกล้หมด", async () => {
    seed("admin");
    render(<SosPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "สต็อก" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "สต็อก" }));
    await waitFor(() => expect(screen.getByRole("columnheader", { name: "ขายแล้ว" })).toBeTruthy()); // ตารางเดียว: รุ่น x สาขา มีรวม ขายแล้ว สถานะ
    expect(screen.getByRole("columnheader", { name: /SOS MEGA/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "รวมมีของ" })).toBeTruthy();
    expect(screen.getAllByText("ค้าง").length).toBeGreaterThan(0); // Old Model มี 6 ไม่ขาย
    expect(screen.getAllByText("ใกล้หมด").length).toBeGreaterThan(0); // Billie Wide ขาย 3 เหลือ 1
  });

  it("จัดอันดับ/แนะนำ: การ์ดสรุป 3 ช่อง + ตารางเดียวรวมเป็นรุ่น (ถอนรุ่นที่ไม่ขายเลยก่อน) และมีโควตา +20 ให้ปรับ", async () => {
    seed("admin");
    render(<SosPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "จัดอันดับ/แนะนำ" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "จัดอันดับ/แนะนำ" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /ควรถอน.*ชิ้น/ })).toBeTruthy());
    expect(screen.getByRole("button", { name: /ควรเติม.*ชิ้น/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /ควรเติมเพิ่มรายการใหม่|ควรเพิ่มรายการใหม่.*ชิ้น/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "สี / ไซซ์" })).toBeTruthy();
    expect(screen.getByText("Old Model")).toBeTruthy(); // แถวในตาราง คำแนะนำ
    expect(screen.getByText(/ควรถอนก่อน/)).toBeTruthy();
    expect((screen.getByLabelText("โควตาเพิ่มสุทธิ") as HTMLInputElement).value).toBe("20");
    // กดการ์ด "ควรถอน" = กรองตาราง
    fireEvent.click(screen.getByRole("button", { name: /ควรถอน.*ชิ้น/ }));
    expect(screen.getByText(/เฉพาะควรถอน/)).toBeTruthy();
  });

  it("Feedback: มีจำนวนต่อสาขา และกรองตามสาขาได้", async () => {
    seed("admin");
    render(<SosPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Feedback/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /^Feedback/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /SOS MEGA \(1\)/ })).toBeTruthy());
    expect(screen.getByRole("button", { name: /ทุกสาขา \(1\)/ })).toBeTruthy();
  });
});
