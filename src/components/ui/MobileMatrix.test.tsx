import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MobileMatrix } from "@/components/ui/MobileMatrix";

describe("MobileMatrix (ตารางสี × ไซซ์แบบมือถือ)", () => {
  it("หนึ่งสีหนึ่งการ์ด โชว์เฉพาะไซซ์ที่มีตัวเลข และข้ามสีที่ไม่มีตัวเลขเลย", () => {
    cleanup();
    render(
      <MobileMatrix
        sizes={["S", "M", "L"]}
        rows={[
          { key: "ดำ", label: "ดำ", summary: "รวม 30", cells: { S: { value: "10" }, L: { value: "20", sub: "คลัง 3", tone: "danger" } } },
          { key: "ขาว", label: "ขาว", cells: {} },
        ]}
        footer={{ label: "รวมต่อไซซ์", cells: { S: "10", M: "0", L: "20" }, summary: "รวม 30" }}
      />
    );
    expect(screen.getByText("ดำ")).toBeTruthy();
    expect(screen.queryByText("ขาว")).toBeNull(); // ไม่มีตัวเลขเลย = ไม่แสดง
    expect(screen.getByText("คลัง 3")).toBeTruthy();
    expect(screen.getByText("รวมต่อไซซ์")).toBeTruthy();
    // ไซซ์ M ไม่มีค่าในแถวสี (ไม่มีช่อง M ของการ์ดสีดำ) แต่มีในแถวรวม
    expect(screen.getAllByText("M")).toHaveLength(1);
  });
});
