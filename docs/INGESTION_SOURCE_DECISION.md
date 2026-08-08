# Ingestion Source Decision

Status: Manual Sandro and Bobbies observations persist; recurring scheduling approval pending
Decision owner: Product and catalogue service owner  
Last updated: 2026-08-09

## Decision to make

Choose how the future catalogue service obtains product and price data for
Sézane, Claudie Pierlot, & Other Stories, Sandro, and Bobbies.

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

## MVP evaluation order

1. Official brand or commerce API offered for this use
2. Public storefront product data, only after legal and operational approval
3. Affiliate product feed as a later option

The MVP will not depend on an affiliate platform. Direct storefront ingestion
still depends on each brand and is more expensive to own: it introduces parser
maintenance, blocking risk, terms-of-use review, throttling, retries, and
monitoring. Awin remains a later distribution and attribution option.

## Research conclusion

Prove direct access with Sandro Germany first. No public first-party product API
documentation surfaced for any of the four seed brands, so the narrow proof
uses structured data published on one public product page.

Sandro publishes a product sitemap with daily last-modified timestamps. Normal
German product paths are not disallowed by its current `robots.txt`. Each tested
product page contains schema.org Product JSON-LD with a SKU/GTIN, name,
canonical offer URL, image, EUR price, and availability. The JSON-LD avoids
fragile CSS-selector parsing.

These observations prove technical accessibility only. `robots.txt` is crawler
guidance, not permission for commercial reuse. Recurring or bulk collection
still requires explicit legal and operational approval. “No public API found”
also does not prove that a private partner API does not exist.

## Brand evidence matrix

| Brand | Affiliate evidence | Public product API | Storefront check | Assessment |
|---|---|---|---|---|
| Sézane | Active Awin profiles verified for US (`30299`), UK (`30297`), Switzerland (`83637`), and Denmark (`102319`). US and UK profiles publish a 15-day attribution period. | None found | German storefront returned HTTP 403 to a basic read-only client. | Best technical Awin candidate, but a EUR-market feed is not yet verified. |
| Claudie Pierlot | FlexOffers publicly lists a France programme, last modified 2025-12-20. An older Awin France account (`7159`) is explicitly inactive. | None found | German storefront returned HTTP 200. | Possible secondary-network candidate; current feed access must be confirmed inside FlexOffers. |
| & Other Stories | The brand publishes official affiliate pages for US and worldwide markets. Skimlinks lists a programme. A search result for Adtraction now redirects to its generic directory, so it is not accepted as current proof. | None found | German storefront returned HTTP 403 to a basic read-only client. | Programme exists, but current provider, market coverage, and product-feed access remain unverified. |
| Sandro | Active Awin US profile verified (`89061`) with a 30-day attribution period. | None found | German homepage and tested product page returned HTTP 200. Public sitemap and Product JSON-LD verified. | Selected direct-source proof; DE/EUR fields normalize cleanly. Recurring-use approval remains open. |
| Bobbies | Not researched. | None found | The explicitly supplied English product page returned HTTP 200 and Product JSON-LD. | Direct-source proof normalizes SKU, image, EUR price, and availability. Recurring-use approval remains open. |

The HTTP checks only describe technical accessibility observed on 2026-08-06
and 2026-08-08.
They are not permission to scrape and do not assess terms of use.

## First proof of access

Run the bounded manual proof with one explicit Sandro Germany product URL:

```bash
npm run catalogue:probe:sandro -- https://de.sandro-paris.com/de/p/haargummi-mit-paisley-print/SFABI00075_80.html
```

The observed proof normalized SKU `3607172192761`, the German product name,
canonical URL, high-resolution image, EUR 25 price, and in-stock state. It made
one request and did not crawl the sitemap.

The equivalent Bobbies proof accepts one explicit English product URL:

```bash
npm run catalogue:probe:bobbies -- https://www.bobbies.com/en/4000785248-opera-iridescent-champagne-3663902758263.html
```

It normalized SKU `L-M24WO-OPE01`, the Opéra product name, canonical URL,
13-image gallery, product video, EUR 225 price, and in-stock state. Bobbies uses
the HTTP schema.org availability identifier while Sandro uses HTTPS, so it has
a separate adapter.

Before designing recurring ingestion, the remaining questions are:

1. Do we have permission for recurring commercial product-page collection and
   image display?
2. What request cadence is acceptable?
3. Does the SKU remain stable across colour and size variants?
4. Does a later observation expose a reliable price change?

The owner approved the first persistent slice after the bounded proof. The
catalogue service now owns manual Bobbies/Sandro observations in SQLite and
compares each new price with the preceding observation. It still has no
scheduler, queue, sitemap crawler, watch registration, or push delivery.

The repository contains bounded direct probes, the optional earlier Awin probe,
and `npm run catalogue:observe -- <product-url>` for manual persistence. The
catalogue HTTP service reads the resulting SQLite catalogue, and the mobile app
loads those products through its asynchronous HTTP client. It is intentionally
not wired to recurring ingestion or backend-owned watches yet.

## Evidence

- [Sandro Germany robots.txt](https://de.sandro-paris.com/robots.txt)
- [Sandro Germany sitemap index](https://de.sandro-paris.com/sitemap_index.xml)
- [Tested Sandro Germany product page](https://de.sandro-paris.com/de/p/haargummi-mit-paisley-print/SFABI00075_80.html)
- [Tested Bobbies product page](https://www.bobbies.com/en/4000785248-opera-iridescent-champagne-3663902758263.html)
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
Official API / approved direct-source parser
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

Before recurring ingestion, confirm:

- Permission to collect and display Sandro and Bobbies product data and images
- Initial market and currency (current proof: Germany and EUR)
- Price-check cadence and request limits
- Whether the next backend remains a single-user proof or introduces accounts
