-- กฎอัปโหลดไฟล์ของ Storage ยังเช็คตามตำแหน่ง (admin/manager/warehouse) ทำให้คนที่ได้สิทธิ์ product.write รายคน (เช่นตำแหน่งฝ่ายขาย) อัปโหลดรูปสินค้าไม่ได้
-- ปรับให้เช็คสิทธิ์เดียวกับตารางข้อมูลที่รูปนั้นผูกอยู่ (product_images = product.write, equipment_images = equipment.write, supplier_images/brands = master.write)
drop policy if exists "product_images_bucket_write" on storage.objects;
create policy "product_images_bucket_write" on storage.objects
  for all
  using (bucket_id = 'product-images' and public.has_any_perm(array['product.write','equipment.write','master.write']))
  with check (bucket_id = 'product-images' and public.has_any_perm(array['product.write','equipment.write','master.write']));

drop policy if exists "brand_logos_write" on storage.objects;
create policy "brand_logos_write" on storage.objects
  for all
  using (bucket_id = 'brand-logos' and public.has_perm('master.write'))
  with check (bucket_id = 'brand-logos' and public.has_perm('master.write'));
