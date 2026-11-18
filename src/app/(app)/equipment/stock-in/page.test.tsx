import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import EquipmentStockInPage from "./page";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/components/layout/Header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
const toastError = vi.fn();
vi.mock("@/lib/toast", () => ({ toastError: (m: string) => toastError(m), toastSuccess: vi.fn() }));

const iso = "2026-11-17T00:00:00.000Z";
const eq = (id: string, name: string, size: string | undefined, unit: string, price: number) => ({
  id,
  name,
  code: `EQ-${id}`,
  type: "label",
  size,
  images: [],
  purchasePricePerUnit: price,
  unit,
  reorderPoint: 0,
  reorderQty: 0,
  status: "active",
  createdAt: iso,
  updatedAt: iso,
});

function seed() {
  useStore.getState().actions.hydrate({
    ...emptyState(),
    users: { u1: { id: "u1", name: "รับของ", email: "c@x.com", role: "admin", active: true, createdAt: iso } },
    currentUserId: "u1",
    warehouses: { w1: { id: "w1", name: "คลังหลัก", type: "main", active: true, createdAt: iso } },
    equipment: {
      eS: eq("eS", "เลเบิ้ล Issa", "S", "โหล", 100),
      eM: eq("eM", "เลเบิ้ล Issa", "M", "โหล", 100),
      eL: eq("eL", "เลเบิ้ล Issa", "L", "โหล", 100),
      bag: eq("bag", "ถุงซิป Active", undefined, "ม้วน", 50),
    },
  } as never);
}

function pick(query: string, label: string) {
  fireEvent.change(screen.getByPlaceholderText(/ค้นหาอุปกรณ์/), { target: { value: query } });
  fireEvent.click(screen.getByRole("button", { name: new RegExp(label.replace(/[()]/g, "\\$&")) }));
}

describe("หน้ารับอุปกรณ์เข้า: ตารางกรอกรายไซซ์", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    replace.mockClear();
    toastError.mockClear();
    seed();
  });

  it("เลือกอุปกรณ์ที่มีหลายไซซ์ → ขึ้นเป็นตารางหนึ่งคอลัมน์ต่อไซซ์ (เรียงไซซ์) พร้อมช่องกรอกรับเข้า และกรอกแล้วบันทึกเฉพาะช่องที่มีจำนวน", () => {
    render(<EquipmentStockInPage />);
    pick("เล", "เลเบิ้ล Issa (M)");
    const inputs = screen.getAllByRole("spinbutton").filter((i) => i.getAttribute("aria-label")?.startsWith("รับ "));
    expect(inputs.map((i) => i.getAttribute("aria-label"))).toEqual(["รับ เลเบิ้ล Issa S", "รับ เลเบิ้ล Issa M", "รับ เลเบิ้ล Issa L"]);
    fireEvent.change(inputs[0], { target: { value: "2" } }); // S 2 โหล
    fireEvent.change(inputs[2], { target: { value: "5" } }); // L 5 โหล (M เว้นว่าง)
    act(() => {
      screen.getAllByRole("button", { name: "บันทึกการรับเข้า" })[0].click();
    });
    const docs = Object.values(useStore.getState().stockInDocs);
    expect(docs).toHaveLength(1);
    expect(docs[0].itemType).toBe("equipment");
    expect(docs[0].lines.map((l) => [l.itemId, l.qty, l.unitCost])).toEqual([["eS", 2, 100], ["eL", 5, 100]]);
    expect(useStore.getState().equipmentStock["eS::w1"].qtyOnHand).toBe(2);
    expect(useStore.getState().equipmentStock["eM::w1"]?.qtyOnHand ?? 0).toBe(0);
  });

  it("อุปกรณ์ไม่มีไซซ์ขึ้นเป็นกลุ่มของตัวเอง ช่องเดียว และราคาต่อหน่วยแก้ได้ต่อกลุ่ม", () => {
    render(<EquipmentStockInPage />);
    pick("ถุง", "ถุงซิป Active");
    const input = screen.getByLabelText("รับ ถุงซิป Active");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("ราคาต่อหน่วย ถุงซิป Active"), { target: { value: "70" } });
    act(() => {
      screen.getAllByRole("button", { name: "บันทึกการรับเข้า" })[0].click();
    });
    const doc = Object.values(useStore.getState().stockInDocs)[0];
    expect(doc.lines.map((l) => [l.itemId, l.qty, l.unitCost])).toEqual([["bag", 3, 70]]);
  });

  it("เลือกอุปกรณ์กลุ่มเดิมซ้ำ → แจ้งเตือน ไม่เพิ่มตารางซ้ำ", () => {
    render(<EquipmentStockInPage />);
    pick("เล", "เลเบิ้ล Issa (S)");
    pick("เล", "เลเบิ้ล Issa (L)");
    expect(toastError).toHaveBeenCalledWith("เพิ่มรายการนี้ไว้แล้ว");
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("ไม่กรอกจำนวนเลย → ไม่บันทึก และแจ้งให้กรอกอย่างน้อย 1 ช่อง; กด Enter ไปช่องถัดไป", () => {
    render(<EquipmentStockInPage />);
    pick("เล", "เลเบิ้ล Issa (S)");
    const inputs = screen.getAllByRole("spinbutton").filter((i) => i.getAttribute("aria-label")?.startsWith("รับ "));
    inputs[0].focus();
    fireEvent.keyDown(inputs[0], { key: "Enter" });
    expect(document.activeElement).toBe(inputs[1]);
    act(() => {
      screen.getAllByRole("button", { name: "บันทึกการรับเข้า" })[0].click();
    });
    expect(Object.keys(useStore.getState().stockInDocs)).toHaveLength(0);
    expect(toastError).toHaveBeenCalledWith("กรุณากรอกจำนวนรับเข้าอย่างน้อย 1 ช่อง");
  });
});
