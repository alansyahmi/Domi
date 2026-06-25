# re:AI — Product & Monetization Plan

> Locks the six improvements into committed decisions, then sequences the build.
> Prices and targets marked **(validate)** are hypotheses to confirm with the pilot, not final.

---

## 0. One-line positioning

**re:AI helps Malaysian property agents win more listings — and close them — with cited local intelligence and a compliant lead inbox.**

North-star metric: **listings won per agent per quarter.** Everything else (inbox, reports, lead magnets) exists to move that number.

---

## 1. The wedge — *Win the Listing* (hero)

We stop being a three-job suite and lead with the single highest-value job.

- **Why this wedge:** listings are the scarcest, highest-value resource in real estate; ROI is unambiguous and measurable ("re:AI helped me win N mandates"); it uniquely uses our moat (60-second cited CMA) that a generic CRM cannot; and it pulls the whole loop.
- **The loop it pulls:**
  `Target a farm area → re:AI surfaces sell-signals / agent imports farm list → 1-click CMA → branded pitch sent to owner → track pitched→responded→won → won listing becomes inventory → lead-magnet draws buyers → Omnibox qualifies them.`
- **Supporting cast (not deleted, demoted to support):**
  - *Advise the Buyer* — buyer brief from a lead's intelligence record.
  - *Lead Magnet* — public capture page + distribution kit feeding the Omnibox.
  - *Omnibox* — the qualification + speed-to-lead engine under all of it.

**Decision locked:** Win-the-Listing is the hero. The Reporter is repositioned as the engine behind it (not a standalone "report tool").

---

## 2. ICP & go-to-market

- **Primary ICP:** **agency team leaders / brokerages** (5–50 agents), not churny solo newbies. They have budget, value oversight + compliance, and one sale = many seats (fixes distribution).
- **Secondary ICP:** individual **top producers** (self-serve Pro).
- **GTM motion:**
  1. **Prove with the pilot** → one attributable won listing or closed deal → write it up as a **case study**.
  2. **Land one agency** via the team-leader (top-down), roll out to their agents.
  3. **Expand** seat-by-seat inside the agency; use the case study to land the next agency.
- **Why not solo self-serve first:** solo acquisition CAC + commission-only churn destroys LTV. Agencies absorb both problems.

**Decision locked:** sell **B2B per-seat to agencies first**; solo Pro is the funnel, not the focus.

---

## 3. Packaging & pricing **(validate)**

Repricing away from the unvalidated flat RM499/mo. Three tiers + outcome anchor:

| Tier | Price (validate) | For | Includes |
|---|---|---|---|
| **Starter (Free)** | RM 0 | Funnel / habit | Unified lead inbox + basic scoring; caps: 3 AI reports/mo, 1 lead magnet |
| **Agent Pro** | **RM 199/mo** | Individual top producer | Everything; generous caps on CMAs / reports / magnets; ROI ledger |
| **Agency** | **RM 149/seat/mo** (min 5 seats) | Brokerages | All of Pro + **manager oversight & PDPA compliance dashboard** + bulk onboarding |

- **Usage add-ons:** extra AI-report packs for heavy months (keeps base price low, captures power use).
- **Outcome anchor (the pitch line):** *one won listing's commission pays for ~a year of re:AI.* Price is tied to demonstrated outcomes via the ROI ledger (§5), not feature lists.
- **Why freemium:** lowers entry friction, builds the inbox habit, and lets value (paid AI actions) pull the upgrade.

**Decision locked:** freemium hook + Agent Pro + Agency per-seat. Agency is the revenue engine.

---

## 4. Trust standard (gates anything client-facing)

The agent's name goes on every report — so accuracy is existential and non-negotiable. Every client-facing artifact must:

1. Use **one honest confidence model** — kill the "97% confidence next to Low certainty" contradiction.
2. **Lead with limitations on thin data** ("based on 3 comps — directional only") instead of false-precision badges.
3. **Show sources inline** (we already store citations — surface them, including the OpenDOSM/NAPIC anchor).
4. Pass an **"agent reviewed"** gate before it can be sent to a client.

**Decision locked:** no client-facing send without sources shown + honest confidence + agent review.

---

## 5. ROI / attribution ledger (retention + monetization unlock)

The feature that turns "nice tool I cancel" into "I can't cancel this," and finally justifies the price.

- **What it shows (per agent, rolling month):**
  - **Listings won** (hero) — pitched → responded → won funnel.
  - **Leads never missed** — count + median response time (speed-to-lead).
  - **Hot leads surfaced** — high-priority leads flagged.
  - **Hours saved** — reports/CMAs auto-produced × time-per-report.
  - **Commission pipeline influenced** — value of deals re:AI touched.
- **Where it lives:** a dashboard banner ("This month re:AI: …") + an agency roll-up for team leaders.
- **How computed:** instrument events (`cma_sent`, `cma_won`, `lead_first_response`, `report_generated`, `deal_closed`) on the existing `lead_events` spine; aggregate per agent/agency.

**Decision locked:** ledger is a Phase-0 build priority — even crude, instrument it now so the pilot produces a real number.

---

## 6. Data flywheel (long-term moat)

Answers the "your data moat is thin / web-search is copyable" critique.

- **Log:** every conversation outcome, report usage, and **closed/won/lost deal**.
- **Learn:** over time, model "in this corridor, a lead with profile X closes at Y%" and "this CMA price range wins mandates at Z%."
- **Defensibility:** competitors can scrape listings; they cannot replicate **our outcome data**. This is what lets re:AI eventually say *which lead will actually close* — a claim no scraper can make.
- **Start now:** begin capturing outcome labels immediately so the flywheel has fuel; models come later.

**Decision locked:** outcome logging starts in Phase 0; predictive models are a later phase.

---

## 7. Build roadmap (the "then build")

Sequenced into verifiable slices on top of the existing Omnibox + Reporter work. Reuses ~70% of what exists (Reporter pipeline, SharedReportView, `lead_events`, Omnibox listings/leads, dashboard).

| Slice | Feature | Why first | Size |
|---|---|---|---|
| **A** | **Trust hardening** on Reporter (confidence model, inline sources, review gate) | Foundational; de-risks every client-facing artifact | S |
| **B** | **Win-the-Listing workflow** (CMA mode + branded send + pitched→won tracking, wired to Omnibox seller leads) | The hero wedge + pitch centerpiece | M |
| **C** | **ROI / attribution ledger** (event instrumentation + dashboard widget) | Retention + price justification | M |
| **D** | **Outcome logging** for the flywheel (deal won/lost labels) | Cheap to add alongside C; fuels the moat | S |
| **E** | **Agency oversight + PDPA compliance dashboard** (B2B) | Unlocks the revenue tier | L |

Recommended order: **A → B → C+D → E.** A+B is the pitch hero; C+D make it monetizable; E unlocks B2B revenue.

---

## 8. Pitch framing

- **Narrative:** "Agents drown in junk leads and lose listings to whoever pitches fastest. re:AI wins them the listing with a 60-second cited CMA, then never lets a lead go cold — and proves the ROI."
- **Hero demo:** target area → 1-click CMA → branded pitch sent → (loop) buyer leads land in the Omnibox, auto-qualified → ROI ledger shows "2 listings won, 11 hours saved."
- **Risk slide (build investor trust by naming risks):** unproven loop (→ pilot case study), trust/accuracy (→ §4 standard), integration fragility (→ official channels + simulated WhatsApp), distribution/CAC (→ agency B2B), thin data moat (→ §6 flywheel).
- **The ask** ties to milestones: prove the loop with the pilot → land first agency.

---

## Status

- **Strategy: locked** (this document).
- **Build: pending greenlight**, starting with Slice A (trust hardening) + Slice B (Win-the-Listing).
