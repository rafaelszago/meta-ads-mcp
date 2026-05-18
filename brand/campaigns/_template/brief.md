# Campaign brief — `<slug>`

Copy this `_template` folder to `brand/campaigns/<your-slug>/` and fill it in.
Run `/ads-launch <your-slug>` to launch from this brief. Everything will be
created PAUSED.

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
