import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { ExcelPickButton } from "@/components/ui/ExcelPickButton";

const items = [
  { id: "a", label: "Billie Wide" },
  { id: "b", label: "Wendy Mid" },
  { id: "c", label: "Justin Wide" },
];

describe("ExcelPickButton", () => {
  it("ปุ่มหลักโหลดทั้งหมดทันที", () => {
    const onExport = vi.fn();
    render(<ExcelPickButton items={items} onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    expect([...onExport.mock.calls[0][0]].sort()).toEqual(["a", "b", "c"]);
  });

  it("ตั้งต้นติ๊กทั้งหมด เอาติ๊กออกได้ แล้วส่งเฉพาะที่เลือกกลับ", () => {
    const onExport = vi.fn();
    render(<ExcelPickButton items={items} onExport={onExport} />);
    fireEvent.click(screen.getByRole("button", { name: "เลือกรุ่นก่อนโหลด" }));
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getAllByRole("checkbox")).toHaveLength(3);
    fireEvent.click(within(dlg).getByLabelText("Wendy Mid"));
    fireEvent.click(within(dlg).getByRole("button", { name: /โหลด \(2\/3\)/ }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect([...onExport.mock.calls[0][0]].sort()).toEqual(["a", "c"]);
  });

  it("ล้างที่เลือกแล้วปุ่มโหลดกดไม่ได้ และค้นหากรองรายการได้", () => {
    render(<ExcelPickButton items={items} onExport={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "เลือกรุ่นก่อนโหลด" }));
    const dlg = screen.getByRole("dialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "ล้างที่เลือก" }));
    expect((within(dlg).getByRole("button", { name: /โหลด/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dlg).getByLabelText("ค้นหารุ่นที่จะโหลด"), { target: { value: "wide" } });
    expect(within(dlg).getAllByRole("checkbox")).toHaveLength(2);
  });
});
