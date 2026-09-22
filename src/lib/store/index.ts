import { create } from "zustand";
import { produce } from "immer";
import type { AppState } from "./state";
import { emptyState } from "./state";
import * as engine from "./engine";
import { assertPermission, type Permission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/client";
import { syncStateDiff } from "@/lib/supabase/sync";
import { toastError } from "@/lib/toast";
import type {
  AppUser,
  Brand,
  CompanyInfo,
  Equipment,
  Product,
  ProductVariant,
  StorefrontSettings,
  Supplier,
  SupplierImage,
  UnitToken,
  Warehouse,
} from "@/lib/types";

interface Actions {
  hydrate: (state: AppState) => void;
  // เติมโทเคนที่เพิ่งดึงจากฐานข้อมูลตรง ๆ (fallback ตอนสแกนเจอโทเคนที่เครื่องนี้ยังไม่มี) เข้า cache ในเครื่อง
  // ไม่ใช่ business action จึงไม่ผ่าน runChecked/sync — เป็นแค่การอ่านข้อมูลที่มีอยู่แล้วในฐานข้อมูลเข้ามาเก็บไว้
  mergeUnitTokens: (tokens: UnitToken[]) => void;
  login: (userId: string) => void;
  logout: () => void;

  upsertWarehouse: (input: Partial<Warehouse> & { id?: string }) => void;
  upsertSupplier: (input: Partial<Supplier> & { id?: string }) => string;
  removeSupplier: (id: string) => void;
  upsertUser: (input: Partial<AppUser> & { id?: string }) => string;
  // สามตัวนี้อัปเดตเฉพาะ state ในเครื่อง ไม่เรียก sync — เพราะฝั่งฐานข้อมูลถูกเขียนไปแล้วโดย Edge Function admin-users
  // (สร้าง/ลบบัญชี) หรือ RPC clear_must_change_password (ล้างธงหลังเปลี่ยนรหัสผ่าน) ใช้หลังคำสั่งฝั่งเซิร์ฟเวอร์สำเร็จเท่านั้น
  mergeUser: (user: AppUser) => void;
  assertUserRemovable: (id: string) => void; // โยน error ภาษาไทยถ้าลบไม่ได้ (ลบตัวเอง/มีประวัติทำรายการ) โดยไม่แก้ state
  removeUser: (id: string) => void;
  upsertBrand: (input: Partial<Brand> & { id?: string }) => string;
  upsertColorCode: (code: string, thaiName: string) => string;
  upsertCustomSize: (label: string) => string;
  upsertProductShape: (label: string) => string;
  setSupplierImages: (supplierId: string, images: Omit<SupplierImage, "supplierId">[]) => void;

  createProduct: (input: Omit<Product, "id" | "createdAt" | "updatedAt">) => string;
  updateProduct: (id: string, input: Partial<Product>) => void;
  setProductStatus: (id: string, status: Product["status"]) => void;
  removeProduct: (id: string) => void;
  addVariant: (productId: string, input: Parameters<typeof engine.addVariant>[2]) => string;
  updateVariant: (variantId: string, input: Partial<ProductVariant>) => void;
  removeVariant: (variantId: string) => void;
  regenerateProductSkus: (productId: string) => number;

  upsertEquipmentType: (code: string, labelTh: string) => string;
  createEquipment: (input: Omit<Equipment, "id" | "createdAt" | "updatedAt">) => string;
  updateEquipment: (id: string, input: Partial<Equipment>) => void;
  removeEquipment: (id: string) => void;

  stockIn: (input: engine.StockInInput) => ReturnType<typeof engine.stockIn>;
  stockOut: (input: engine.StockOutInput) => ReturnType<typeof engine.stockOut>;
  createTransfer: (input: engine.TransferInput) => string;
  receiveTransfer: (transferId: string, receiverId: string, receiverName: string) => void;
  cancelTransfer: (transferId: string, reason: string | undefined, actorId: string, actorName: string) => void;
  cancelOrder: (orderId: string, reason: string, actorId: string, actorName: string) => void;
  adjustStock: (input: Parameters<typeof engine.adjustStock>[1]) => void;
  mintUnitTokens: (variantId: string, qty: number) => ReturnType<typeof engine.mintUnitTokens>;
  recordUnitScanIn: (tokenId: string) => ReturnType<typeof engine.recordUnitScan>;
  recordUnitScanOut: (tokenId: string) => ReturnType<typeof engine.recordUnitScan>;
  setReservation: (itemType: "product" | "equipment", itemId: string, warehouseId: string, qty: number) => void;
  addEditedNote: (movementId: string, note: string) => void;
  createInvoice: (input: engine.CreateInvoiceInput) => ReturnType<typeof engine.createInvoice>;
  updateCompanyInfo: (patch: Partial<CompanyInfo>) => void;
  updateStorefrontSettings: (patch: Partial<StorefrontSettings>) => void;
  upsertPoSignatory: (name: string) => string;

  createRequisition: (input: engine.RequisitionInput) => string;
  approveRequisition: (reqId: string, approverId: string, approverName: string) => void;
  rejectRequisition: (reqId: string, approverId: string, approverName: string, reason: string) => void;
  cancelRequisition: (reqId: string) => void;
  markNotificationRead: (notificationId: string) => void;
}

export type Store = AppState & { actions: Actions };
type SetFn = (fn: (state: Store) => Store) => void;
type GetFn = () => Store;

// บันทึกส่วนต่างของ state ลง Supabase แบบ fire-and-forget เพื่อให้ UI ตอบสนองทันทีจาก
// การคำนวณใน engine.ts (sync, in-memory) โดยไม่ต้องรอผลลัพธ์จากเครือข่าย
// ต่อคิวให้ทำงานทีละรายการตามลำดับเดิมเสมอ (ไม่ใช่ยิงพร้อมกัน) เพราะบาง action
// ต่อเนื่องกัน (เช่น สร้างสินค้าแล้วเพิ่มตัวเลือกหลายตัวติดกัน) มี foreign key อ้างอิงกัน
// ถ้ายิงพร้อมกันอาจเกิด race ที่แถวลูกถูกบันทึกก่อนแถวแม่จะถูกสร้างเสร็จ
let syncQueue: Promise<void> = Promise.resolve();

function persistDiff(prev: AppState, next: AppState) {
  syncQueue = syncQueue.then(async () => {
    try {
      const supabase = createClient();
      await syncStateDiff(supabase, prev, next);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "บันทึกข้อมูลลงฐานข้อมูลไม่สำเร็จ");
    }
  });
}

function run<T>(set: SetFn, get: GetFn, fn: (draft: AppState) => T): T {
  const prevState = get();
  let result!: T;
  set((state) =>
    produce(state, (draft) => {
      result = fn(draft as unknown as AppState);
    })
  );
  persistDiff(prevState, get());
  return result;
}

function runChecked<T>(set: SetFn, get: GetFn, perm: Permission, fn: (draft: AppState) => T): T {
  const currentUser = get().users[get().currentUserId ?? ""];
  assertPermission(currentUser?.role, perm);
  return run(set, get, fn);
}

export const useStore = create<Store>()((set, get) => ({
  ...emptyState(),
  actions: {
    hydrate: (state) => set(() => ({ ...state })),
    mergeUnitTokens: (tokens) =>
      set((state) =>
        produce(state, (draft) => {
          for (const t of tokens) draft.unitTokens[t.id] = t;
        })
      ),
    login: (userId) =>
      set((state) =>
        produce(state, (draft) => {
          draft.currentUserId = userId;
        })
      ),
    logout: () =>
      set((state) =>
        produce(state, (draft) => {
          draft.currentUserId = null;
        })
      ),
    upsertWarehouse: (input) => runChecked(set, get, "master.write", (draft) => engine.upsertWarehouse(draft as never, input)),
    upsertSupplier: (input) => runChecked(set, get, "master.write", (draft) => engine.upsertSupplier(draft as never, input)),
    removeSupplier: (id) => runChecked(set, get, "master.write", (draft) => engine.removeSupplier(draft as never, id)),
    upsertUser: (input) => runChecked(set, get, "user.manage", (draft) => engine.upsertUser(draft as never, input)),
    mergeUser: (user) =>
      set((state) =>
        produce(state, (draft) => {
          draft.users[user.id] = user;
        })
      ),
    assertUserRemovable: (id) => {
      assertPermission(get().users[get().currentUserId ?? ""]?.role, "user.admin");
      produce(get() as AppState, (draft) => engine.removeUser(draft as never, id)); // ผลลัพธ์ทิ้งไป ใช้แค่ให้กฎใน engine โยน error
    },
    removeUser: (id) => {
      assertPermission(get().users[get().currentUserId ?? ""]?.role, "user.admin");
      set((state) => produce(state, (draft) => engine.removeUser(draft as never, id)));
    },
    upsertBrand: (input) => runChecked(set, get, "master.write", (draft) => engine.upsertBrand(draft as never, input)),
    upsertColorCode: (code, thaiName) => runChecked(set, get, "product.write", (draft) => engine.upsertColorCode(draft as never, code, thaiName)),
    upsertCustomSize: (label) => runChecked(set, get, "product.write", (draft) => engine.upsertCustomSize(draft as never, label)),
    upsertProductShape: (label) => runChecked(set, get, "product.write", (draft) => engine.upsertProductShape(draft as never, label)),
    setSupplierImages: (supplierId, images) => runChecked(set, get, "master.write", (draft) => engine.setSupplierImages(draft as never, supplierId, images)),
    createProduct: (input) => runChecked(set, get, "product.write", (draft) => engine.createProduct(draft as never, input)),
    updateProduct: (id, input) => runChecked(set, get, "product.write", (draft) => engine.updateProduct(draft as never, id, input)),
    setProductStatus: (id, status) => runChecked(set, get, "product.write", (draft) => engine.setProductStatus(draft as never, id, status)),
    removeProduct: (id) => runChecked(set, get, "product.write", (draft) => engine.removeProduct(draft as never, id)),
    addVariant: (productId, input) => runChecked(set, get, "product.write", (draft) => engine.addVariant(draft as never, productId, input)),
    updateVariant: (variantId, input) => runChecked(set, get, "product.write", (draft) => engine.updateVariant(draft as never, variantId, input)),
    removeVariant: (variantId) => runChecked(set, get, "product.write", (draft) => engine.removeVariant(draft as never, variantId)),
    regenerateProductSkus: (productId) => runChecked(set, get, "product.write", (draft) => engine.regenerateProductSkus(draft as never, productId)),
    upsertEquipmentType: (code, labelTh) => runChecked(set, get, "equipment.write", (draft) => engine.upsertEquipmentType(draft as never, code, labelTh)),
    createEquipment: (input) => runChecked(set, get, "equipment.write", (draft) => engine.createEquipment(draft as never, input)),
    updateEquipment: (id, input) => runChecked(set, get, "equipment.write", (draft) => engine.updateEquipment(draft as never, id, input)),
    removeEquipment: (id) => runChecked(set, get, "equipment.write", (draft) => engine.removeEquipment(draft as never, id)),
    stockIn: (input) =>
      runChecked(set, get, input.itemType === "product" ? "stock.in" : "equipment.write", (draft) => engine.stockIn(draft as never, input)),
    stockOut: (input) =>
      runChecked(set, get, input.reasonType === "sale" ? "order.create" : "stock.out", (draft) => engine.stockOut(draft as never, input)),
    createTransfer: (input) => runChecked(set, get, "stock.transfer", (draft) => engine.createTransfer(draft as never, input).id),
    receiveTransfer: (transferId, receiverId, receiverName) =>
      runChecked(set, get, "stock.transfer", (draft) => engine.receiveTransfer(draft as never, transferId, receiverId, receiverName)),
    cancelTransfer: (transferId, reason, actorId, actorName) =>
      runChecked(set, get, "stock.transfer", (draft) => engine.cancelTransfer(draft as never, transferId, reason, actorId, actorName)),
    cancelOrder: (orderId, reason, actorId, actorName) =>
      runChecked(set, get, "order.cancel", (draft) => engine.cancelOrder(draft as never, orderId, reason, actorId, actorName)),
    adjustStock: (input) => runChecked(set, get, "stock.adjust", (draft) => engine.adjustStock(draft as never, input)),
    mintUnitTokens: (variantId, qty) => runChecked(set, get, "product.write", (draft) => engine.mintUnitTokens(draft as never, variantId, qty)),
    recordUnitScanIn: (tokenId) => runChecked(set, get, "stock.in", (draft) => engine.recordUnitScan(draft as never, { tokenId, action: "in" })),
    recordUnitScanOut: (tokenId) => runChecked(set, get, "stock.out", (draft) => engine.recordUnitScan(draft as never, { tokenId, action: "out" })),
    setReservation: (itemType, itemId, warehouseId, qty) =>
      run(set, get, (draft) => engine.setReservation(draft as never, itemType, itemId, warehouseId, qty)),
    addEditedNote: (movementId, note) => runChecked(set, get, "settings.write", (draft) => engine.addEditedNote(draft as never, movementId, note)),
    createInvoice: (input) => runChecked(set, get, "order.create", (draft) => engine.createInvoice(draft as never, input)),
    updateCompanyInfo: (patch) => runChecked(set, get, "settings.write", (draft) => engine.updateCompanyInfo(draft as never, patch)),
    updateStorefrontSettings: (patch) =>
      runChecked(set, get, "settings.write", (draft) => engine.updateStorefrontSettings(draft as never, patch)),
    upsertPoSignatory: (name) => runChecked(set, get, "stock.in", (draft) => engine.upsertPoSignatory(draft as never, name)),

    createRequisition: (input) => runChecked(set, get, "requisition.create", (draft) => engine.createRequisition(draft as never, input).id),
    approveRequisition: (reqId, approverId, approverName) =>
      runChecked(set, get, "requisition.approve", (draft) => engine.approveRequisition(draft as never, reqId, approverId, approverName)),
    rejectRequisition: (reqId, approverId, approverName, reason) =>
      runChecked(set, get, "requisition.approve", (draft) => engine.rejectRequisition(draft as never, reqId, approverId, approverName, reason)),
    cancelRequisition: (reqId) => run(set, get, (draft) => engine.cancelRequisition(draft as never, reqId)),
    markNotificationRead: (notificationId) => run(set, get, (draft) => engine.markNotificationRead(draft as never, notificationId)),
  },
}));

export function useActions(): Actions {
  return useStore((s) => s.actions);
}
