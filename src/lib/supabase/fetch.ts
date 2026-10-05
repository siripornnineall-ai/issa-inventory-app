import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppState } from "@/lib/store/state";
import type {
  AppNotification,
  AppUser,
  Brand,
  ColorCode,
  CompanyInfo,
  CustomSize,
  Equipment,
  EquipmentRequisition,
  EquipmentType,
  EquipmentTypeOption,
  EquipmentUnit,
  Invoice,
  MovementItemType,
  MovementType,
  Order,
  OrderLine,
  PoSignatory,
  Product,
  ProductImage,
  ProductShapeOption,
  ProductStatus,
  ProductVariant,
  RequisitionStatus,
  SalesChannel,
  StockDocLine,
  StockInDoc,
  StockLevel,
  StockMovement,
  StockOutDoc,
  StorefrontSettings,
  Supplier,
  SupplierCategory,
  SupplierImage,
  Transfer,
  TransferStatus,
  UnitToken,
  UnitTokenAction,
  UserRole,
  Warehouse,
} from "@/lib/types";
import { DEFAULT_STOREFRONT_SETTINGS } from "@/lib/store/state";
import { normalizeUnitCode, UNIT_CODE_PATTERN } from "@/lib/store/engine";

// แปลงชื่อคอลัมน์ snake_case จาก Supabase ให้เป็น AppState ที่ UI ใช้อยู่ (camelCase)

function stockKey(itemId: string, warehouseId: string): string {
  return `${itemId}::${warehouseId}`;
}

// product_images เก็บรูปเป็น base64 data URL ในคอลัมน์ url (บางแถวหนักเป็น MB) การ select("*") รวดเดียว
// ทำให้ Postgres ต้องรวม json_agg() บนข้อมูลหลายสิบ MB ในคำสั่งเดียว ซึ่งช้าพอจะชน statement_timeout ได้เมื่อข้อมูลเยอะขึ้น
// จึงต้องแบ่งดึงเป็นหน้าเล็ก ๆ แทน เพื่อให้แต่ละคำสั่ง SQL เร็วพอ
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchProductImagesPaginated(supabase: SupabaseClient, pageSize = 15): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("product_images")
      .select("*")
      // ต้อง order ให้แน่นอน ไม่งั้นแบ่งหน้าแล้วแต่ละหน้าอาจซ้ำ/ตกหล่นรูป
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

// สแกน QR อาจเจอโทเคนที่เพิ่งปริ้นจากอุปกรณ์/แท็บอื่น (เช่น ปริ้นจากคอมแล้วสแกนด้วยมือถือ) ซึ่งข้อมูลในเครื่อง
// เครื่องนี้ยังไม่มี (โหลด state ครั้งเดียวตอนเปิดแอป ไม่ได้ sync แบบเรียลไทม์ข้ามอุปกรณ์) จึงต้อง fallback
// ไปถามฐานข้อมูลตรง ๆ เฉพาะโทเคนนั้นก่อนจะสรุปว่า "ไม่พบ"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UnitTokenRow = { id: string; code?: string | null; variant_id: string; last_action?: string | null; last_action_at?: string | null; created_at: string };

function rowToUnitToken(row: UnitTokenRow): UnitToken {
  return {
    id: row.id,
    code: row.code ?? undefined,
    variantId: row.variant_id,
    lastAction: (row.last_action ?? undefined) as UnitTokenAction | undefined,
    lastActionAt: row.last_action_at ?? undefined,
    createdAt: row.created_at,
  };
}

// รับได้ทั้ง id เต็ม (จาก QR) และรหัสสั้น 8 ตัว (จากบาร์โค้ด) — ถ้าเป็นรูปแบบอื่นคืน null โดยไม่ยิงคำสั่งไปฐานข้อมูล
export async function fetchUnitTokenByScan(supabase: SupabaseClient, value: string): Promise<UnitToken | null> {
  const trimmed = value.trim();
  const base = supabase.from("unit_tokens").select("*");
  let query;
  if (UUID_PATTERN.test(trimmed)) {
    query = base.eq("id", trimmed);
  } else {
    const code = normalizeUnitCode(trimmed);
    if (!UNIT_CODE_PATTERN.test(code)) return null;
    query = base.eq("code", code);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return rowToUnitToken(data as UnitTokenRow);
}

// Supabase/PostgREST ตัดผลลัพธ์ที่ 1,000 แถวต่อคำสั่ง (ไม่ error ไม่เตือน แค่ส่งมาไม่ครบ)
// เมื่อ product_variants/variant_stock เกิน 1,000 แถว สินค้าใหม่ ๆ จึงขึ้น "0 ตัวเลือก" ทั้งที่ข้อมูลอยู่ครบในฐานข้อมูล
// ดึงทีละหน้าตามลำดับคีย์หลัก (ต้อง order ให้แน่นอน ไม่งั้นแต่ละหน้าอาจซ้ำ/ตกหล่น) จนกว่าจะได้หน้าที่ไม่เต็ม
export const FETCH_PAGE_SIZE = 1000;

export async function fetchAllRows(
  supabase: SupabaseClient,
  table: string,
  orderBy: string[],
  pageSize = FETCH_PAGE_SIZE
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ data: any[]; error: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select("*");
    for (const col of orderBy) query = query.order(col, { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) return { data: [], error };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
}

export async function fetchAppState(supabase: SupabaseClient): Promise<AppState> {
  const productImagesPromise = fetchProductImagesPaginated(supabase);

  const [
    profilesRes,
    warehousesRes,
    suppliersRes,
    supplierImagesRes,
    brandsRes,
    colorCodesRes,
    customSizesRes,
    productShapeOptionsRes,
    productsRes,
    variantsRes,
    variantStockRes,
    equipmentRes,
    equipmentImagesRes,
    equipmentStockRes,
    equipmentTypeOptionsRes,
    equipmentRequisitionsRes,
    notificationsRes,
    movementsRes,
    stockInDocsRes,
    stockInLinesRes,
    stockOutDocsRes,
    stockOutLinesRes,
    transfersRes,
    transferLinesRes,
    ordersRes,
    orderLinesRes,
    companyInfoRes,
    storefrontSettingsRes,
    poSignatoriesRes,
    invoicesRes,
    unitTokensRes,
  ] = await Promise.all([
    fetchAllRows(supabase, "profiles", ["created_at", "id"]),
    fetchAllRows(supabase, "warehouses", ["created_at", "id"]),
    fetchAllRows(supabase, "suppliers", ["created_at", "id"]),
    fetchAllRows(supabase, "supplier_images", ["sort_order", "id"]),
    fetchAllRows(supabase, "brands", ["created_at", "id"]),
    fetchAllRows(supabase, "color_codes", ["created_at", "code"]),
    fetchAllRows(supabase, "custom_sizes", ["sort_order", "id"]),
    fetchAllRows(supabase, "product_shape_options", ["sort_order", "id"]),
    fetchAllRows(supabase, "products", ["created_at", "id"]),
    fetchAllRows(supabase, "product_variants", ["created_at", "id"]),
    fetchAllRows(supabase, "variant_stock", ["variant_id", "warehouse_id"]),
    fetchAllRows(supabase, "equipment", ["created_at", "id"]),
    fetchAllRows(supabase, "equipment_images", ["sort_order", "id"]),
    fetchAllRows(supabase, "equipment_stock", ["equipment_id", "warehouse_id"]),
    fetchAllRows(supabase, "equipment_type_options", ["sort_order", "code"]),
    fetchAllRows(supabase, "equipment_requisitions", ["created_at", "id"]),
    fetchAllRows(supabase, "notifications", ["created_at", "id"]),
    fetchAllRows(supabase, "stock_movements", ["created_at", "id"]),
    fetchAllRows(supabase, "stock_in_docs", ["created_at", "id"]),
    fetchAllRows(supabase, "stock_in_lines", ["created_at", "id"]),
    fetchAllRows(supabase, "stock_out_docs", ["created_at", "id"]),
    fetchAllRows(supabase, "stock_out_lines", ["created_at", "id"]),
    fetchAllRows(supabase, "transfers", ["created_at", "id"]),
    fetchAllRows(supabase, "transfer_lines", ["created_at", "id"]),
    fetchAllRows(supabase, "orders", ["created_at", "id"]),
    fetchAllRows(supabase, "order_lines", ["created_at", "id"]),
    fetchAllRows(supabase, "company_info", ["id"]),
    fetchAllRows(supabase, "storefront_settings", ["id"]),
    fetchAllRows(supabase, "po_signatories", ["created_at", "id"]),
    fetchAllRows(supabase, "invoices", ["created_at", "id"]),
    fetchAllRows(supabase, "unit_tokens", ["created_at", "id"]),
  ]);
  const productImagesRows = await productImagesPromise;

  for (const res of [
    profilesRes,
    warehousesRes,
    suppliersRes,
    supplierImagesRes,
    brandsRes,
    colorCodesRes,
    customSizesRes,
    productShapeOptionsRes,
    productsRes,
    variantsRes,
    variantStockRes,
    equipmentRes,
    equipmentImagesRes,
    equipmentStockRes,
    equipmentTypeOptionsRes,
    equipmentRequisitionsRes,
    notificationsRes,
    movementsRes,
    stockInDocsRes,
    stockInLinesRes,
    stockOutDocsRes,
    stockOutLinesRes,
    transfersRes,
    transferLinesRes,
    ordersRes,
    orderLinesRes,
    companyInfoRes,
    storefrontSettingsRes,
    poSignatoriesRes,
    invoicesRes,
    unitTokensRes,
  ]) {
    if (res.error) throw res.error;
  }

  const users: Record<string, AppUser> = {};
  for (const row of profilesRes.data ?? []) {
    users[row.id] = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as UserRole,
      active: row.active,
      avatarUrl: row.avatar_url ?? undefined,
      mustChangePassword: row.must_change_password === true ? true : undefined,
      createdAt: row.created_at,
    };
  }

  const warehouses: Record<string, Warehouse> = {};
  for (const row of warehousesRes.data ?? []) {
    warehouses[row.id] = {
      id: row.id,
      name: row.name,
      type: row.type as Warehouse["type"],
      address: row.address ?? undefined,
      active: row.active,
      createdAt: row.created_at,
    };
  }

  const suppliers: Record<string, Supplier> = {};
  for (const row of suppliersRes.data ?? []) {
    suppliers[row.id] = {
      id: row.id,
      name: row.name,
      category: row.category as SupplierCategory,
      contactName: row.contact_name ?? undefined,
      phone: row.phone ?? undefined,
      line: row.line ?? undefined,
      email: row.email ?? undefined,
      address: row.address ?? undefined,
      taxId: row.tax_id ?? undefined,
      paymentTerms: row.payment_terms ?? undefined,
      leadTimeDays: row.lead_time_days ?? undefined,
      note: row.note ?? undefined,
      active: row.active,
      createdAt: row.created_at,
    };
  }

  const supplierImages: Record<string, SupplierImage> = {};
  for (const row of supplierImagesRes.data ?? []) {
    supplierImages[row.id] = {
      id: row.id,
      supplierId: row.supplier_id,
      url: row.url,
      isMain: row.is_main,
      sortOrder: row.sort_order,
    };
  }

  const brands: Record<string, Brand> = {};
  for (const row of brandsRes.data ?? []) {
    brands[row.id] = { id: row.id, name: row.name, code: row.code, active: row.active, logoUrl: row.logo_url ?? undefined, createdAt: row.created_at };
  }

  const colorCodes: Record<string, ColorCode> = {};
  for (const row of colorCodesRes.data ?? []) {
    colorCodes[row.code] = { code: row.code, thaiName: row.thai_name, createdAt: row.created_at };
  }

  const customSizes: Record<string, CustomSize> = {};
  for (const row of customSizesRes.data ?? []) {
    customSizes[row.id] = { id: row.id, label: row.label, sortOrder: row.sort_order, createdAt: row.created_at };
  }

  const productShapeOptions: Record<string, ProductShapeOption> = {};
  for (const row of productShapeOptionsRes.data ?? []) {
    productShapeOptions[row.id] = { id: row.id, label: row.label, sortOrder: row.sort_order, createdAt: row.created_at };
  }

  const imagesByProduct = new Map<string, ProductImage[]>();
  for (const row of productImagesRows) {
    const list = imagesByProduct.get(row.product_id) ?? [];
    list.push({ id: row.id, url: row.url, isMain: row.is_main, sortOrder: row.sort_order, kind: row.kind, color: row.color ?? undefined });
    imagesByProduct.set(row.product_id, list);
  }

  const products: Record<string, Product> = {};
  for (const row of productsRes.data ?? []) {
    products[row.id] = {
      id: row.id,
      sourceSupplierId: row.source_supplier_id ?? undefined,
      sourceModelName: row.source_model_name ?? undefined,
      sourcePurchasePrice: row.source_purchase_price ?? undefined,
      sourceDescription: row.source_description ?? undefined,
      sourceCode: row.source_code ?? undefined,
      firstReceivedDate: row.first_received_date ?? undefined,
      sourceNote: row.source_note ?? undefined,
      sellingName: row.selling_name,
      sellingPrice: Number(row.selling_price),
      sellingDescription: row.selling_description ?? undefined,
      category: row.category,
      status: row.status as ProductStatus,
      sellStartDate: row.sell_start_date ?? undefined,
      images: (imagesByProduct.get(row.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      brandId: row.brand_id ?? undefined,
      modelCode: row.model_code ?? undefined,
      shape: row.shape ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const variants: Record<string, ProductVariant> = {};
  for (const row of variantsRes.data ?? []) {
    variants[row.id] = {
      id: row.id,
      productId: row.product_id,
      color: row.color,
      size: row.size,
      sku: row.sku,
      purchasePrice: Number(row.purchase_price),
      sellingPrice: Number(row.selling_price),
      reorderPoint: row.reorder_point,
      storageLocation: row.storage_location ?? undefined,
      active: row.active,
      isDefective: row.is_defective,
    };
  }

  const variantStock: Record<string, StockLevel> = {};
  for (const row of variantStockRes.data ?? []) {
    variantStock[stockKey(row.variant_id, row.warehouse_id)] = {
      itemId: row.variant_id,
      warehouseId: row.warehouse_id,
      qtyOnHand: row.qty_on_hand,
      qtyReserved: row.qty_reserved,
    };
  }

  const imagesByEquipment = new Map<string, ProductImage[]>();
  for (const row of equipmentImagesRes.data ?? []) {
    const list = imagesByEquipment.get(row.equipment_id) ?? [];
    list.push({ id: row.id, url: row.url, isMain: row.is_main, sortOrder: row.sort_order, kind: "selling" });
    imagesByEquipment.set(row.equipment_id, list);
  }

  const equipment: Record<string, Equipment> = {};
  for (const row of equipmentRes.data ?? []) {
    equipment[row.id] = {
      id: row.id,
      name: row.name,
      code: row.code,
      type: row.type as EquipmentType,
      description: row.description ?? undefined,
      images: (imagesByEquipment.get(row.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      supplierId: row.supplier_id ?? undefined,
      purchasePricePerUnit: Number(row.purchase_price_per_unit),
      unit: row.unit as EquipmentUnit,
      reorderPoint: row.reorder_point,
      reorderQty: row.reorder_qty,
      storageLocation: row.storage_location ?? undefined,
      status: row.status as Equipment["status"],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const equipmentTypeOptions: Record<string, EquipmentTypeOption> = {};
  for (const row of equipmentTypeOptionsRes.data ?? []) {
    equipmentTypeOptions[row.code] = {
      code: row.code,
      labelTh: row.label_th,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    };
  }

  const equipmentStock: Record<string, StockLevel> = {};
  for (const row of equipmentStockRes.data ?? []) {
    equipmentStock[stockKey(row.equipment_id, row.warehouse_id)] = {
      itemId: row.equipment_id,
      warehouseId: row.warehouse_id,
      qtyOnHand: row.qty_on_hand,
      qtyReserved: 0,
    };
  }

  const equipmentRequisitions: Record<string, EquipmentRequisition> = {};
  for (const row of equipmentRequisitionsRes.data ?? []) {
    equipmentRequisitions[row.id] = {
      id: row.id,
      reqNo: row.req_no,
      requesterId: row.requester_id,
      requesterName: row.requester_name,
      department: row.department ?? undefined,
      equipmentId: row.equipment_id,
      qtyRequested: row.qty_requested,
      stockSnapshot: row.stock_snapshot,
      reason: row.reason ?? undefined,
      note: row.note ?? undefined,
      status: row.status as RequisitionStatus,
      approverId: row.approver_id ?? undefined,
      approverName: row.approver_name ?? undefined,
      decidedAt: row.decided_at ?? undefined,
      rejectReason: row.reject_reason ?? undefined,
      createdAt: row.created_at,
    };
  }

  const notifications: Record<string, AppNotification> = {};
  for (const row of notificationsRes.data ?? []) {
    notifications[row.id] = {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body ?? undefined,
      link: row.link ?? undefined,
      read: row.read,
      createdAt: row.created_at,
    };
  }

  const movements: Record<string, StockMovement> = {};
  for (const row of movementsRes.data ?? []) {
    movements[row.id] = {
      id: row.id,
      createdAt: row.created_at,
      refNo: row.ref_no,
      itemType: row.item_type as MovementItemType,
      itemId: row.item_id,
      variantId: row.variant_id ?? undefined,
      itemName: row.item_name,
      sku: row.sku,
      color: row.color ?? undefined,
      size: row.size ?? undefined,
      movementType: row.movement_type as MovementType,
      qtyChange: row.qty_change,
      qtyBefore: row.qty_before,
      qtyAfter: row.qty_after,
      warehouseFromId: row.warehouse_from_id ?? undefined,
      warehouseToId: row.warehouse_to_id ?? undefined,
      actorId: row.actor_id ?? "",
      actorName: row.actor_name,
      reason: row.reason ?? undefined,
      note: row.note ?? undefined,
      relatedDocNo: row.related_doc_no ?? undefined,
      editedNote: row.edited_note ?? undefined,
    };
  }

  const linesByStockInDoc = new Map<string, StockDocLine[]>();
  for (const row of stockInLinesRes.data ?? []) {
    const list = linesByStockInDoc.get(row.doc_id) ?? [];
    list.push({ id: row.id, itemId: row.item_id, variantId: row.variant_id ?? undefined, qty: row.qty, unitCost: row.unit_cost ?? undefined });
    linesByStockInDoc.set(row.doc_id, list);
  }
  const stockInDocs: Record<string, StockInDoc> = {};
  for (const row of stockInDocsRes.data ?? []) {
    stockInDocs[row.id] = {
      id: row.id,
      docNo: row.doc_no,
      date: row.date,
      itemType: row.item_type as MovementItemType,
      supplierId: row.supplier_id ?? undefined,
      poNumber: row.po_number ?? undefined,
      issuePo: row.issue_po ?? false,
      issuedByName: row.issued_by_name ?? undefined,
      approvedByName: row.approved_by_name ?? undefined,
      billNumber: row.bill_number ?? undefined,
      receiptImages: row.receipt_images ?? [],
      warehouseId: row.warehouse_id,
      lines: linesByStockInDoc.get(row.id) ?? [],
      receivedBy: row.received_by ?? "",
      note: row.note ?? undefined,
      status: row.status as StockInDoc["status"],
      createdAt: row.created_at,
    };
  }

  const linesByStockOutDoc = new Map<string, StockDocLine[]>();
  for (const row of stockOutLinesRes.data ?? []) {
    const list = linesByStockOutDoc.get(row.doc_id) ?? [];
    list.push({ id: row.id, itemId: row.item_id, variantId: row.variant_id ?? undefined, qty: row.qty });
    linesByStockOutDoc.set(row.doc_id, list);
  }
  const stockOutDocs: Record<string, StockOutDoc> = {};
  for (const row of stockOutDocsRes.data ?? []) {
    stockOutDocs[row.id] = {
      id: row.id,
      docNo: row.doc_no,
      date: row.date,
      itemType: row.item_type as MovementItemType,
      reasonType: row.reason_type as MovementType,
      warehouseId: row.warehouse_id,
      lines: linesByStockOutDoc.get(row.id) ?? [],
      actorId: row.actor_id ?? "",
      note: row.note ?? undefined,
      status: row.status as StockOutDoc["status"],
      createdAt: row.created_at,
    };
  }

  const linesByTransfer = new Map<string, StockDocLine[]>();
  for (const row of transferLinesRes.data ?? []) {
    const list = linesByTransfer.get(row.transfer_id) ?? [];
    list.push({ id: row.id, itemId: row.item_id, variantId: row.variant_id ?? undefined, qty: row.qty });
    linesByTransfer.set(row.transfer_id, list);
  }
  const transfers: Record<string, Transfer> = {};
  for (const row of transfersRes.data ?? []) {
    transfers[row.id] = {
      id: row.id,
      transferNo: row.transfer_no,
      itemType: row.item_type as MovementItemType,
      date: row.date,
      fromWarehouseId: row.from_warehouse_id,
      toWarehouseId: row.to_warehouse_id,
      lines: linesByTransfer.get(row.id) ?? [],
      senderId: row.sender_id ?? "",
      receiverId: row.receiver_id ?? undefined,
      note: row.note ?? undefined,
      status: row.status as TransferStatus,
      createdAt: row.created_at,
      receivedAt: row.received_at ?? undefined,
      cancelledAt: row.cancelled_at ?? undefined,
    };
  }

  const linesByOrder = new Map<string, OrderLine[]>();
  for (const row of orderLinesRes.data ?? []) {
    const list = linesByOrder.get(row.order_id) ?? [];
    list.push({
      id: row.id,
      productId: row.product_id,
      variantId: row.variant_id,
      qty: row.qty,
      unitPrice: Number(row.unit_price),
      discount: Number(row.discount),
    });
    linesByOrder.set(row.order_id, list);
  }
  const orders: Record<string, Order> = {};
  for (const row of ordersRes.data ?? []) {
    orders[row.id] = {
      id: row.id,
      orderNo: row.order_no,
      date: row.date,
      channel: row.channel as SalesChannel,
      brandId: row.brand_id ?? undefined,
      warehouseId: row.warehouse_id,
      lines: linesByOrder.get(row.id) ?? [],
      status: row.status as Order["status"],
      note: row.note ?? undefined,
      cancelReason: row.cancel_reason ?? undefined,
      cancelledAt: row.cancelled_at ?? undefined,
      restocked: row.restocked,
      createdAt: row.created_at,
    };
  }

  const invoices: Record<string, Invoice> = {};
  for (const row of invoicesRes.data ?? []) {
    invoices[row.id] = {
      id: row.id,
      invoiceNo: row.invoice_no,
      date: row.date,
      orderIds: row.order_ids ?? [],
      buyerName: row.buyer_name,
      buyerAddress: row.buyer_address ?? undefined,
      buyerTaxId: row.buyer_tax_id ?? undefined,
      note: row.note ?? undefined,
      createdAt: row.created_at,
    };
  }

  const companyInfoRow = companyInfoRes.data?.[0];
  const companyInfo: CompanyInfo = {
    name: companyInfoRow?.name ?? "ISSA Apparel",
    address: companyInfoRow?.address ?? undefined,
    phone: companyInfoRow?.phone ?? undefined,
    taxId: companyInfoRow?.tax_id ?? undefined,
  };

  const storefrontSettingsRow = storefrontSettingsRes.data?.[0];
  const storefrontSettings: StorefrontSettings = storefrontSettingsRow
    ? {
        announcementText: storefrontSettingsRow.announcement_text,
        heroHeadingLine1: storefrontSettingsRow.hero_heading_line1,
        heroHeadingLine2: storefrontSettingsRow.hero_heading_line2,
        heroTagline: storefrontSettingsRow.hero_tagline,
        promoHeadingLine1: storefrontSettingsRow.promo_heading_line1,
        promoHeadingLine2: storefrontSettingsRow.promo_heading_line2,
        promoSubtext: storefrontSettingsRow.promo_subtext,
        contactPhone: storefrontSettingsRow.contact_phone,
        socialLine: storefrontSettingsRow.social_line,
        socialFacebook: storefrontSettingsRow.social_facebook,
        socialInstagram: storefrontSettingsRow.social_instagram,
        socialTiktok: storefrontSettingsRow.social_tiktok,
        heroImageUrl: storefrontSettingsRow.hero_image_url,
        promoImageUrl: storefrontSettingsRow.promo_image_url,
      }
    : { ...DEFAULT_STOREFRONT_SETTINGS };

  const poSignatories: Record<string, PoSignatory> = {};
  for (const row of poSignatoriesRes.data ?? []) {
    poSignatories[row.id] = { id: row.id, name: row.name, createdAt: row.created_at };
  }

  const unitTokens: Record<string, UnitToken> = {};
  for (const row of unitTokensRes.data ?? []) {
    unitTokens[row.id] = rowToUnitToken(row as UnitTokenRow);
  }

  // เริ่มลำดับเลขที่เอกสารต่อจากของเดิม เพื่อไม่ให้เลขซ้ำกับที่มีอยู่แล้วในฐานข้อมูล
  const docSeq: Record<string, number> = {};
  const allDocNos = [
    ...Object.values(stockInDocs).map((d) => d.docNo),
    ...Object.values(stockInDocs).map((d) => d.poNumber).filter((v): v is string => Boolean(v)),
    ...Object.values(stockOutDocs).map((d) => d.docNo),
    ...Object.values(transfers).map((t) => t.transferNo),
    ...Object.values(orders).map((o) => o.orderNo),
    ...Object.values(invoices).map((i) => i.invoiceNo),
    ...Object.values(equipmentRequisitions).map((r) => r.reqNo),
  ];
  for (const docNo of allDocNos) {
    const match = docNo.match(/^([A-Z]+)-\d{8}-(\d+)$/);
    if (!match) continue;
    const [, prefix, seqStr] = match;
    const seq = Number(seqStr);
    if (!docSeq[prefix] || seq > docSeq[prefix]) docSeq[prefix] = seq;
  }

  return {
    users,
    currentUserId: null,
    warehouses,
    suppliers,
    supplierImages,
    brands,
    colorCodes,
    customSizes,
    products,
    productShapeOptions,
    variants,
    variantStock,
    equipment,
    equipmentStock,
    equipmentTypeOptions,
    equipmentRequisitions,
    notifications,
    movements,
    stockInDocs,
    stockOutDocs,
    transfers,
    orders,
    invoices,
    docSeq,
    companyInfo,
    storefrontSettings,
    poSignatories,
    unitTokens,
    seededAt: new Date().toISOString(),
  };
}
