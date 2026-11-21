-- เปิดแอปช้า: แอปดึงทุกตารางแบ่งหน้าโดยเรียง created_at, id แต่ไม่มี index รองรับ ทุกหน้าจึง seq scan + sort ทั้งตาราง (ล้นลงดิสก์) ซ้ำทุกหน้า
-- เพิ่ม index ให้ตารางที่ถูกดึงทั้งตาราง (ไม่แตะข้อมูล ลบ index ได้ทุกเมื่อ)
create index if not exists stock_movements_load_idx on public.stock_movements (created_at, id);
create index if not exists product_variants_load_idx on public.product_variants (created_at, id);
create index if not exists order_lines_load_idx on public.order_lines (created_at, id);
create index if not exists stock_out_lines_load_idx on public.stock_out_lines (created_at, id);
create index if not exists stock_in_lines_load_idx on public.stock_in_lines (created_at, id);
create index if not exists stock_out_docs_load_idx on public.stock_out_docs (created_at, id);
create index if not exists stock_in_docs_load_idx on public.stock_in_docs (created_at, id);
create index if not exists orders_load_idx on public.orders (created_at, id);
create index if not exists factory_wip_entries_load_idx on public.factory_wip_entries (created_at, id);
create index if not exists unit_tokens_scanned_load_idx on public.unit_tokens (created_at, id) where last_action_at is not null;
analyze public.stock_movements;
analyze public.product_variants;
analyze public.order_lines;
analyze public.stock_out_lines;
