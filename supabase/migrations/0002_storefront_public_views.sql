-- Public storefront read layer.
--
-- The issa-storefront site (Next.js, separate app) reads product data
-- straight from this database using the anon/publishable key so product
-- listing stays in one place (this inventory app) instead of duplicated
-- data. All existing tables keep their staff-only RLS untouched — these
-- views are a deliberate, narrow public surface:
--
--   * only status = 'active' products, only kind = 'selling' images
--   * cost data (purchase_price, source_*, supplier info, storage_location,
--     reorder_point) is never selected into these views
--   * exact stock counts are never exposed — only an in-stock boolean and a
--     capped "stock_hint" (0-5, where 5 means "5 or more") so the storefront
--     can show low-stock urgency without leaking real inventory levels
--   * stock is summed only from sellable warehouse types ('main', 'store'),
--     excluding 'office'/'other'
--
-- Views are owned by the migration role (table owner), so by default
-- (security_invoker = false) they run with the owner's privileges and
-- bypass the staff-only RLS on the base tables — the WHERE clauses above
-- are what actually restricts what the public can see, not RLS.

create view public.storefront_products as
select
  p.id,
  p.selling_name,
  p.selling_price,
  p.selling_description,
  p.category,
  p.shape,
  p.model_code,
  p.sell_start_date,
  p.created_at,
  b.name as brand_name
from products p
left join brands b on b.id = p.brand_id
where p.status = 'active';

create view public.storefront_product_images as
select
  pi.id,
  pi.product_id,
  pi.url,
  pi.is_main,
  pi.sort_order,
  pi.color
from product_images pi
join products p on p.id = pi.product_id
where pi.kind = 'selling' and p.status = 'active';

create view public.storefront_variants as
select
  v.id,
  v.product_id,
  v.color,
  v.size,
  v.sku,
  v.selling_price,
  coalesce(s.available_qty, 0) > 0 as in_stock,
  least(coalesce(s.available_qty, 0), 5) as stock_hint
from product_variants v
join products p on p.id = v.product_id
left join (
  select
    vs.variant_id,
    sum(greatest(vs.qty_on_hand - vs.qty_reserved, 0)) as available_qty
  from variant_stock vs
  join warehouses w on w.id = vs.warehouse_id
  where w.type in ('main', 'store') and w.active
  group by vs.variant_id
) s on s.variant_id = v.id
where v.active = true and p.status = 'active';

create view public.storefront_color_codes as
select code, thai_name
from color_codes;

create view public.storefront_shape_options as
select label, sort_order
from product_shape_options
order by sort_order;

grant usage on schema public to anon;
grant select on public.storefront_products to anon, authenticated;
grant select on public.storefront_product_images to anon, authenticated;
grant select on public.storefront_variants to anon, authenticated;
grant select on public.storefront_color_codes to anon, authenticated;
grant select on public.storefront_shape_options to anon, authenticated;
