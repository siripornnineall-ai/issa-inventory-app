import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImageUploader } from "./ImageUploader";
import type { ProductImage } from "@/lib/types";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const img = (id: string, i: number): ProductImage => ({ id, url: `https://x/${id}.jpg`, isMain: i === 0, sortOrder: i, kind: "selling" });

function dt() {
  return { effectAllowed: "", dropEffect: "", setData: vi.fn(), getData: vi.fn() };
}

describe("ImageUploader: ลากรูปเพื่อสลับตำแหน่ง", () => {
  it("ลากรูปแรกไปวางบนรูปที่สาม รูปนั้นไปอยู่ตำแหน่งที่สาม ที่เหลือขยับตาม", () => {
    const onChange = vi.fn();
    render(<ImageUploader images={[img("a", 0), img("b", 1), img("c", 2), img("d", 3)]} onChange={onChange} kind="selling" />);
    const tiles = screen.getAllByTestId("image-tile");
    const data = dt();
    fireEvent.dragStart(tiles[0], { dataTransfer: data });
    fireEvent.dragOver(tiles[2], { dataTransfer: data });
    fireEvent.drop(tiles[2], { dataTransfer: data });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ProductImage[];
    expect(next.map((i) => i.id)).toEqual(["b", "c", "a", "d"]);
    expect(next.map((i) => i.sortOrder)).toEqual([0, 1, 2, 3]);
    // รูปหลักยังเป็นรูปเดิม (a) ไม่ว่าจะอยู่ตำแหน่งไหน
    expect(next.find((i) => i.isMain)?.id).toBe("a");
  });

  it("ลากไปวางบนตัวเองหรือวางนอกรูป ไม่เปลี่ยนอะไร", () => {
    const onChange = vi.fn();
    render(<ImageUploader images={[img("a", 0), img("b", 1)]} onChange={onChange} kind="selling" />);
    const tiles = screen.getAllByTestId("image-tile");
    const data = dt();
    fireEvent.dragStart(tiles[0], { dataTransfer: data });
    fireEvent.drop(tiles[0], { dataTransfer: data });
    expect(onChange).not.toHaveBeenCalled();
  });
});
