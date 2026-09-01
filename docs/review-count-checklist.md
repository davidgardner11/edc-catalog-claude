# Review-count checklist

Manual data collection to strengthen the popularity half of the ranking (ADR-018).

**Why manual:** REI product pages time out on automated fetch, and several DTC sites render their
review widget in JavaScript or an iframe that automated fetching doesn't execute. None of these
block a normal browser. Six of twenty packs are currently scored; the rest fall back to acclaim-only,
which is why the blend cannot presently change list membership.

**What to record:** the **total review count** and **average rating** shown on the linked page. Use
the pack's own primary channel — brand site for DTC, REI for wholesale. Do not mix channels for a
single pack; counts are only ever compared within a channel.

**If a page shows variants** (20L vs 24L, different fabrics), use the variant named in the table and
note if the count is shared across variants.

## Already collected

| # | Pack | Channel | Count | Rating |
| --- | --- | --- | --- | --- |
| 2 | Peak Design Everyday Backpack V2 30L | REI | 1,612 | 4.7 |
| 6 | Tom Bihn Synapse 19 | DTC | 395 | 4.9 |
| 9 | Able Carry Max EDC 26L | DTC | 320 | 4.8 |
| 11 | WANDRD PRVKE 21 | DTC | 3,031 | 4.9 |
| 12 | Alpaka Elements Backpack Pro | DTC | 629 | 4.6 |
| 13 | Osprey Daylite Plus 20L | REI | 515 | 4.7 |

## Needed

| # | Pack | Channel | Where to look | Count | Rating |
| --- | --- | --- | --- | --- | --- |
| 1 | EVERGOODS Civic Panel Loader 24L V3 | DTC | `evergoods.us/products/civic-panel-loader-24l` — scroll to the Loox review widget | | |
| 3 | GORUCK GR1 26L | DTC | `goruck.com/products/gr1` — no count on the product page; check the Reviews tab | | |
| 4 | Aer Travel Pack 3 | DTC | `aersf.com/products/travel-pack-3` — reviews section is below the fold | | |
| 5 | Aer City Pack Pro 2 | DTC | `aersf.com/products/city-pack-pro-2-20l` (20L variant) | | |
| 7 | Bellroy Classic Backpack Plus | DTC | `bellroy.com/products/classic-backpack-plus` | | |
| 8 | Mystery Ranch Urban Assault 24 | REI | `rei.com/product/157798/mystery-ranch-urban-assault-pack-24-liters` — search found 10; please confirm | | |
| 10 | Black Ember Citadel R2 | DTC | ⚠️ **appears discontinued** — `blackember.com` now lists Citadel R3 / H2. See note below | | |
| 14 | Mission Workshop The Rhake VX | DTC | `missionworkshop.com/products/rhake-laptop-backpack` | | |
| 15 | Topo Designs Rover Pack Tech | REI | `rei.com/product/237180/topo-designs-rover-pack` — search found ~29; please confirm | | |
| 16 | The Brown Buffalo ConcealPack 21L | DTC | `thebrownbuffalo.com` — search "Conceal" | | |
| 17 | Incase ICON Slim | DTC | `incase.com` — search "ICON Slim" | | |
| 18 | Chrome Industries Barrage Cargo | DTC | `chromeindustries.com` — search "Barrage Cargo" | | |
| 19 | Arktype Dashpack II | DTC | `arktype.co` — search "Dashpack" | | |
| 20 | Filson Dryden Ballistic Nylon | Wholesale | `filson.com` or REI — search "Dryden Backpack" | | |

## Paste back in this form

One line per pack, `rank | count | rating`. Skip any you couldn't find; blanks stay acclaim-only.

```
1 | 412 | 4.8
3 | 1204 | 4.9
...
```

Then the blend re-runs and the ranking updates.

## Open data issue — Black Ember Citadel R2 (rank 10)

The R2 does not appear on Black Ember's current site; the line has moved to Citadel R3 and Citadel
H2. This affects Phase 5 independently of review counts — a discontinued pack has no live price,
no current colorways, and no first-party product images.

Options: substitute the current Citadel (R3 or H2) and keep Black Ember on the list, or drop the
brand and promote the next candidate. Worth deciding before ingest; it will need an ADR either way.
Other packs may have the same problem — Phase 5 research should confirm each is still in production
before spending effort on it.
