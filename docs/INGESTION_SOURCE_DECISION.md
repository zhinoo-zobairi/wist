# Ingestion Source Decision

Status: Investigating  
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

## Brand evidence matrix

No availability claim is accepted without a current public source or direct
partner confirmation.

| Brand | Affiliate programme/feed | Official product API | Scraping assessment | Status |
|---|---|---|---|---|
| Sézane | Evidence pending | Evidence pending | Not assessed | Investigating |
| Claudie Pierlot | Evidence pending | Evidence pending | Not assessed | Investigating |
| & Other Stories | Evidence pending | Evidence pending | Not assessed | Investigating |
| Sandro | Evidence pending | Evidence pending | Not assessed | Investigating |

For every positive result, record the network/provider, supported markets,
access requirements, update cadence, available fields, and a source URL.

## First proof of access

After the matrix identifies a legitimate source, test exactly one brand before
designing the full service. The proof should answer:

1. Can we obtain a small product sample through an authorized interface?
2. Can it be normalized into the required fields without brand-specific fields
   leaking into the mobile model?
3. Does a second fetch expose a reliable price change?
4. What polling or feed-refresh cadence is permitted?

Do not add a database, scheduler, queue, or scraper during this proof. Those
create service ownership and should follow the source decision.

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

