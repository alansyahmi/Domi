# re:AI — Pitch Fact Sheet

> Everything about the product for the slide deck. Hand-off doc, pitch day.
> ⚠️ **Honesty markers:** ✅ = built & working · 🟡 = built but demo-simulated · 🔮 = planned/roadmap.
> Don't claim 🟡/🔮 as live in Q&A — present them as "built, demo-mode" or "next."

---

## 1. The one-liner

**re:AI — real estate intelligence for Malaysian agents.**
Tagline: *"Stop chasing leads that go nowhere."*
It helps agents **win more listings** and **never lose a lead**, with cited local market intelligence and a compliant, AI-assisted inbox.

---

## 2. The problem (use on the Problem slide)

Malaysian property agents lose time and deals to:
- **Junk portal leads** — they pay PropertyGuru / iProperty / Mudah / EdgeProp for inquiries, most of which never convert. ~70% of follow-up time is wasted on tyre-kickers.
- **Lead chaos** — inquiries scattered across WhatsApp, Messenger, email, portals; leads go cold within the first hour.
- **Manual market research** — building a credible price justification or a CMA (to win a listing) takes hours per property.
- **Generic Western tools** — ignore local portals, BM-language buyers, PDPA, and how Malaysian agents actually work.

---

## 3. The solution — the closed loop

```
Capture (all channels) → Auto-qualify (AI) → Prioritise (Today queue)
   → Win the listing (CMA) → Convert (cited reports) → Prove ROI (ledger)
```

re:AI turns every inquiry into **a clear signal, a useful follow-up, and a client-ready report** — and proves the ROI.

---

## 4. Core features (the Product slides)

### A. Omnibox — the omni-channel lead inbox ✅🟡
- **Unified inbox** across WhatsApp, Messenger, Telegram, Instagram + portal-email ingestion. ✅ (email ingestion live; chat channels 🟡 simulated for demo)
- **Property-centric "inverted tree"** — leads nested under the listing they're interested in. ✅
- **Lead intelligence panel** per lead: role (buyer/seller/tenant), budget, "looking for" vs "dealbreakers", urgency tier, **match %**, priority score, and **XAI "why this score"** with sources. ✅
- **Today priority queue** — one ranked "who to work first" list across the whole book. ✅
- **Pipeline board** — Kanban by stage (New → Contacted → Engaged → Viewing → Negotiating → Won). ✅
- **Going-cold flags** — auto-flags leads not contacted in N days. ✅
- **Integrity shield** — bot/spam/co-broke-fisher probability detection. ✅

### B. Automations — "works while you sleep" 🟡 (built, demo-simulated)
- **Auto-qualify** — the instant a message lands, AI extracts role, budget, needs, dealbreakers, urgency, bot probability. 🟡
- **Zero-second auto-reply** — instant qualifying menu on first contact so intent is captured even at 2am. 🟡
- **Auto follow-up** — drafts a nudge for cold/no-reply leads, queued for one-tap approval. 🟡/🔮 (in progress)
- **Agent-controlled** — every automation has a toggle; nothing is sent to a client without the agent's say-so (Amanah).

### C. Reporter — the intelligence engine, 3 modes ✅
- **Win the Listing (CMA)** — generate a cited market analysis + a **recommended asking-price range** to win a seller's mandate; tracked in a **pitched → responded → won** pipeline. ✅
- **Advise the Buyer** — a market brief to justify/challenge a price for a buyer. ✅
- **Lead Magnet** — public capture page from a listing. 🔮 (planned)
- **Trust model** — every report shows a single honest **reliability score**, **limitations** when data is thin, **inline sources**, and an **agent-review gate** before anything client-facing is sent. ✅
- Outputs: **PDF, share link, agent-branded client view, "email to prospect."** ✅

### D. Dashboard + ROI ledger ✅
- **ROI / attribution ledger** — "This month re:AI: listings won, median first-reply time, hot leads surfaced, hours saved, deal value in play." The retention + ROI-proof engine. ✅
- Pipeline stats, high-intent leads, recent reports. ✅

### E. Compliance — the trust layer ✅
- **Amanah Principles**: transparent data collection, binary decision clarity, no dark patterns, user autonomy first.
- **PDPA-compliant** by design; consent-based capture only (no scraping).
- Legal & Support page: PDPA, ToS, Privacy, Data Processing Addendum, FAQ.

---

## 5. AI / intelligence layer (the "secret sauce" slide)

- **Google Gemini (gemini-2.5-flash)** — structured extraction: parses forwarded portal emails into leads ✅; auto-qualifies conversations 🟡; drafts reports.
- **Tavily** — live web research for property intelligence ✅.
- **Google Places** — neighbourhood/amenity signals ✅.
- **OpenDOSM / data.gov.my** — official Malaysian house-price index as the **NAPIC-aligned anchor** for match scoring & report citations (real, free gov API). 🟡 (anchor wired; granular NAPIC is gated → approximated + agent-upload path 🔮).
- **Transparent rule-based lead scoring** — explainable binary intent + Hot/Warm/Cold (not a black box) ✅.
- **Data flywheel** 🔮 — logging conversation + deal outcomes to later predict *which lead will close* (the long-term moat).

---

## 6. Tech stack (the "how it's built" slide)

**Frontend**
- React 19 + TypeScript, Vite 8, Tailwind CSS v4, React Router 7
- Single-page app; Lucide icons; **Didact Gothic** typeface; graphite + gold identity
- Demo mode (`?demo=1`) runs the whole product with zero backend (great for offline pitch demos)

**Backend**
- Serverless: **Netlify Functions** (production) / Cloudflare Workers (dev)
- TypeScript handlers; REST-ish `/api/*`

**Data**
- **Turso** (libSQL / serverless SQLite)
- Tables: `agents, leads, lead_events, listings, conversations, messages, lead_intelligence, property_reports, property_intelligence_cache, developer_intelligence_cache, integrations, agent_credentials, support_requests, otp_codes`

**Auth & security**
- **WorkOS / Scalekit OIDC** login, session cookies, CSRF tokens, OTP, encrypted agent credentials

**AI / external**
- Google Gemini, Tavily, Google Places, OpenDOSM (data.gov.my)
- Outbound messaging: WhatsApp Business API + Telegram Bot API + `wa.me` deep links

**Hosting / infra**
- Netlify (functions + static), Turso (DB), GitHub (`alansyahmi/Domi`)

---

## 7. Channels & integrations

| Channel | Status |
|---|---|
| Portal lead email ingestion (PropertyGuru, iProperty, Mudah, EdgeProp) | ✅ live (Gemini-parsed) |
| Telegram (outbound bot) | ✅ live |
| WhatsApp Business API (outbound) | ✅ wired (needs Meta credentials) |
| WhatsApp "unofficial" personal-number inbox | 🟡 simulated for pitch (QR-connect UX built; not linked live — ban risk) |
| Facebook Messenger inbound | 🟡 simulated (real Graph webhook = roadmap) |

---

## 8. Differentiators / USP (the "why we win" slide)

1. **Malaysia-native** — the 4 local portals, BM + English, local cited intelligence, OpenDOSM/NAPIC-aligned data.
2. **Trustworthy by design** — Amanah Principles + PDPA + explainable AI + report review-gate. A trust moat generic Western tools can't copy.
3. **The closed loop** — intelligence + inbox + qualification + ROI proof in one tool; nobody bundles all four for Malaysian agents.
4. **The Win-the-Listing wedge** — a 60-second cited CMA to win the scarcest, highest-value resource (seller mandates).

---

## 9. Business model & pricing

**Recommended go-to-market tiers** *(validate):*
| Tier | Price | For |
|---|---|---|
| Starter (Free) | RM 0 | Funnel / habit — inbox + basic scoring |
| Agent Pro | RM 199 / month | Individual top producers — full product + ROI ledger |
| Agency | RM 149 / seat / month | Brokerages — + manager oversight & PDPA compliance dashboard 🔮 |

- **Outcome anchor:** one won listing's commission pays for ~a year of re:AI.
- **GTM:** sell **B2B per-seat to agencies** first (fixes acquisition + churn), solo Pro is the funnel.
- *(Prototype currently shows a single "Premium Agent — RM499/mo" tier; the tiered model above is the strategy.)*

---

## 10. Market (the TAM/SAM/SOM slide) — *estimated*

- **TAM** ≈ **RM 180M/yr** — ~30,000 registered Malaysian agents & negotiators (BOVAEP)
- **SAM** ≈ **RM 72M/yr** — ~12,000 digitally-active urban agents
- **SOM** ≈ **RM 12M ARR** — 2,000 paying agents within 3 years
- **Why now:** portal lead overload, PDPA enforcement, post-pandemic digital adoption, AI finally good enough to score intent and write cited reports.
- *(Label as estimated; ARPU assumption ~RM499 equiv — adjust to chosen pricing.)*

---

## 11. Traction / status (be honest here)

- ✅ **Live, working MVP** — full product builds and runs.
- ✅ **1 design-partner agent** (real Malaysian property agent) validating the workflow.
- ✅ **4 portals** integrated via email ingestion; PDPA-compliant by design.
- 🟡 Chat channels & automations are **demo-simulated** (the logic is real; live sockets are roadmap).
- 🔮 Next: prove **one attributable won listing** in the ROI ledger; live Telegram channel; agency compliance dashboard.

**Framing for the deck:** "Live product, first agent on board, pre-revenue — raising to prove the loop and scale."

---

## 12. Team

| Name | Role |
|---|---|
| **Alan Syahmi** | Founder & CEO |
| **Vieshnu** | CFO |
| **Mohammad Nur Shamir** | CSO |
| **Abdullah Azam** | CMO |
| **Irfan Shah** | CTO |

Technical founding team that built the full product. (Recommended: add a licensed REA industry advisor for credibility.)

---

## 13. The Ask

- **Raising RM 500,000 pre-seed.**
- Use of funds: **45% Product & AI · 30% Go-to-market · 25% Team & 18-month runway.**
- **18-month milestone:** 500 paying agents (~RM 3M ARR).
- Closing line: *"Every agent's day should be spent with the buyers who are actually ready."*
- Contact: hello@re-ai.app

---

## 14. Suggested demo flow (if showing the product on stage)

Open `http://127.0.0.1:58234/leads?demo=1` (demo mode, no backend/login needed).
1. **Omnibox → Today** — "here's your morning: 2 hot leads going cold." (lead management)
2. **Simulate inbound** — watch auto-reply fire + auto-qualify fill the intelligence panel live. (automation)
3. **Open the spam one** — integrity shield flags it ~92% bot. (trust)
4. **Reporter → Win the Listing** — generate a CMA, get a recommended price range with honest reliability, track the pitch → mark won. (the wedge)
5. **Dashboard** — the ROI ledger: "this month re:AI won you 1 listing, replied in <1 min, saved 11 hours." (ROI proof)

---

## 15. Slide order (suggested, maps to a standard investor deck)

1. Cover / tagline → 2. Problem → 3. Solution (the loop) → 4. Product: Omnibox → 5. Product: Reporter/CMA → 6. Automations → 7. Why we win (USP/Amanah) → 8. Market → 9. Business model → 10. Traction → 11. Team → 12. The Ask & close.

*(A graphite + gold deck in Didact Gothic matches the product. An earlier generated deck exists at `pitch-deck/reAI-Pitch-Deck.pptx` for reference — but it predates the final team & pricing; use this fact sheet as the source of truth.)*
