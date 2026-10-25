"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { toastError, toastSuccess } from "@/lib/toast";

interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
}

interface MembershipRow {
  collection_id: string;
  product_id: string;
  sort_order: number;
}

function slugify(name: string) {
  return name.trim().replace(/\s+/g, "-").replace(/[\/?#%&]/g, "").toLowerCase() || `c-${Date.now()}`;
}

async function loadAll(): Promise<{ collections: CollectionRow[]; members: MembershipRow[] } | null> {
  const supabase = createClient();
  const [c, m] = await Promise.all([
    supabase.from("storefront_collections").select("id, name, slug, sort_order, active").order("sort_order").order("created_at"),
    supabase.from("storefront_collection_products").select("collection_id, product_id, sort_order"),
  ]);
  if (c.error || m.error) {
    toastError("โหลดหมวดหมู่เว็บไม่สำเร็จ: " + (c.error ?? m.error)?.message);
    return null;
  }
  return { collections: (c.data ?? []) as CollectionRow[], members: (m.data ?? []) as MembershipRow[] };
}

/**
 * Owner-curated storefront categories: create / rename / reorder / hide /
 * delete collections and tick the products that belong to each. The
 * storefront menu, home chips and listing tabs are built from these.
 * Direct Supabase access like the other storefront cards.
 */
export function WebCollectionsCard() {
  const state = useStore();
  const products = useMemo(
    () =>
      Object.values(state.products)
        .filter((p) => p.status === "active")
        .sort((a, b) => a.sellingName.localeCompare(b.sellingName, "th")),
    [state.products]
  );
  const brandName = (id?: string) => (id ? state.brands[id]?.name : undefined);

  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [members, setMembers] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAll().then((data) => {
      if (cancelled) return;
      if (data) {
        setCollections(data.collections);
        setMembers(data.members);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    const data = await loadAll();
    if (data) {
      setCollections(data.collections);
      setMembers(data.members);
    }
  }

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const sort = collections.length ? Math.max(...collections.map((c) => c.sort_order)) + 1 : 0;
    const { data, error } = await createClient()
      .from("storefront_collections")
      .insert({ name, slug: slugify(name), sort_order: sort })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toastError(error.code === "23505" ? "มีหมวดหมู่ชื่อนี้แล้ว" : "เพิ่มไม่สำเร็จ: " + error.message);
      return;
    }
    setNewName("");
    await reload();
    setOpenId(data?.id ?? null);
    toastSuccess(`เพิ่มหมวดหมู่ "${name}" แล้ว — เลือกสินค้าที่จะอยู่ในหมวดนี้ได้เลย`);
  }

  async function patch(id: string, changes: Partial<CollectionRow>, msg?: string) {
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    const { error } = await createClient()
      .from("storefront_collections")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toastError("บันทึกไม่สำเร็จ: " + error.message);
      await reload();
    } else if (msg) toastSuccess(msg);
  }

  async function rename(id: string, name: string) {
    const trimmed = name.trim();
    const current = collections.find((c) => c.id === id);
    if (!current || !trimmed || trimmed === current.name) return;
    await patch(id, { name: trimmed, slug: slugify(trimmed) }, "เปลี่ยนชื่อหมวดหมู่แล้ว");
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= collections.length) return;
    const a = collections[index];
    const b = collections[target];
    const next = collections.slice();
    next[index] = { ...b, sort_order: a.sort_order };
    next[target] = { ...a, sort_order: b.sort_order };
    setCollections(next);
    const supabase = createClient();
    const [r1, r2] = await Promise.all([
      supabase.from("storefront_collections").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("storefront_collections").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (r1.error || r2.error) {
      toastError("สลับลำดับไม่สำเร็จ");
      await reload();
    }
  }

  async function remove(id: string) {
    setPendingDelete(null);
    const { error } = await createClient().from("storefront_collections").delete().eq("id", id);
    if (error) {
      toastError("ลบไม่สำเร็จ: " + error.message);
      return;
    }
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setMembers((prev) => prev.filter((m) => m.collection_id !== id));
    if (openId === id) setOpenId(null);
    toastSuccess("ลบหมวดหมู่แล้ว (สินค้ายังอยู่ในระบบตามปกติ)");
  }

  async function toggleProduct(collectionId: string, productId: string) {
    const supabase = createClient();
    const exists = members.some((m) => m.collection_id === collectionId && m.product_id === productId);
    if (exists) {
      setMembers((prev) => prev.filter((m) => !(m.collection_id === collectionId && m.product_id === productId)));
      const { error } = await supabase.from("storefront_collection_products").delete().match({ collection_id: collectionId, product_id: productId });
      if (error) {
        toastError("เอาสินค้าออกไม่สำเร็จ: " + error.message);
        await reload();
      }
    } else {
      const inCollection = members.filter((m) => m.collection_id === collectionId);
      const sort = inCollection.length ? Math.max(...inCollection.map((m) => m.sort_order)) + 1 : 0;
      setMembers((prev) => [...prev, { collection_id: collectionId, product_id: productId, sort_order: sort }]);
      const { error } = await supabase.from("storefront_collection_products").insert({ collection_id: collectionId, product_id: productId, sort_order: sort });
      if (error) {
        toastError("เพิ่มสินค้าไม่สำเร็จ: " + error.message);
        await reload();
      }
    }
  }

  const countOf = (id: string) => members.filter((m) => m.collection_id === id).length;
  const q = search.trim().toLowerCase();
  const visibleProducts = q
    ? products.filter((p) => [p.sellingName, p.category, p.shape ?? "", brandName(p.brandId) ?? "", p.modelCode ?? ""].join(" ").toLowerCase().includes(q))
    : products;

  return (
    <Card>
      <CardHeader>
        <CardTitle>หมวดหมู่บนเว็บไซต์ (เมนูหน้าร้าน)</CardTitle>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          สร้างหมวดหมู่เอง แล้วติ๊กเลือกสินค้าที่จะอยู่ในแต่ละหมวด — เมนูบนเว็บ ปุ่มหมวดหน้าแรก และแท็บในหน้าแบรนด์จะใช้หมวดเหล่านี้
          สินค้าหนึ่งชิ้นอยู่ได้หลายหมวด หมวดที่ไม่มีสินค้าจะไม่แสดงบนเว็บ
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex gap-2">
          <Input
            value={newName}
            placeholder="ชื่อหมวดหมู่ใหม่ เช่น กางเกงทำงาน, ชุดออกกำลังกาย, สินค้าลดราคา"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || !newName.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-primary-container)] px-3 py-2 text-sm text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} เพิ่มหมวดหมู่
          </button>
        </div>

        {loading && <p className="text-sm text-[var(--color-on-surface-variant)]">กำลังโหลด...</p>}
        {!loading && collections.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-on-surface-variant)]">
            ยังไม่มีหมวดหมู่ — ตอนนี้เมนูบนเว็บจะมีแค่ &quot;ทั้งหมดของแบรนด์&quot; และ &quot;สินค้าใหม่&quot; จนกว่าจะสร้างหมวดแรก
          </p>
        )}

        {collections.map((c, index) => {
          const open = openId === c.id;
          const n = countOf(c.id);
          return (
            <div key={c.id} className={`rounded-lg border border-[var(--color-border)] ${c.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-2 p-3">
                <button type="button" onClick={() => setOpenId(open ? null : c.id)} aria-label={open ? "ย่อ" : "ขยาย"} className="rounded p-1 hover:bg-[var(--color-surface-container)]">
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <Input className="max-w-xs" defaultValue={c.name} onBlur={(e) => rename(c.id, e.target.value)} />
                <span className="text-xs text-[var(--color-on-surface-variant)]">{n} สินค้า</span>
                <div className="ml-auto flex items-center gap-1 text-xs">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="เลื่อนขึ้น" className="rounded border border-[var(--color-border)] p-1.5 disabled:opacity-40">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === collections.length - 1} aria-label="เลื่อนลง" className="rounded border border-[var(--color-border)] p-1.5 disabled:opacity-40">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => patch(c.id, { active: !c.active }, c.active ? "ซ่อนหมวดนี้จากเว็บแล้ว" : "แสดงหมวดนี้บนเว็บแล้ว")}
                    className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1.5"
                  >
                    {c.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {c.active ? "ซ่อน" : "แสดง"}
                  </button>
                  {pendingDelete === c.id ? (
                    <>
                      <button type="button" onClick={() => remove(c.id)} className="rounded bg-[var(--color-danger)] px-2 py-1.5 text-white">ยืนยันลบ</button>
                      <button type="button" onClick={() => setPendingDelete(null)} className="px-2 py-1.5 underline">ยกเลิก</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setPendingDelete(c.id)} className="flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1.5 text-[var(--color-danger)]">
                      <Trash2 className="h-3.5 w-3.5" /> ลบ
                    </button>
                  )}
                </div>
              </div>

              {open && (
                <div className="border-t border-[var(--color-border)] p-3">
                  <Input value={search} placeholder="ค้นหาสินค้า (ชื่อ, หมวด, ทรง, แบรนด์)" onChange={(e) => setSearch(e.target.value)} className="mb-2" />
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--color-border)]">
                    {visibleProducts.length === 0 && <p className="p-3 text-sm text-[var(--color-on-surface-variant)]">ไม่พบสินค้า</p>}
                    {visibleProducts.map((p) => {
                      const checked = members.some((m) => m.collection_id === c.id && m.product_id === p.id);
                      return (
                        <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b border-[var(--color-border)] px-3 py-2 text-sm last:border-b-0 hover:bg-[var(--color-surface-container)]">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? "border-[var(--color-primary-container)] bg-[var(--color-primary-container)] text-white" : "border-[var(--color-border-strong)]"}`}>
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleProduct(c.id, p.id)} />
                          <span className="flex-1 truncate">{p.sellingName}</span>
                          <span className="shrink-0 text-xs text-[var(--color-on-surface-variant)]">
                            {[brandName(p.brandId), p.category, p.shape].filter(Boolean).join(" · ")}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
