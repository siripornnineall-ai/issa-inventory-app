import type { PostgrestSingleResponse, SupabaseClient } from "@supabase/supabase-js";
import type { AppState } from "@/lib/store/state";
import type { Invoice, Order, Product, ProductImage, StockInDoc, StockOutDoc, Transfer, UnitToken } from "@/lib/types";

// เปรียบเทียบ state ก่อน/หลังการทำรายการ แล้วบันทึกส่วนต่างลง Supabase (write-through)
// ทำให้ engine.ts (business logic) ยังทำงานแบบ sync ในหน่วยความจำเหมือนเดิมทุกประการ
// ส่วนการเชื่อมต่อฐานข้อมูลจริงแยกออกมาที่นี่ที่เดียว

// supabase-js resolve (ไม่ reject) แม้เกิด error จากฐานข้อมูล/RLS ต้องเช็ค .error เองแล้วโยน
// เป็น rejection จริง ๆ ไม่งั้น Promise.allSettled ด้านล่างจะไม่เห็นความล้มเหลวเลย
async function check<T>(builder: PromiseLike<PostgrestSingleResponse<T>>): Promise<T | null> {
  const { data, error } = await builder;
  if (error) throw new Error(error.message);
  return data;
}

function diffRecords<T>(prev: Record<string, T>, next: Record<string, T>) {
  const added: T[] = [];
  const changed: T[] = [];
  const removedIds: string[] = [];
  for (const id of Object.keys(next)) {
    if (!(id in prev)) added.push(next[id]);
    else if (JSON.stringify(prev[id]) !== JSON.stringify(next[id])) changed.push(next[id]);
  }
  for (const id of Object.keys(prev)) {
    if (!(id in next)) removedIds.push(id);
  }
  return { added, changed, removedIds };
}

async function syncProductImages(supabase: SupabaseClient, productId: string, images: ProductImage[]) {
  await check(supabase.from("product_images").delete().eq("product_id", productId));
  if (images.length === 0) return;
  await check(
    supabase
      .from("product_images")
      .insert(images.map((img) => ({ id: img.id, product_id: productId, url: img.url, is_main: img.isMain, sort_order: img.sortOrder, kind: img.kind, color: img.color ?? null })))
  );
}

async function syncEquipmentImages(supabase: SupabaseClient, equipmentId: string, images: ProductImage[]) {
  await check(supabase.from("equipment_images").delete().eq("equipment_id", equipmentId));
  if (images.length === 0) return;
  await check(
    supabase.from("equipment_images").insert(images.map((img) => ({ id: img.id, equipment_id: equipmentId, url: img.url, is_main: img.isMain, sort_order: img.sortOrder })))
  );
}

function docDate(iso: string): string {
  return iso.slice(0, 10);
}

export async function syncStateDiff(supabase: SupabaseClient, prev: AppState, next: AppState): Promise<void> {
  const jobs: Promise<unknown>[] = [];

  const wh = diffRecords(prev.warehouses, next.warehouses);
  for (const w of [...wh.added, ...wh.changed]) {
    jobs.push(check(supabase.from("warehouses").upsert({ id: w.id, name: w.name, type: w.type, address: w.address ?? null, active: w.active, created_at: w.createdAt })));
  }

  // ลบคลัง: แถว variant_stock/equipment_stock ของคลังนั้นถูกฐานข้อมูลลบตามให้เอง (on delete cascade) ส่วนประวัติกันการลบด้วย foreign key
  for (const id of wh.removedIds) jobs.push(check(supabase.from("warehouses").delete().eq("id", id)));

  const brand = diffRecords(prev.brands, next.brands);
  for (const b of [...brand.added, ...brand.changed]) {
    jobs.push(check(supabase.from("brands").upsert({ id: b.id, name: b.name, code: b.code, active: b.active, logo_url: b.logoUrl ?? null, created_at: b.createdAt })));
  }

  const colorCode = diffRecords(prev.colorCodes, next.colorCodes);
  for (const c of [...colorCode.added, ...colorCode.changed]) {
    jobs.push(check(supabase.from("color_codes").upsert({ code: c.code, thai_name: c.thaiName, created_at: c.createdAt })));
  }

  const customSize = diffRecords(prev.customSizes, next.customSizes);
  for (const s of [...customSize.added, ...customSize.changed]) {
    jobs.push(check(supabase.from("custom_sizes").upsert({ id: s.id, label: s.label, sort_order: s.sortOrder, created_at: s.createdAt })));
  }

  const productShape = diffRecords(prev.productShapeOptions, next.productShapeOptions);
  for (const s of [...productShape.added, ...productShape.changed]) {
    jobs.push(check(supabase.from("product_shape_options").upsert({ id: s.id, label: s.label, sort_order: s.sortOrder, created_at: s.createdAt })));
  }

  const equipType = diffRecords(prev.equipmentTypeOptions, next.equipmentTypeOptions);
  for (const t of [...equipType.added, ...equipType.changed]) {
    jobs.push(check(supabase.from("equipment_type_options").upsert({ code: t.code, label_th: t.labelTh, sort_order: t.sortOrder, created_at: t.createdAt })));
  }

  const poSignatories = diffRecords(prev.poSignatories, next.poSignatories);
  for (const s of [...poSignatories.added, ...poSignatories.changed]) {
    jobs.push(check(supabase.from("po_signatories").upsert({ id: s.id, name: s.name, created_at: s.createdAt })));
  }

  const sup = diffRecords(prev.suppliers, next.suppliers);
  for (const s of [...sup.added, ...sup.changed]) {
    jobs.push(
      check(
        supabase.from("suppliers").upsert({
          id: s.id,
          name: s.name,
          category: s.category,
          contact_name: s.contactName ?? null,
          phone: s.phone ?? null,
          line: s.line ?? null,
          email: s.email ?? null,
          address: s.address ?? null,
          tax_id: s.taxId ?? null,
          payment_terms: s.paymentTerms ?? null,
          lead_time_days: s.leadTimeDays ?? null,
          note: s.note ?? null,
          active: s.active,
          created_at: s.createdAt,
        })
      )
    );
  }
  for (const id of sup.removedIds) jobs.push(check(supabase.from("suppliers").delete().eq("id", id)));

  const supImg = diffRecords(prev.supplierImages, next.supplierImages);
  for (const img of [...supImg.added, ...supImg.changed]) {
    jobs.push(
      check(
        supabase.from("supplier_images").upsert({ id: img.id, supplier_id: img.supplierId, url: img.url, is_main: img.isMain, sort_order: img.sortOrder })
      )
    );
  }
  for (const id of supImg.removedIds) jobs.push(check(supabase.from("supplier_images").delete().eq("id", id)));

  const usr = diffRecords(prev.users, next.users);
  for (const u of [...usr.added, ...usr.changed]) {
    jobs.push(
      check(
        supabase.from("profiles").upsert({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, avatar_url: u.avatarUrl ?? null, created_at: u.createdAt })
      )
    );
  }
  // หมายเหตุ: การสร้าง/ลบผู้ใช้งานไม่ผ่านที่นี่ — ทำผ่าน Edge Function admin-users (ต้องจัดการบัญชี Supabase Auth ด้วย)
  // แล้วค่อยอัปเดต state ในเครื่องด้วย mergeUser/removeUser ซึ่งไม่เรียก sync (ดู src/lib/store/index.ts)
  // และไม่ส่ง must_change_password ใน upsert ด้านบนโดยเจตนา เพื่อไม่ให้การแก้ชื่อ/บทบาทไปทับค่าธงนี้

  // แบรนด์/ผู้ใช้/ร้านค้าต้องเสร็จก่อนสินค้า เพราะ products.brand_id อ้างอิงถึง
  await Promise.all(jobs.splice(0));

  // สินค้า/ตัวเลือกสินค้าต้องเรียงลำดับ: บันทึกสินค้าให้เสร็จก่อน แล้วค่อยบันทึกตัวเลือก/สต็อก
  // เพราะ product_variants.product_id และ variant_stock.variant_id มี foreign key อ้างอิงกัน
  const prod = diffRecords(prev.products, next.products);
  for (const p of [...prod.added, ...prod.changed] as Product[]) {
    jobs.push(
      check(
        supabase.from("products").upsert({
          id: p.id,
          source_supplier_id: p.sourceSupplierId ?? null,
          source_model_name: p.sourceModelName ?? null,
          source_purchase_price: p.sourcePurchasePrice ?? null,
          source_description: p.sourceDescription ?? null,
          source_code: p.sourceCode ?? null,
          first_received_date: p.firstReceivedDate ?? null,
          source_note: p.sourceNote ?? null,
          selling_name: p.sellingName,
          selling_price: p.sellingPrice,
          selling_description: p.sellingDescription ?? null,
          category: p.category,
          status: p.status,
          sell_start_date: p.sellStartDate ?? null,
          brand_id: p.brandId ?? null,
          model_code: p.modelCode ?? null,
          shape: p.shape ?? null,
          created_at: p.createdAt,
          updated_at: p.updatedAt,
        })
      ).then(() => syncProductImages(supabase, p.id, p.images))
    );
  }
  for (const id of prod.removedIds) jobs.push(check(supabase.from("products").delete().eq("id", id)));
  await Promise.all(jobs.splice(0));

  const equip = diffRecords(prev.equipment, next.equipment);
  for (const e of [...equip.added, ...equip.changed]) {
    jobs.push(
      check(
        supabase.from("equipment").upsert({
          id: e.id,
          name: e.name,
          code: e.code,
          type: e.type,
          description: e.description ?? null,
          supplier_id: e.supplierId ?? null,
          purchase_price_per_unit: e.purchasePricePerUnit,
          unit: e.unit,
          reorder_point: e.reorderPoint,
          reorder_qty: e.reorderQty,
          storage_location: e.storageLocation ?? null,
          status: e.status,
          created_at: e.createdAt,
          updated_at: e.updatedAt,
        })
      ).then(() => syncEquipmentImages(supabase, e.id, e.images))
    );
  }
  for (const id of equip.removedIds) jobs.push(check(supabase.from("equipment").delete().eq("id", id)));
  await Promise.all(jobs.splice(0));

  const variant = diffRecords(prev.variants, next.variants);
  for (const v of [...variant.added, ...variant.changed]) {
    jobs.push(
      check(
        supabase.from("product_variants").upsert({
          id: v.id,
          product_id: v.productId,
          color: v.color,
          size: v.size,
          sku: v.sku,
          purchase_price: v.purchasePrice,
          selling_price: v.sellingPrice,
          reorder_point: v.reorderPoint,
          storage_location: v.storageLocation ?? null,
          active: v.active,
          is_defective: v.isDefective,
        })
      )
    );
  }
  for (const id of variant.removedIds) jobs.push(check(supabase.from("product_variants").delete().eq("id", id)));
  await Promise.all(jobs.splice(0));

  const vStock = diffRecords(prev.variantStock, next.variantStock);
  for (const s of [...vStock.added, ...vStock.changed]) {
    jobs.push(check(supabase.from("variant_stock").upsert({ variant_id: s.itemId, warehouse_id: s.warehouseId, qty_on_hand: s.qtyOnHand, qty_reserved: s.qtyReserved })));
  }

  const eStock = diffRecords(prev.equipmentStock, next.equipmentStock);
  for (const s of [...eStock.added, ...eStock.changed]) {
    jobs.push(check(supabase.from("equipment_stock").upsert({ equipment_id: s.itemId, warehouse_id: s.warehouseId, qty_on_hand: s.qtyOnHand })));
  }

  const mov = diffRecords(prev.movements, next.movements);
  for (const m of mov.added) {
    jobs.push(
      check(
        supabase.from("stock_movements").insert({
          id: m.id,
          created_at: m.createdAt,
          ref_no: m.refNo,
          item_type: m.itemType,
          item_id: m.itemId,
          variant_id: m.variantId ?? null,
          item_name: m.itemName,
          sku: m.sku,
          color: m.color ?? null,
          size: m.size ?? null,
          movement_type: m.movementType,
          qty_change: m.qtyChange,
          qty_before: m.qtyBefore,
          qty_after: m.qtyAfter,
          warehouse_from_id: m.warehouseFromId ?? null,
          warehouse_to_id: m.warehouseToId ?? null,
          actor_id: m.actorId || null,
          actor_name: m.actorName,
          reason: m.reason ?? null,
          note: m.note ?? null,
          related_doc_no: m.relatedDocNo ?? null,
          edited_note: m.editedNote ?? null,
        })
      )
    );
  }
  for (const m of mov.changed) {
    jobs.push(check(supabase.from("stock_movements").update({ edited_note: m.editedNote ?? null }).eq("id", m.id)));
  }

  const sinDocs = diffRecords(prev.stockInDocs, next.stockInDocs);
  for (const d of sinDocs.added as StockInDoc[]) {
    jobs.push(
      check(
        supabase.from("stock_in_docs").insert({
          id: d.id,
          doc_no: d.docNo,
          date: docDate(d.date),
          item_type: d.itemType,
          supplier_id: d.supplierId ?? null,
          po_number: d.poNumber ?? null,
          issue_po: d.issuePo ?? false,
          issued_by_name: d.issuedByName ?? null,
          approved_by_name: d.approvedByName ?? null,
          bill_number: d.billNumber ?? null,
          receipt_images: d.receiptImages,
          warehouse_id: d.warehouseId,
          received_by: d.receivedBy || null,
          note: d.note ?? null,
          status: d.status,
          created_at: d.createdAt,
        })
      ).then(() =>
        check(
          supabase
            .from("stock_in_lines")
            .insert(d.lines.map((l) => ({ id: l.id, doc_id: d.id, item_id: l.itemId, variant_id: l.variantId ?? null, qty: l.qty, unit_cost: l.unitCost ?? null })))
        )
      )
    );
  }

  const soutDocs = diffRecords(prev.stockOutDocs, next.stockOutDocs);
  for (const d of soutDocs.added as StockOutDoc[]) {
    jobs.push(
      check(
        supabase.from("stock_out_docs").insert({
          id: d.id,
          doc_no: d.docNo,
          date: docDate(d.date),
          item_type: d.itemType,
          reason_type: d.reasonType,
          warehouse_id: d.warehouseId,
          actor_id: d.actorId || null,
          note: d.note ?? null,
          status: d.status,
          created_at: d.createdAt,
        })
      ).then(() => check(supabase.from("stock_out_lines").insert(d.lines.map((l) => ({ id: l.id, doc_id: d.id, item_id: l.itemId, variant_id: l.variantId ?? null, qty: l.qty })))))
    );
  }

  const transfers = diffRecords(prev.transfers, next.transfers);
  for (const t of transfers.added as Transfer[]) {
    jobs.push(
      check(
        supabase.from("transfers").insert({
          id: t.id,
          transfer_no: t.transferNo,
          item_type: t.itemType,
          date: docDate(t.date),
          from_warehouse_id: t.fromWarehouseId,
          to_warehouse_id: t.toWarehouseId,
          sender_id: t.senderId || null,
          receiver_id: t.receiverId ?? null,
          note: t.note ?? null,
          status: t.status,
          created_at: t.createdAt,
          received_at: t.receivedAt ?? null,
          cancelled_at: t.cancelledAt ?? null,
        })
      ).then(() =>
        check(supabase.from("transfer_lines").insert(t.lines.map((l) => ({ id: l.id, transfer_id: t.id, item_id: l.itemId, variant_id: l.variantId ?? null, qty: l.qty }))))
      )
    );
  }
  for (const t of transfers.changed as Transfer[]) {
    jobs.push(
      check(
        supabase
          .from("transfers")
          .update({ status: t.status, receiver_id: t.receiverId ?? null, received_at: t.receivedAt ?? null, cancelled_at: t.cancelledAt ?? null, note: t.note ?? null })
          .eq("id", t.id)
      )
    );
  }

  const orders = diffRecords(prev.orders, next.orders);
  for (const o of orders.added as Order[]) {
    jobs.push(
      check(
        supabase.from("orders").insert({
          id: o.id,
          order_no: o.orderNo,
          date: docDate(o.date),
          channel: o.channel,
          brand_id: o.brandId ?? null,
          warehouse_id: o.warehouseId,
          status: o.status,
          note: o.note ?? null,
          cancel_reason: o.cancelReason ?? null,
          cancelled_at: o.cancelledAt ?? null,
          restocked: o.restocked,
          created_at: o.createdAt,
        })
      ).then(() =>
        check(
          supabase
            .from("order_lines")
            .insert(o.lines.map((l) => ({ id: l.id, order_id: o.id, product_id: l.productId, variant_id: l.variantId, qty: l.qty, unit_price: l.unitPrice, discount: l.discount })))
        )
      )
    );
  }
  for (const o of orders.changed as Order[]) {
    jobs.push(
      check(
        supabase
          .from("orders")
          .update({
            status: o.status,
            cancel_reason: o.cancelReason ?? null,
            cancelled_at: o.cancelledAt ?? null,
            restocked: o.restocked,
          })
          .eq("id", o.id)
      )
    );
  }

  const invoices = diffRecords(prev.invoices, next.invoices);
  for (const inv of invoices.added as Invoice[]) {
    jobs.push(
      check(
        supabase.from("invoices").insert({
          id: inv.id,
          invoice_no: inv.invoiceNo,
          date: docDate(inv.date),
          order_ids: inv.orderIds,
          buyer_name: inv.buyerName,
          buyer_address: inv.buyerAddress ?? null,
          buyer_tax_id: inv.buyerTaxId ?? null,
          note: inv.note ?? null,
          created_at: inv.createdAt,
        })
      )
    );
  }

  const unitTokens = diffRecords(prev.unitTokens, next.unitTokens);
  for (const t of unitTokens.added as UnitToken[]) {
    jobs.push(
      check(
        supabase.from("unit_tokens").insert({
          id: t.id,
          code: t.code ?? null,
          variant_id: t.variantId,
          last_action: t.lastAction ?? null,
          last_action_at: t.lastActionAt ?? null,
          created_at: t.createdAt,
        })
      )
    );
  }
  for (const t of unitTokens.changed as UnitToken[]) {
    jobs.push(
      check(
        supabase
          .from("unit_tokens")
          .update({ last_action: t.lastAction ?? null, last_action_at: t.lastActionAt ?? null })
          .eq("id", t.id)
      )
    );
  }

  const reqs = diffRecords(prev.equipmentRequisitions, next.equipmentRequisitions);
  for (const r of reqs.added) {
    jobs.push(
      check(
        supabase.from("equipment_requisitions").insert({
          id: r.id,
          req_no: r.reqNo,
          requester_id: r.requesterId,
          requester_name: r.requesterName,
          department: r.department ?? null,
          equipment_id: r.equipmentId,
          qty_requested: r.qtyRequested,
          stock_snapshot: r.stockSnapshot,
          reason: r.reason ?? null,
          note: r.note ?? null,
          status: r.status,
          approver_id: r.approverId ?? null,
          approver_name: r.approverName ?? null,
          decided_at: r.decidedAt ?? null,
          reject_reason: r.rejectReason ?? null,
          created_at: r.createdAt,
        })
      )
    );
  }
  for (const r of reqs.changed) {
    jobs.push(
      check(
        supabase
          .from("equipment_requisitions")
          .update({
            status: r.status,
            approver_id: r.approverId ?? null,
            approver_name: r.approverName ?? null,
            decided_at: r.decidedAt ?? null,
            reject_reason: r.rejectReason ?? null,
          })
          .eq("id", r.id)
      )
    );
  }

  if (JSON.stringify(prev.companyInfo) !== JSON.stringify(next.companyInfo)) {
    jobs.push(
      check(
        supabase.from("company_info").upsert({
          id: "default",
          name: next.companyInfo.name,
          address: next.companyInfo.address ?? null,
          phone: next.companyInfo.phone ?? null,
          tax_id: next.companyInfo.taxId ?? null,
        })
      )
    );
  }

  if (JSON.stringify(prev.storefrontSettings) !== JSON.stringify(next.storefrontSettings)) {
    jobs.push(
      check(
        supabase.from("storefront_settings").upsert({
          id: "default",
          announcement_text: next.storefrontSettings.announcementText,
          hero_heading_line1: next.storefrontSettings.heroHeadingLine1,
          hero_heading_line2: next.storefrontSettings.heroHeadingLine2,
          hero_tagline: next.storefrontSettings.heroTagline,
          promo_heading_line1: next.storefrontSettings.promoHeadingLine1,
          promo_heading_line2: next.storefrontSettings.promoHeadingLine2,
          promo_subtext: next.storefrontSettings.promoSubtext,
          contact_phone: next.storefrontSettings.contactPhone,
          social_line: next.storefrontSettings.socialLine,
          social_facebook: next.storefrontSettings.socialFacebook,
          social_instagram: next.storefrontSettings.socialInstagram,
          social_tiktok: next.storefrontSettings.socialTiktok,
          hero_image_url: next.storefrontSettings.heroImageUrl,
          promo_image_url: next.storefrontSettings.promoImageUrl,
          updated_at: new Date().toISOString(),
        })
      )
    );
  }

  const notifs = diffRecords(prev.notifications, next.notifications);
  for (const n of notifs.added) {
    jobs.push(
      check(
        supabase.from("notifications").insert({
          id: n.id,
          user_id: n.userId,
          type: n.type,
          title: n.title,
          body: n.body ?? null,
          link: n.link ?? null,
          read: n.read,
          created_at: n.createdAt,
        })
      )
    );
  }
  for (const n of notifs.changed) {
    jobs.push(check(supabase.from("notifications").update({ read: n.read }).eq("id", n.id)));
  }

  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed.length > 0) {
    console.error(
      "syncStateDiff: บางรายการบันทึกลง Supabase ไม่สำเร็จ",
      failed.map((f) => f.reason)
    );
    throw new Error(`บันทึกข้อมูลลงฐานข้อมูลไม่สำเร็จ ${failed.length} รายการ (ข้อมูลในหน้าจออาจไม่ตรงกับฐานข้อมูล กรุณารีเฟรชหน้า)`);
  }
}
