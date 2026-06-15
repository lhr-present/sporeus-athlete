# Sporeus — UTM / acquisition taxonomy

The capture pipeline already exists (`src/lib/attribution.js` → `attribution-log` edge fn →
`attribution_events` + `profiles.first_touch`). What was missing was a **shared convention**
so every inbound link is tagged consistently and `get_acquisition_by_source` can segment
signups → activation by where they came from.

As of 2026-06-15: 514 attribution rows, **0 carried a `utm_source`** — i.e. all traffic was
untagged. Tagging the surfaces below is what turns the (already-built) analytics on.

## The scheme
App entry base: `https://lhr-present.github.io/sporeus-athlete/`
Append query params (the client persists first-touch for 30 days through signup):

| Param | Values |
|---|---|
| `utm_source` | `esik_book` · `ig` · `sporeus_com` · `calculator` · `glossary` · `chapter_preview` (absent → `direct`) |
| `utm_medium` | `qr` · `social` · `post` · `tool` · `glossary` · `preview` |
| `utm_campaign` | stable label: `book` · `ig_metrics` · `evergreen` · `calculators` · `glossary` |
| `utm_content` | the specific item: chapter slug, carousel topic, post slug, calculator name, term slug |
| `utm_term` | optional (A/B variant, keyword) |

**Rules:** lowercase, snake_case, stable values (don't rename — it splits the data). One
canonical `utm_source` per surface. `utm_content` is the lever for "which chapter / which
carousel / which calculator converts."

## Surface → exact params (handoff — place on the external properties)

| Surface | Lives in | Tagged URL pattern |
|---|---|---|
| **Book QR** (per chapter) | EŞİK/THRESHOLD print | `…/sporeus-athlete/?utm_source=esik_book&utm_medium=qr&utm_campaign=book&utm_content=<chapter_slug>` |
| **IG carousel** (per topic) | IG bio/link pipeline | `…/?utm_source=ig&utm_medium=social&utm_campaign=ig_metrics&utm_content=<ctl|atl|tsb|acwr|…>` |
| **sporeus.com post** | WordPress | `…/?utm_source=sporeus_com&utm_medium=post&utm_campaign=evergreen&utm_content=<post_slug>` |
| **Calculator** (7) | sporeus.com tools | `…/?utm_source=calculator&utm_medium=tool&utm_campaign=calculators&utm_content=<calc_name>` |
| **Glossary** (401 terms) | sporeus.com glossary | `…/?utm_source=glossary&utm_medium=glossary&utm_campaign=glossary&utm_content=<term_slug>` |
| **Chapter preview** (22) | preview pages | `…/?utm_source=chapter_preview&utm_medium=preview&utm_campaign=book&utm_content=<chapter_slug>` |

Note: the **book-QR entry is already wired in-app** (`App.jsx` emits
`utm_source=esik_book&utm_medium=qr&utm_content=<chapter>`). The other five surfaces live in
**other properties** (WordPress, the IG pipeline, the book) — paste the patterns above there.

## Reading the data
- Operator: **ObservabilityDashboard → "ACQUISITION BY SOURCE (30d)"** card (admin-gated)
  → `get_acquisition_by_source(start,end)`: signups · activated · activation% · avg days-to-first, per source.
- By-day funnel (all sources): `get_funnel_cohort_summary(start,end)`.
- Both are SECURITY DEFINER, admin/service_role only, read-only, no new PII (`utm_source` is non-personal).
