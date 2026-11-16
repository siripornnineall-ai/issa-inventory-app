-- หน้า "วางแผนผลิต" ให้ทุกคนที่ดูสินค้าได้เห็น (รู้ว่าอะไรขาดอะไรเกิน) จึงให้ผู้มีสิทธิ์ view.products อ่านยอดขายอ้างอิงได้ด้วย
-- เพิ่มเฉพาะนโยบายอ่าน (select) ส่วนเขียน/แก้/ลบยังเป็นของผู้มีสิทธิ์ report.view ตามนโยบาย sales_baseline_all เดิม
drop policy if exists sales_baseline_select_viewers on public.sales_baseline;
create policy sales_baseline_select_viewers on public.sales_baseline for select
  using (public.has_any_perm(array['report.view', 'view.products']));
