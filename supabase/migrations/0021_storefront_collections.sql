-- Owner-curated storefront categories ("collections"). Replaces the menu
-- that was auto-built from products.category / products.shape: the owner
-- creates named collections in Settings and picks which products belong
-- to each (with an order). Public views expose only active collections of
-- active products, so the storefront reads them with the anon key.

create table storefront_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table storefront_collection_products (
  collection_id uuid not null references storefront_collections(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sort_order int not null default 0,
  primary key (collection_id, product_id)
);

alter table storefront_collections enable row level security;
alter table storefront_collection_products enable row level security;

create policy storefront_collections_select on storefront_collections
  for select using (auth_is_active());
create policy storefront_collections_write on storefront_collections
  for all using (public.has_perm('master.write')) with check (public.has_perm('master.write'));

create policy storefront_collection_products_select on storefront_collection_products
  for select using (auth_is_active());
create policy storefront_collection_products_write on storefront_collection_products
  for all using (public.has_perm('master.write')) with check (public.has_perm('master.write'));

create view storefront_collections_public as
select id, name, slug, sort_order
from storefront_collections
where active
order by sort_order, created_at;

create view storefront_collection_products_public as
select cp.collection_id, cp.product_id, cp.sort_order
from storefront_collection_products cp
join storefront_collections c on c.id = cp.collection_id and c.active
join products p on p.id = cp.product_id and p.status = 'active';

grant select on storefront_collections_public to anon, authenticated;
grant select on storefront_collection_products_public to anon, authenticated;
