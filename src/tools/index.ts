import { adTools } from "./ads"
import { adsetTools } from "./adsets"
import { brandTools } from "./brand"
import { campaignTools } from "./campaigns"
import { creativeTools } from "./creatives"
import { insightTools } from "./insights"
import type { ToolDef } from "./shared"

export const allTools: ToolDef[] = [
  ...campaignTools,
  ...adsetTools,
  ...adTools,
  ...creativeTools,
  ...insightTools,
  ...brandTools,
]
