# Campaign brief — `<slug>`

Copy this `_template` folder to `brand/campaigns/<your-slug>/` and fill it in.
Two paths from here:

- **Scaffold then iterate:** `/ads-campaign <your-slug>` creates the campaign +
  ad set(s) PAUSED and saves the IDs to `ids.yaml`. Later, fill in `copy.yaml`
  and run `/ads-launch <your-slug>` to attach creatives + ads to the same
  campaign.
- **One-shot:** `/ads-launch <your-slug>` does everything (campaign → ad set →
  creatives → ads) and writes `ids.yaml` itself.

Either way, everything is created PAUSED and the resulting IDs land in
`ids.yaml` for downstream skills to read.

## Objective

Which Meta objective? (OUTCOME_TRAFFIC | OUTCOME_LEADS | OUTCOME_SALES | …)

## Hypothesis

One sentence: who, what offer, why we think it will work.

## Audience

- Countries: (override `brand.yaml` defaults if needed)
- Age: 
- Interests / behaviors:
- Custom audiences (IDs):
- Exclusions:

## Schedule

- Start: YYYY-MM-DDTHH:MM:SSZ (omit to start when activated)
- End: YYYY-MM-DDTHH:MM:SSZ (optional)

## Budget

- Daily budget (minor units, e.g. 5000 = $50/day):
- Total cap (optional):

## Variants

List the ad variants you want created under a single ad set. Each variant
must have a matching entry in `copy.yaml`.

- `v1` — short hook + product shot
- `v2` — testimonial angle

## Success metric

What does "this worked" look like at the 7-day mark? (CTR ≥ X%, CPA ≤ $Y, …)
The skills read this to ground later optimization decisions.
