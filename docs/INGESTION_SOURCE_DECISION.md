# Ingestion Source Decision

Status: Backend boundary implemented; authenticated access pending
Decision owner: Product and catalogue service owner  
Last updated: 2026-08-06

## Decision to make

Choose how the future catalogue service obtains product and price data for
Sézane, Claudie Pierlot, & Other Stories, and Sandro.

The mobile app must not fetch or scrape storefronts. The catalogue service will
own ingestion, normalization, price history, retries, and source-specific code.

## Required data

A source is viable only if it reliably supplies:

- Stable source product identifier
- Brand and product name
- Canonical product URL
- Current price and currency
- Previous/list price when supplied by the source
- At least one product image
- Availability
- Source update timestamp or a trustworthy fetch timestamp

Size-level availability, restock signals, raw payload retention, and historical
catalogue completeness are not required for the first integration.

## Evaluation order

1. Affiliate product feed
2. Official brand or commerce API offered for this use
3. Storefront scraping, only after legal and operational approval

Affiliate feeds are evaluated first because they can provide structured,
authorized product data and may also support attribution. Scraping is the most
expensive option to own: it introduces selector maintenance, blocking risk,
terms-of-use review, throttling, retries, and monitoring.

## Research conclusion

Prove Awin product-feed access first. Awin is the only source found that has
both active public advertiser profiles for seed brands and official product
feed documentation covering COVET's required fields.

Awin documents publisher feeds containing product IDs, names, descriptions,
deep links, prices and discounts, images, availability, and vertical-specific
fashion data. Its feed-list endpoint includes feed membership, locale, last
import time, and the download URL. Access requires an Awin publisher account
and a separate product-feed API key; an advertiser profile alone does not prove
that its product feed is available to a particular publisher.

No public first-party product API documentation surfaced for any of the four
brands. This means “not publicly documented,” not proof that a private partner
API does not exist.

## Brand evidence matrix

| Brand | Affiliate evidence | Public product API | Storefront check | Assessment |
|---|---|---|---|---|
| Sézane | Active Awin profiles verified for US (`30299`), UK (`30297`), Switzerland (`83637`), and Denmark (`102319`). US and UK profiles publish a 15-day attribution period. | None found | German storefront returned HTTP 403 to a basic read-only client. | Best technical Awin candidate, but a EUR-market feed is not yet verified. |
| Claudie Pierlot | FlexOffers publicly lists a France programme, last modified 2025-12-20. An older Awin France account (`7159`) is explicitly inactive. | None found | German storefront returned HTTP 200. | Possible secondary-network candidate; current feed access must be confirmed inside FlexOffers. |
| & Other Stories | The brand publishes official affiliate pages for US and worldwide markets. Skimlinks lists a programme. A search result for Adtraction now redirects to its generic directory, so it is not accepted as current proof. | None found | German storefront returned HTTP 403 to a basic read-only client. | Programme exists, but current provider, market coverage, and product-feed access remain unverified. |
| Sandro | Active Awin US profile verified (`89061`) with a 30-day attribution period. | None found | German storefront returned HTTP 200. | Strong Awin candidate if a US proof is acceptable; EUR-market feed is not yet verified. |

The HTTP checks only describe technical accessibility observed on 2026-08-06.
They are not permission to scrape and do not assess terms of use.

## First proof of access

Create or use an Awin publisher account, obtain its product-feed API key, then
call the documented feed-list endpoint once:

```text
https://productdata.awin.com/datafeed/list/apikey/{PRODUCT_FEED_API_KEY}
```

Check whether one of the verified advertiser IDs appears with a usable feed,
locale, membership status, last-import timestamp, and download URL. Prefer a
EUR-market feed. If no EUR feed is available, pause for the initial-market
decision instead of silently changing the app's currency.

Test exactly one accessible feed before designing the full service. The proof
should answer:

1. Can we obtain a small product sample through an authorized interface?
2. Can it be normalized into the required fields without brand-specific fields
   leaking into the mobile model?
3. Does a second fetch expose a reliable price change?
4. What polling or feed-refresh cadence is permitted?

Do not add a database, scheduler, queue, or scraper during this proof. Those
create service ownership and should follow the source decision.

The repository now contains this proof as `npm run catalogue:probe:awin` and a
minimal catalogue HTTP service backed by in-memory seed data. The mobile app is
intentionally not wired to it until a real feed and target market are confirmed.

## Evidence

- [Awin product feed publisher guide](https://help.awin.com/developers/docs/product-feed-publisher.md)
- [Awin product feed list download](https://help.awin.com/developers/docs/product-feed-list-download.md)
- [Awin enhanced publisher feed API](https://help.awin.com/apidocs/retail-publisher-productapidocumentation-1.md)
- [Sézane US Awin profile](https://ui.awin.com/merchant-profile/30299)
- [Sézane UK Awin profile](https://ui.awin.com/merchant-profile/30297)
- [Sézane Switzerland Awin profile](https://ui.awin.com/merchant-profile/83637)
- [Sézane Denmark Awin profile](https://ui.awin.com/merchant-profile/102319)
- [Sandro US Awin profile](https://ui.awin.com/merchant-profile/89061)
- [Claudie Pierlot France FlexOffers listing](https://www.flexoffers.com/affiliate-programs/claudie-pierlot-fr-affiliate-program/)
- [Inactive Claudie Pierlot France Awin account](https://ui.awin.com/merchant-profile-terms/7159/ppc)
- [& Other Stories official affiliates page](https://www.stories.com/en_usd/customer-service/affiliates.html)
- [& Other Stories Skimlinks programme](https://merchant.skimlinks.com/network/750/Other-Stories-affiliate-program)

## Expected boundary after approval

```text
Affiliate feed / official API / approved scraper
                    |
                    v
            Catalogue service
        normalize + snapshot + diff
                    |
                    v
             Mobile HTTP client
                    |
                    v
          Home / Discover / Alerts
```

The existing in-process `PriceSource` remains the seed implementation. A real
backend integration will require a separate asynchronous mobile HTTP client;
it should not make the current synchronous interface pretend that network I/O
is local.

## Decision gates

Before implementation, confirm:

- The selected source and permission to use it
- Initial supported market and currency
- Price-check or feed-refresh cadence
- Whether the next backend remains a single-user proof or introduces accounts
