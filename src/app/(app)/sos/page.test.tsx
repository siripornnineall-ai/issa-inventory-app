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
  sos_sales_lines: [],
  sos_stock_lines: [],
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
    for (const name of ["ต้นทุนและกำไร", "สต็อกสาขา", "แนะนำ SKU", "นำเข้าไฟล์"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(screen.getAllByText("฿9,340.00").length).toBeGreaterThan(0); // 28,940 - 9,600 - 10,000 = 9,340 (กำไรสุทธิ)
    expect(screen.getByText(/ยังไม่นับส่วนบัตรเครดิต/)).toBeTruthy();
  });

  it("ทีมขายที่ไม่มีสิทธิ์ดูรายงาน: เห็นเฉพาะ Feedback ไม่เห็นตัวเลขการเงิน", async () => {
    seed("sales");
    render(<SosPage />);
    await waitFor(() => expect(screen.getByText("ลูกค้าถามหาไซซ์ XL")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "ต้นทุนและกำไร" })).toBeNull();
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
});
