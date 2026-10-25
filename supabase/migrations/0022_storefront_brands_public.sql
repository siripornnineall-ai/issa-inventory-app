-- Expose brand logos to the storefront (brand tiles on the home page).
-- Only name + public logo URL; nothing sensitive.
create view storefront_brands_public as
select name, coalesce(logo_url, '') as logo_url
from brands;

grant select on storefront_brands_public to anon, authenticated;
