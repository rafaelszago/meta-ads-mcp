# Flipping a Facebook App to Live Mode

This unblocks ad-creative creation via the Meta Marketing API.

## Why this is needed

When a Facebook App is in **Development mode**, any ad creative (and the backing "dark post" on the Page) created via that app's access token is invisible to non-developers — Meta blocks running it as a live ad with error:

```
subcode 1885183
"The ads creative post was created by an app in development mode.
 It must be in public mode to run this ad."
```

Reads (insights, list, get) and non-creative writes (campaign, adset, pause/resume) keep working in dev mode. Only `create_creative` / `create_ad` are blocked.

## Prerequisites

- Business Manager admin access to your business
- A Privacy Policy URL hosted on a public domain
- Optional but smoother: Business Verification already completed in BM

## Steps

### 1. Find the app

1. Go to https://developers.facebook.com/apps
2. Pick the app whose System User generated `META_ACCESS_TOKEN` (the one stored in `.env`).
   - If unsure: in Business Manager → Settings → Users → System Users → click the user → "Assigned Assets" shows which app the token belongs to.

### 2. Fill required fields

App → **Settings → Basic**:

- **Privacy Policy URL** — required. Paste your public privacy policy URL.
- **Terms of Service URL** — optional, recommended.
- **App Icon** — 1024×1024 PNG.
- **Category** — pick `Business and Pages` (or closest).
- **Business Account** — link your Business Manager.

Save changes.

### 3. Add the Marketing API product (if not already)

App → **Add Product** → **Marketing API** → Set Up. No tier upgrade needed for basic ad management.

### 4. Toggle to Live

Top of the app dashboard there's an **App Mode** toggle: `Development ⟷ Live`.

- Flip to **Live**.
- If Meta blocks it, the modal will tell you which field is missing (almost always Privacy Policy URL or Business Verification).

### 5. (If asked) Business Verification

If Meta requires Business Verification:

- BM → Settings → Security Center → Start Verification.
- Provide: legal business name, address, phone, and a document (business registration / invoice / utility bill matching the name).
- Approval is usually same-day for established businesses; up to 5 business days otherwise.

## Verifying it worked

After flipping to Live, re-run `/ads-launch` in Claude Code and create a throwaway PAUSED creative + ad. If it succeeds without the `1885183` error, you're good — delete the throwaway in Ads Manager.

## Token notes

- The current System User token in `.env` does NOT need to be regenerated when flipping to Live — same token keeps working with the new app mode.
- If you rotate the token later: ensure permissions `ads_management`, `ads_read`, `business_management`, `pages_manage_ads`, `pages_read_engagement`.

## Why not just use a personal user token?

User tokens (from `oauth/access_token`) expire in 60 days max and tie ad creation to a human account. System User tokens are long-lived and survive personnel changes — that's why we use one. The dev-mode block is an app-level setting, independent of token type.
