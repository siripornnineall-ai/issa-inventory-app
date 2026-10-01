import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { produce } from "immer";
import { VariantPicker } from "./VariantPicker";
import { useStore } from "@/lib/store";
import { emptyState } from "@/lib/store/state";
import * as engine from "@/lib/store/engine";

vi.mock("@/lib/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

// รุ่นเดียว 2 สี (ครีม 3 ไซซ์ / ดำ 2 ไซซ์) เพื่อทดสอบว่า "เลือกทุกไซซ์" นับเฉพาะสีที่เลือกอยู่
function seed() {
  const ids: Record<string, string> = {};
  const state = produce(emptyState(), (draft) => {
    const productId = engine.createProduct(draft, { sellingName: "Billie Slim", sellingPrice: 1090, category: "กางเกงขายายาว", status: "active", images: [] });
    for (const [color, size] of [["ครีม", "S"], ["ครีม", "M"], ["ครีม", "L"], ["ดำ", "S"], ["ดำ", "M"]]) {
      ids[`${color}-${size}`] = engine.addVariant(draft, productId, { color, size, purchasePrice: 400, sellingPrice: 1090 });
    }
  });
  useStore.getState().actions.hydrate(state);
  return ids;
}

function openPicker() {
  fireEvent.change(screen.getByPlaceholderText(/ค้นหา/), { target: { value: "Billie" } });
  fireEvent.click(screen.getByText("Billie Slim", { selector: "span.block" }));
}

describe("VariantPicker — แสดงสีของรุ่นครบ", () => {
  beforeEach(() => cleanup());

  it("still lists every color of the model when the search text only matches one color", () => {
    seed();
    render(<VariantPicker onSelect={vi.fn()} onSelectMany={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/ค้นหา/), { target: { value: "ดำ" } });
    fireEvent.click(screen.getByText("Billie Slim", { selector: "span.block" }));

    // ครีมไม่ตรงกับคำค้น "ดำ" แต่ต้องยังเลือกได้ และไซซ์ของสีดำที่ค้นเจอถูกเลือกไว้ให้ก่อน
    expect(screen.getAllByText("ครีม").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ดำ").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/เลือกทุกไซซ์ของสีดำ [(]2 ไซซ์[)]/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^ครีม$/ }));
    expect(screen.getByLabelText(/เลือกทุกไซซ์ของสีครีม [(]3 ไซซ์[)]/)).toBeTruthy();
  });
});

describe("VariantPicker — เลือกทุกไซซ์ของสีนี้", () => {
  beforeEach(() => cleanup());

  it("does not show the checkbox unless the page opts in with onSelectMany", () => {
    seed();
    render(<VariantPicker onSelect={vi.fn()} />);
    openPicker();
    expect(screen.queryByLabelText(/เลือกทุกไซซ์/)).toBeNull();
  });

  it("adds every size of the currently selected color in one tick, and nothing from other colors", () => {
    const ids = seed();
    const onSelectMany = vi.fn((list: string[]) => list.length);
    render(<VariantPicker onSelect={vi.fn()} onSelectMany={onSelectMany} />);
    openPicker();

    const box = screen.getByLabelText(/เลือกทุกไซซ์ของสีครีม \(3 ไซซ์\)/) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);

    expect(onSelectMany).toHaveBeenCalledTimes(1);
    expect([...onSelectMany.mock.calls[0][0]].sort()).toEqual([ids["ครีม-S"], ids["ครีม-M"], ids["ครีม-L"]].sort());
    expect((screen.getByLabelText(/เลือกทุกไซซ์ของสีครีม/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/เลือกทุกไซซ์ของสีครีม/) as HTMLInputElement).disabled).toBe(true);
  });

  it("only sends the sizes not already added when some were tapped individually first", () => {
    const ids = seed();
    const onSelect = vi.fn();
    const onSelectMany = vi.fn((list: string[]) => list.length);
    render(<VariantPicker onSelect={onSelect} onSelectMany={onSelectMany} />);
    openPicker();

    fireEvent.click(screen.getByRole("button", { name: /^M$/ }));
    expect(onSelect).toHaveBeenCalledWith(ids["ครีม-M"]);

    fireEvent.click(screen.getByLabelText(/เลือกทุกไซซ์ของสีครีม/));
    expect([...onSelectMany.mock.calls[0][0]].sort()).toEqual([ids["ครีม-S"], ids["ครีม-L"]].sort());
  });
});
