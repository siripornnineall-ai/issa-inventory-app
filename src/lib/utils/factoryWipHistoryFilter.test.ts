import { describe, it, expect } from "vitest";
import { emptyState } from "@/lib/store/state";
import { isFromWipMovement, wipSewnDocLines } from "./factoryWip";

const iso = "2026-11-10T00:00:00.000Z";
const doc = (docNo: string, lines: { itemId: string; fromWip?: boolean }[], itemType = "product") => ({ id: docNo, docNo, itemType, status: "completed", lines: lines.map((l, i) => ({ id: `${docNo}-${i}`, qty: 1, ...l })), createdAt: iso });

describe("สต็อกเข้าที่รับแบบ เย็บเสร็จจากโรงงาน BC (ใช้ติดป้าย/กรองในประวัติ)", () => {
  const state = {
    ...emptyState(),
    stockInDocs: {
      d1: doc("SIN-1", [{ itemId: "v1", fromWip: true }, { itemId: "v2" }]),
      d2: doc("SIN-2", [{ itemId: "v1" }]),
      d3: doc("SIN-3", [{ itemId: "e1", fromWip: true }], "equipment"),
    },
  } as never;
  const map = wipSewnDocLines(state);

  it("เก็บเฉพาะใบของสินค้าที่มีบรรทัด fromWip และแยกตามตัวเลือก", () => {
    expect([...map.keys()]).toEqual(["SIN-1"]);
    expect([...(map.get("SIN-1") ?? [])]).toEqual(["v1"]);
  });

  it("เป็น 'จากโรงงาน BC' เฉพาะรายการสต็อกเข้าของตัวเลือกที่รับแบบเย็บเสร็จในใบนั้น", () => {
    expect(isFromWipMovement({ movementType: "stock_in", refNo: "SIN-1", itemId: "v1" }, map)).toBe(true);
    expect(isFromWipMovement({ movementType: "stock_in", refNo: "SIN-1", itemId: "v2" }, map)).toBe(false); // บรรทัดอื่นในใบเดียวกันที่รับปกติ
    expect(isFromWipMovement({ movementType: "stock_in", refNo: "SIN-2", itemId: "v1" }, map)).toBe(false); // ใบรับเข้าปกติ
    expect(isFromWipMovement({ movementType: "sale", refNo: "SIN-1", itemId: "v1" }, map)).toBe(false); // ไม่ใช่สต็อกเข้า
  });
});
