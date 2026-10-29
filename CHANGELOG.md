# Changelog

## Cue 1.27.76: Back to Team Cue button, and Canvas's CRM and To do in Ask Cue's list (not deployed)

Asked by Kiko on 29 Oct 2026 at 15:59Z: "can there be a button in Ask Cue that switches me back the other chat". At 15:56Z he
also said Ask Cue keeps its own threads ("Ask Cue can still have its own threads like Job reports, Project Intake, actually CRMs,
chasers and other CRM related can be in Ask Cue"), so the dropped builds 1.27.74 (no daily tasks-waiting list) and 1.27.75 (Ask
Cue's list moved into the Canvas panel) are not in this release. Built on 1.27.72.

- **Back to Team Cue.** When Ask Cue is open inside Canvas, its header shows a "Back to Team Cue" button. It asks Canvas
  (`{canvasWs:'cueBack'}`) to close Ask Cue and open the Team Cue panel; Canvas needs its matching release (CanvasWorkspace PR
  #338). Cue opened on its own never shows the button.
- **Canvas's CRM and To do rows in Ask Cue's list.** Kiko's card pick on 29 Oct 16:01Z: "Inside Ask Cue's list". Inside Canvas,
  Canvas sends its CRM and To do rows (`{canvasWs:'cueRows'}`, name, latest line and count only); they show under "From Canvas"
  at the top of Threads. A tap asks Canvas (`{canvasWs:'cueTeam'}`) to show that thread with all its buttons (Log call, Done,
  Tomorrow, Open client), and its "‹" comes back to Ask Cue. Canvas's Team Cue list no longer shows those two rows for Kiko.
- Tests: 503, all passing (`test/features/64-team-cue-back.js`, TCB1 and TCB2).

## Cue 1.27.72: RFQ drafts say TBC for blank event details (not deployed)

Backlog card intake-real-check (High, 29 Oct 2026): intake was built but had never run on real inquiries. The coordinator asked
this thread to prove it end to end (from Gmail Start intake, from a screenshot and from an uploaded file) and to fix what breaks.
Built on the live line (1.27.70), then stacked on live 1.27.71 (Version 168) by the deploys thread.

- **Bug fix: RFQ drafts no longer print blank event lines.** On real inquiries the drafts read "Venue:", "City:" and "Expected
  pax: 0", and one made up an event date. Empty event details now go to GPT as TBC, and the RFQ prompt says never to invent a
  date, venue, city or pax.
- **Cloud check for intake on real inquiries** (`test/checks/intake-real.check.mjs`, door functions in `src/CueIntakeCheck.gs`).
  It picks the newest inquiries Cue sorted (New mail's own sort, plus older Inbox triage lines), runs phase 1 for real, then
  phases 2 to 4 on a copy, so nothing is written to Canvas and nothing is sent. `intake-real.only.txt` next to the script narrows
  it to one named project. In a check, a new message never joins or reopens one of Kiko's own threads (`cueCheckMine_`).
- Tests: 501, all passing on top of 1.27.71 (`test/features/63-intake-real-check.js`, IR1 to IR6).

## Cue 1.27.71: Friday status updates to clients (live as Version 168, 29 Oct 14:56Z, rollback 159)

Asked by Kiko on 29 Oct 2026 at 12:57Z: "lets reopen status updates - sent every Friday / provide an update on the progress of
each requirement / show progress based on timeline / Project Readiness score - run first Project Readiness scan before sending /
Open Risks and Issues / Task Update / If they want to see more details. about the project > Go to Canvas". This replaces the old
Monday status report (spec of 22 Oct), which never went live.

- **Every Friday at 07:00** (Scheduled tasks row "Friday status updates", on), or when Kiko types "status updates" or "status of
  <event>". The old Monday row moves to Friday and is turned on.
- **A fresh readiness scan first.** Canvas lists the active events (For Production Start or later, event no more than 7 days ago),
  then reruns each event's pre-event readiness checklist (`get_readiness`, at most 1 minute old), five at a time. A long list goes
  on at the next 5-minute run. If a scan fails, the card says so and that email shows the last score Canvas has. A scan so slow that
  Cue's run ends during it (one cloud check took 301 s for one event) is not tried again: the next run reports it the same way.
- **One email per event, built by Canvas** (new bridge read `client_status`, CanvasWorkspace PR #311), from what the client site
  already shows: the progress of each requirement (Planning, In production, For delivery, Done), progress on the timeline (done,
  catching up, coming up), the Readiness score, open risks and issues with the plan, the task update, and a Go to Canvas button
  that opens the event on the client site. Supplier names and peso amounts are cut, as on the client site. The email is in the
  BSE look with the Canvas logo, and in the brand voice ("Hi <first name>,", "event", "Thank you," then Blank Space Events).
- **Nothing goes out on its own.** The card lists each email with its numbers, To (a dropdown of the event's contacts in Canvas,
  main contact first, plus "Someone else…" for a typed address; Kiko 29 Oct 13:42Z "it should be like a dropdown"), Preview (the email as the client sees it), Send (one confirm, from Kiko's Gmail) and Skip. A second Send tap on an
  email already sent sends nothing. Done skips the emails not sent.
- No AI call. The Today card shows "N client updates to send".

Also in this release: the bid card buttons read Actionable, View Details, Decide Later and Decline, in that order (Kiko 29 Oct
2026 14:32Z; Cue PR #218, commit 43b3982; test BV5 checks the order).

Tests: 495/495 (feature file `63-friday-status.js`, 9 tests). Bridge fixture refreshed from CanvasWorkspace PR #311.

Cloud check: `test/checks/1.27.71-friday-status.check.mjs` starts "status of" the check project, opens the card, taps Preview
and Skip, and never taps Send (the check project's contacts are real people). Check mode now lets the read `client_status`
through (added to its read list in `CueCheck.gs`); it writes nothing in Canvas. Added by the deploys thread, 29 Oct 2026.

## Cue 1.27.70: pipeline review reads Canvas, not HubSpot (live as Version 159, 29 Oct 12:46Z, rollback 156)

Bug fix CRM-13 (Cue #235, under the CRM epic #222). Kiko approved the HubSpot gap suggestions on 29 Oct 2026 at 11:48Z ("im
ok with the suggestions"). Canvas stopped syncing HubSpot on 29 Oct (Canvas V328), so the pipeline review ("which deals went
quiet?", "where are we with Telus") was flagging HubSpot deals that no longer change.

- **Open deals now come from Canvas.** The review reads Canvas's Sales funnel through the bridge (`crm_funnel`, a read): the
  Inquiry and CE sent rows, projects and inquiries alike. Delivered and Paid rows are not open deals. Until Canvas returns every
  open row, Cue reviews the rows Canvas already flags as past their step's day limit, and the card says so.
- **No HubSpot key needed.** The review no longer reads HubSpot, so a missing or refused HubSpot key does not stop it. Canvas not
  answering fails the run with Canvas's own reason and Try again.
- **Each deal opens in Canvas** (the project, or the client in Client Desk for an inquiry). The sent line now ends "Canvas was not
  changed." Gmail reading, the flags, the one Claude call and the follow-up drafts are unchanged.
- Canvas sends no amounts, only whether a row is priced, so "Missing amount" shows only when Canvas says a row has none.
- The Sales funnel card's HubSpot tasks row is unchanged: HubSpot tasks are still live and its funnel numbers already come from
  Canvas.

Tests: 486/486 (pipeline tests P1 to P3 now use Canvas's open list).

## Cue 1.27.69: bid card in three parts, with Decline, Decide later and the clarification email (live as Version 156, 29 Oct 11:41Z, rollback 149)

Asked by Kiko on 29 Oct 2026 at 10:47Z: "For Opportunities - i would like to see New Opportunities - Scoped Projects ... New
Opportunities - For Clarification ... Opportunities Closing", and at 10:48Z: "indicate the source in the message". His answers
at 10:51Z to 10:52Z: Decline is one tap and writes No in the bid sheet, Create CE opens Canvas Cost Estimates, and a bid whose
documents must be bought goes to "for clarification".

- **New: Scoped projects.** Notices whose bid documents Cue downloaded and read, with nothing missing and inside the budget and
  area screen. Buttons: Accept (start intake), Decide later, Decline.
- **New: For clarification.** Notices with missing details or no readable documents. Send email clarification drafts the email
  to the agency in the BSE voice and shows it on the card, also saved in Gmail Drafts. Kiko can Edit it, Cancel it (the draft is
  deleted), or Approve and send. The email goes once, from Kiko's Gmail, and the bid sheet notes the day and the address.
- **Opportunities closing.** Notices recorded earlier that are still open. One already accepted (Intake?? Yes) shows Create CE,
  which opens Canvas Cost Estimates on that reference; one not yet accepted shows Accept. Both show Decline.
- **Each notice shows a short summary**: organization, bid end date, budget and the summary of requirements (Kiko, 11:23Z: "have a
  summary of the requirements in the card"). **View details** (Kiko, 11:24Z) opens the rest under it: contact, bid start date,
  the bid documents and the official notice. The Accept button no longer says "(start intake)" (Kiko, 11:23Z).
- **Source on every notice**, such as "PhilGEPS Bulletin Board", "PhilGEPS (old site)", CITEM or NPDC.
- **Decline** writes No in the bid sheet's Intake?? column, so the notice never comes back. **Decide later** writes nothing, so
  tomorrow's 7:00 check shows it again. Accept writes Yes.
- No new AI call (the clarification draft uses the same one call as before) and no email without Kiko's tap.
- Tests: 486 (new `test/features/62-bid-card-v3.js`).

## Cue 1.27.68: three bug fixes: CRM funnel, CRM timer, PhilGEPS bids (live as Version 156 with 1.27.69, 29 Oct 11:41Z)

Asked by the coordinator on 29 Oct 2026 at 09:38Z, from the CRM process map Kiko asked for at 09:28Z: "Fix the two bugs now".

- **The 7:00 "Sales funnel and HubSpot tasks" card read frozen numbers.** HubSpot sync has been off since Canvas V328 (Kiko,
  29 Oct 02:00Z "Turn off hubspot"), but the card still counted deals from HubSpot. It now reads Canvas's Sales funnel through
  the bridge (`crm_funnel`, a read): Inquiry, CE sent, Won, Delivered and Paid, with how many are stuck. It shows counts only;
  amounts and the deal lists stay in Canvas (Accounts › Deals). Kiko's open HubSpot tasks and Mark done are unchanged, and a
  task still links its HubSpot deal. The card says "from Canvas".
- **The CRM timer still ran from info@.** Kiko asked on 29 Oct at 02:11:02Z: "Make all Cue and CRM related timers to my account."
  Canvas V329 added the bridge action `crm_tick` for that, but no Cue release called it, so info@'s 15-minute trigger kept doing
  the CRM work. A new "CRM work" job in the 5-minute tick (`CueCrmTick.gs`) now calls `crm_tick` every 15 minutes from Kiko's
  account. Canvas then retires info@'s trigger, and falls back to it if Cue stops calling for 40 minutes. A failure is a Failed
  row in Job Runs and is tried again 15 minutes later. No AI call, no email, no new trigger, and a cloud check never calls it.
- **The daily bid check never opened a PhilGEPS notice** (issue #221). Kiko, 29 Oct 09:44Z: "i havent received notif for any new
  bid opportunities for how many days now". The check asked ChatGPT to look at the public PhilGEPS notices site, but ChatGPT only
  saw its category index and still logged the source as Checked every day. A read in Kiko's Chrome that morning found 50 open
  notices there that pass his screen. Cue's own code now reads the open lists of four event categories (Events Management, Audio
  and Visual Equipment, Catering Services, Printing Services) and each notice's page once, for the ABC, area and closing time
  (`CueBidsPhilgeps.gs`, hidden "PhilGEPS notices" tab). The notices then go through the same screen and dedupe as before. No AI
  call; reads are paced and capped at two minutes per run, and the rest carries on at the next resume. The signed-in Bulletin Board
  still needs a login and stays Blocked.
- **Bid sources, as Kiko set them on 29 Oct.** 10:37Z: "for NCCA lets pause that for now. they require a platinum member", so
  NCCA is out of the list. UNGM is searched with Country = Philippines and published in the last 3 days, and ADB opens his filtered
  link (Country Philippines, Status Active). 10:40Z: "you can add this in your list https://manila.gov.ph/invitation-to-bid/", so
  the City of Manila is in. Still 11 sources.
- **Bid budget floor lowered to ₱50,000.** Kiko, 29 Oct 10:52Z: "you can lower it to 50k". The screen now keeps notices with an ABC from
  ₱50,000 to ₱700,000 (was ₱150,000 to ₱700,000).
- No new rule: the fixes use bridge actions, limits and a bid screen Kiko already approved. Needs Canvas V329 or later (live is V342).
- Tests: 481 (3 new in `test/features/60-crm-fixes.js`, 3 in `test/features/61-bids-philgeps.js`; FN1, FN3 and FN4 now expect
  Canvas's numbers).

## Cue 1.27.67: chasers and AI drafts in the BSE brand voice (live as Version 149, 29 Oct 09:30Z, rollback 147)

Kiko asked on 29 Oct 2026 at 08:14Z ("rewrite templates make sure that they follow" the approved brand voice guide). His picks at
08:23Z to 08:24Z: everything that goes out, staff included; the BSE guide first, and the Style tab only for greeting and sign-off.

- The chaser fallback templates (used when ChatGPT cannot draft) open with "Hi", close with "Thank you,", and use event language:
  RFQ follow-up ("A quick follow-up on our request for quotation"), the second CE award follow-up, the payment follow-up (no "Dear"
  and no "Good day!", since payment mail has no exclamation marks) and the FSA / AR signature reminder ("Thank you," and
  "Blank Space Events · Freelancers" instead of "Thank you!"; "close our records for <event>" instead of "close the project").
- Every Cue drafting call (chasers, emails, RFQs, requotes, readiness and pipeline follow-ups, client status updates, vendor RFQs)
  now carries the BSE voice: fun yet formal, English only, at most one "!" and none in payment mail, no emoji, "event" not
  "project" for clients and crew, money as ₱12,500.00, and no "kindly" or "revert". The Style tab's greeting and sign-off lines
  follow it; its tone, phrase and example lines no longer reach the prompt.
- No change to who is chased, when, or from which inbox. Before and after: https://claude.ai/artifact/E9dG8AMWRnVKZnSfEZimCZ
- Ships with the Canvas releases rel-v341-brand-voice-main and rel-c204-brand-voice-client, but does not need them. Tests: 475.

## Cue 1.27.66: client welcome from Kiko's Gmail (live as Version 147, 29 Oct 08:35Z, rollback 145)

Cut by the deploys thread on live 1.27.65 (Version 145) from Cue PR #207 (commit d079c44). Kiko asked on 29 Oct 2026 at 07:50Z
("the client welcome make the email come from my inbox") and at 08:24Z ("for client it should come from me, for others it can come
from info").

- Every client welcome from Canvas Settings > Clients > Send welcome is queued on the RFP Outbox, and the "RFPs from your Gmail" job
  (every minute) sends it from Kiko's own Gmail, so replies come to him. Welcomes to others still go from info@.
- The welcome keeps its look: an outbox item with a styled body goes as text and html, with the Canvas logo inline (cid:canvaslogo).
  RFPs and follow-ups stay plain text.
- Needs Canvas V340 (rel-v340-client-welcome-from-kiko-main, outbox fields html and logo); no new bridge action.

## Cue 1.27.65: Canvas chasers, Send a notice and the Log move into Cue Admin (live as Version 145, 29 Oct 2026 04:43Z; rollback Version 138)

Cut by the deploys thread on 1.27.64 (not yet live) from Cue PR #205 (commits ad162cf, 989ef5e and c743b05). Kiko asked on 29 Oct 2026
at 03:43Z ("lets move the AR, Incoice, Payment sent, Final Reminder Admin configs to Cue Admin"; reporting "has to be all not split")
and at 03:46Z ("a Historical or Log page? filtered by the different Jobs. and Status"). Epic Cue #193.

- **Jobs › Chasers** is one list (Kiko 04:33Z: "honestly i dont care if its a Canvas or Cue chaser just put it all there"; Cue PR
  #206, commit e899290). Every chaser is a chip: AR chaser, Invoice chaser, Payment sent and Final reminder open Canvas Admin's old Run
  now list (search, Not sent yet, tick and Send ticked, and Edit); RFQ, CE award, Payment, Accreditation and FSA / AR signature open
  their email template. Canvas still sends; Kiko's press is the approval, and each press is sent once, never retried.
- **Jobs › Send a notice** is Canvas Admin's Send a notice, moved here. "Send a test to me" now comes from Kiko's own Gmail as plain text.
- **Jobs › Log**: every email and text Canvas sent and every job Cue ran in the last 30 days, filtered by job, status and words, with
  the failed count for 7 days and the text credit on top. Read only.
- Needs Canvas rel-cue-admin-move-main (bridge run_now_*, sn_*; Canvas Admin loses Run now and Send a notice) and rel-sent-log-main
  (bridge sent_log; ships as Canvas V332 with the 7am Sends line) live first. The bridge fixture holds both.
- Release line: AI relay is still left out.
- Tests: 468 pass on the release line.

## Cue 1.27.64: Cue Admin rounds 2 to 4, Jobs › Chasers templates and what each item is about (live as Version 145, 29 Oct 2026 04:43Z; rollback Version 138)

Cut by the deploys thread on 1.27.63 (Cue Admin page, not yet live) from Cue PR #203 (main 9e449bd) and round 4 (9673976). Kiko asked on 29 Oct 2026
between 03:17Z and 03:27Z, and at 03:17Z said "Yes agree on Job Chasers", which moves Cue's chasers out of Canvas Admin into Cue
Admin. Epic Cue #193, stories #201 and #202.

- **Jobs › Chasers** (new): every chaser kind with a one-line description and its sender. Expand a kind to see today's chases with
  the send time and later ones from the Chase log, and where each goes from. Expand a chase to read its draft. It is read only;
  "Open the batch to approve" opens the morning batch.
- **Chaser rules** and **Scheduled tasks**: each item says what it does, who asked for it and when, and what it follows. A task
  made in chat says "Made by Kiko in chat" and the day. Scheduled task cards open.
- **Auto-send**: lists what Canvas sends by itself, the rule that sends it and the message, with email, text and app-notice icons.
  It is read only.
- **Processes** is renamed **Processes and business rules**.
- Release line changes: AI relay is not live, so its section, description and ? help are left out (tests AD4 and AD7 note it).
  The live line's daily "Sales funnel and HubSpot tasks" task gets its own description.
- Nothing Cue does changes; the words describe the code as it is. `cueAdminChasers` is never run by a cloud check.
- Round 4 (Kiko 03:35Z, Cue PR #204): Jobs › Chasers shows one generic email template per chaser kind with From and To lines,
  instead of the lined-up chases. Chaser rules say where each chaser is sent. Auto-send templates highlight their variables and show
  read-only channel ticks. Descriptions are smaller (12px) and lighter.
- Tests: 461 pass on the release line.

## Cue 1.27.63: Cue Admin, Cue's settings and admin as their own page (live as Version 145, 29 Oct 2026 04:43Z; rollback Version 138)

Kiko asked on 29 Oct 2026 at 02:13Z, 02:16Z and 02:17Z ("On a separate page"), and said "yes" to the mockup
`previews/admin-settings/cue-admin-page.png` at 02:42Z. Epic Cue #193, stories #194 to #197 (#198, the cue.blankspaceevent.com address,
is a separate production step).

- `?view=admin` opens **Cue Admin**: the Settings sections as one full page in Canvas's look (cream ground, white cards, magenta accent,
  the BSE stripe). The page has "Open Cue chat" at the top right.
- The section list is grouped: How Cue thinks (Memory, rules and personality; Processes; Tutor mode), Rules (Chaser rules; Triage
  rules; Auto-send), Jobs (Scheduled tasks; Release notes) and System (Connections; AI usage and cost; AI relay is left out because it is not on the live line). The Settings overlay
  in the chat uses the same grouping.
- New section **Triage rules** (`CueAdmin.gs`): the rows of the Triage rules tab, newest first, with Remove for one row. The rules
  work as before.
- New section **Release notes**: the newest 30 rows of the Release Notes tab, read only, with a pointer to Scheduled tasks.
- The chat's Settings button (the avatar) opens Cue Admin in a new tab. Without the app address it opens the sections in place, as before.
- `cueState` now returns `app_url`. The three new page calls are owner-only and never run by a cloud check.
- On the cream page, the white headline numbers in AI usage and cost now show in the page's text colour (found when every section
  was rendered, Cue PR #200).
- Tests: 458 on the live line (4 new in `test/features/57-cue-admin.js`).

## Cue sales funnel, part 2: Inquiry chasers, win-back drafts and the Monday funnel review (not deployed; ships after the Canvas CRM funnel rest release, CanvasWorkspace PR for branch `claude/project-thread-oq52vc`)

## Cue 1.27.62: sales funnel part 2: Inquiry chasers, win-back drafts and the Monday funnel review (not deployed)

Cut by the deploys thread on live 1.27.61 (Version 136) from Cue PR #190. Needs Canvas V319 (crm_funnel winback, crm_report). The deploys thread renamed the sweep's cueFunnelRead_ to cueSweepFunnelRead_: the live line's HubSpot funnel (CueFunnel.gs) already has a function with that name, and the second one broke it.

Spec `canvas-crm-funnel.md` F6 (Kiko approved 26 Oct 2026 16:08Z). On 28 Oct the coordinator relayed that Kiko wants the rest of the approved
spec built now.

- New kind `inquiry` ("Inquiry chasers"): an Inquiry gone quiet past Canvas's limit with a client email on file gets a short follow-up
  draft. Every 3 days (Canvas's Inquiry limit), no maximum; Kiko can change both on the Chaser rules card.
- New kind `winback` ("Win-back drafts"): Canvas's win-back clients (no open deal, last event older than the win-back months) with an email
  on file get a check-in draft. Every 30 days, no maximum.
- Both are drafts only (sendAllowed false): Approve puts them in Kiko's Gmail Drafts and Kiko sends each one himself. The words come from the
  morning batch's one shared ChatGPT call, or the template when that fails. All three sales kinds share one `crm_funnel` read
  (now with `winback: true`).
- An Inquiry with no email on file stays a plain "Sales: do these today" line, as before.
- On the morning batch card, a line from a drafts-only kind now says "draft only: you send it from Gmail".
- Monday sales funnel review: a new Scheduled tasks row (Mon 07:00, on) reads `crm_funnel` and `crm_report` (counts only), makes one
  ChatGPT call and posts 3 to 5 lines in Cue's chat: where deals leak, which source wins most, what to do this week. Nothing is sent.
- `test/fixtures/ZapBridge.gs` refreshed from the Canvas branch (crm_funnel email and winback, new read crm_report); `crm_report` joins the
  check's read list; `test/checks/sales-funnel.check.mjs` checks the draft lines too.
- Tests: 431 (428 before): SF5 to SF7.

## Cue 1.27.61: "Sales: do these today" lines in the morning batch (not deployed)

Cut by the deploys thread on live 1.27.60 (Version 134) from Cue main 0141cd2 (PR #183). Needs Canvas V316 (CRM funnel), live.

Kiko approved the CRM funnel spec (`canvas-crm-funnel.md`) on 26 Oct 2026 16:08Z and split the work (Canvas Integration: the Canvas
funnel; Cue: F5 email log, F6 to-do list). On 28 Oct 07:39Z ("stop dillydallying") the coordinator asked this thread to build what was
still missing on both sides. This is F6.

- New kind `funnel` in the morning batch, labelled "Sales: do these today". One Canvas read, `crm_funnel`, per batch.
- It lists CRM follow-ups due today or tomorrow (overdue ones are urgent), Inquiries that went quiet longer than Canvas's limit
  ("reply or send the CE"), and Delivered projects that went quiet longer than the limit ("send the billing"). Limits come from
  Canvas (System Config numbers crmStuckInquiry 3, crmStuckDelivered 30 days).
- CE sent projects are left out, because the CE award chasers already chase them.
- No email and no AI call. Skip today and Stop chasing work through the Chase log as for the other lines.
- `test/fixtures/ZapBridge.gs` is refreshed from the Canvas CRM funnel branch (adds `crm_funnel`); `crm_funnel` joins the check's
  read list, and `cueFunnelCheck` with `test/checks/sales-funnel.check.mjs` is the read-only cloud check.
- Tests: 402 on main (398 before): SF1 to SF4.

## Cue 1.27.60: structure phase 4, Cue email and Client Desk on phase 1 Approve (not deployed)

Cut by the deploys thread on live 1.27.59 (Version 130) after Canvas V317 / Client V177 went live (28 Oct 2026 08:55Z). Three groups in one release, each below with its own notes. Kiko's yes: "fucking yes" to ship all (08:25Z), "go ahead" for phase 4 (08:33Z).

- Fix found by the cloud check: before Canvas's first AI call, the Ledger has no AI Runs tab. Settings > AI usage now says
  "No Canvas AI calls yet" instead of "could not be read".

### Structure review phase 4, Cue into Canvas

Kiko approved phase 4 of the Cue structure review on 28 Oct 2026 07:42Z ("yes"). Spec: `specs/cue-structure-review.md`. Epic: Cue
#133. Stories: #145, #147, #148 and #150. Built on live 1.27.54 (Version 117, 24c7942). The deploys thread renumbers it and restacks
it on whatever ships first: 1.27.55 is taken by Cue's button, and the Client Desk line is also waiting.

- **Chase history (4.1):** each chaser's line in the Canvas project log now ends with how many times this person has been chased
  ("chase 3").
- **Bid leads (4.3):** each new bid that the bid check finds also becomes a lead in Canvas's CRM.
  - It is sent through `crm_lead` as one claimed plan, with stage Inquiry and source "Bid finder".
  - `request_id bid:<key>` makes a repeat return the same lead.
  - Updated bids are not sent, and the bid sheet rows are written as before.
  - A failure is one note on the card.
  - A check run sends nothing; `cueBidsLeadsCheck` shows what would go.
- **Bridge reads (4.4):**
  - The transfer lookup reads Transfers and Payment Request through Canvas's `read_rows`. Both tabs are already on the
    allow-list.
  - GPT tasks read the P0 funnel tabs through `read_rows` once Canvas lists them, which needs Canvas `rel-cue-p4-main`. Until
    then they open the sheet as before.
- **One AI cost view (4.6):** once Canvas `rel-cue-p4-main` is live, the usage section adds Canvas's own AI calls (Ledger › AI
  Runs).
  - They are priced by the same table and shown as "Canvas: <job>" under By command, with no separate total.
  - Until then the section says in one line that Canvas calls are not included yet.
  - Canvas edit runs (`cue-ed-` ids) show as "Other (canvas edit)".
- **Bridge copy:** `test/fixtures/ZapBridge.gs` is the `rel-cue-p4-main` copy (CanvasWorkspace PR #233).
- **Cloud check:** `test/checks/1.27.56-into-canvas.check.mjs`, read only. It covers the transfer lookup, the bid leads it would
  send and the usage view.
- **Not in this release:** 4.2 (new suppliers into the Supplier DB) is handed to Canvas Integration, because Canvas allocates
  the Supplier ID. 4.5 waits on Kiko's call.
- **Tests:** 415.

### Cue email, so new mail and client emails are seen and logged

The "Cue email" group on the live line. It is built on live 1.27.54 (Version 117), not on 1.27.55 (the Cue button bubble, on its own branch). On 28 Oct 2026 07:39Z Kiko said "stop dillydallying", and the coordinator asked for New mail and the email log to be restacked on the live line for one yes.

- **New mail** (built as 1.27.39; Kiko asked 27 Oct 2026 08:27Z, chose Yes 09:32Z, and asked for "a command to create draft and send from the same window" at 09:32Z; spec `new-mail-check.md`). Every 5 minutes Cue checks Kiko's BSE inbox (Gmail history, read only) and info@ (Canvas bridge read `inbox_new`). New emails pass the Morning batch filters and land on one "New mail" thread per day. Claude Haiku 5.5 sorts them at most every 30 minutes, 07:00 to 21:00 Manila, which is at most 28 calls a day. Each email offers Start intake, Draft reply (the email card in the same thread; it is sent from Kiko's Gmail, never from info@, and only after his tap), Open in Gmail, Done, Not an inquiry and Mute sender. An email that is also on Canvas's Emails waiting shows the sender type and project Canvas knows. Nothing is labelled, archived or sent. On the live line it is one job in the Job Runs list ("New mail"), and its card uses the Canvas look.
- **Client email log** (built as 1.27.34; Kiko 26 Oct 2026 16:10Z "Log automatically"). Once an hour, from 08:00 to 21:00, Kiko's client emails on Emails waiting go to Canvas Accounts › Activity, one row per thread per day, with no AI call. The Job Runs list already named this job ("CRM email log"). Until now the live line skipped it, because the code was not there.
- `cueClaude_` takes an optional model, as on main.
- Needs the Canvas release with `inbox_new` (CanvasWorkspace PR #145) for the info@ lines. Kiko's BSE inbox works without it. test/fixtures/ZapBridge.gs is that branch's bridge (live V310 + `inbox_new`).
- Cloud checks, both read only: `test/checks/1.27.34-email-log.check.mjs` (cueCrmLogCheck, now on the check door's list) and `test/checks/1.27.56-new-mail.check.mjs` (cueNmCheck: the last day of Kiko's inbox and info@ through New mail's code filters, saving nothing, with no AI call). In check mode `inbox_new` counts as a read. Both pass a dry run.
- The AI usage page counts the New mail sort under "New mail" (its runs use their own id, which would otherwise show as Other).
- Tests: CL1 to CL4 (email log) and NM1 to NM7 (New mail) are new. 420 tests.

### Phase 1 Approve also registers the client in Client Desk; the card says New or Existing client first

Kiko 24 Oct 2026 13:36Z ("Register the new client as well"); spec `specs/bid-contacts-reminder.md` part B (Kiko "Go" 13:54Z). First
built as 1.27.28 (8db7016) on the old line; rebuilt here on live 1.27.54 (Version 117). Canvas side is live: `client_check` and
Client Desk registration in `intake_add_project` (Canvas V248), switch CLIENT_DESK set to On by Kiko 25 Oct 18:55Z (Admin >
System Config > Switches).

- Before the phase 1 card, Cue asks Canvas (read only, `client_check`) whether the company is already in Client Desk and how
  many of its contacts are new. The card shows one "Client Desk" row: "New client ... will be added with N contacts" or
  "Existing client ...; N new contacts will be added". No row when Canvas cannot say or the switch is off.
- After Approve, the thread line says what Canvas did ("Client Desk: X added as a new client with 2 contacts."). Cancel intake
  says how many Client Desk rows it removed.
- A bid notice on a .gov.ph site sends Industry "Government" for the new client.
- No new AI call. Tests: 410 (409 before): PH1b.

## Cue 1.27.59: Cue's button chat bubble (not deployed)

Built as 1.27.55; cut by the deploys thread on 1.27.58 (RFPs from Kiko's Gmail).

Kiko 28 Oct 2026 04:25Z: "can we redesign Cue's button look - now it kinda looks like a loading image"; he chose B, the
chat bubble, at 04:29Z, and said "yes" to the group (Cue part and Canvas part) at 04:43Z. Main: Cue PR #157 (5b4b8ad).

- Cue's top-bar logo (`src/Index.html` markup, `src/IndexStyle.html` style) and the tab favicon (`src/Cue.gs`, icon version
  `bubble-1`, uploaded to Kiko's Drive once) show a white speech bubble with a "C" on the BSE gradient instead of the colour wheel.
- Built on 1.27.54 (`claude/project-thread-klmtzh-rel12754p3` @ b548fc3), so it ships after 1.27.54.
- The Chrome bubble files (extension 1.4.2) match main, but Deploy Cue does not ship the extension.
- Pairs with Canvas release `rel-v314-cue-button-main` (Cue's button in Canvas); the group ships together.
- Tests: 410 of 410 pass (CB1 added; SN2 expects extension 1.4.2).

## Cue 1.27.58: RFPs Kiko sends from Canvas go out from his own Gmail (not deployed)

Cut by the deploys thread on live 1.27.57 (Version 128) from Cue main 6802b67 (PR #185). Needs Canvas V316 (PR #230); until then the 1-minute trigger reads nothing and sends nothing.

Kiko 28 Oct 2026 07:35Z ("i want it to send it when i click send") and 07:45Z, on who it comes from: "from me". Built with Canvas
PR #230 (CanvasWorkspace branch `claude/project-thread-03c4fn-direct`), which adds the RFP Outbox and the bridge actions
`rfp_outbox` (read) and `rfp_sent` (queue). The two ship together as one feature group.

- New job "RFPs from your Gmail" (`CueRfpSend.gs`), on its own 1-minute trigger `cueRfpKick` (Kiko 08:33Z: "i need the rfp
  sending faster"), so Cue now has two triggers. It reads the RFPs and RFP follow-ups Kiko pressed
  Send on in Canvas and sends each from Kiko's Gmail with the supplier contacts in To and AccountsPayables@ plus the RFP's CC in
  CC. A follow-up goes as a reply in the RFP's own Gmail thread.
- Canvas is told each result: Sent with Kiko's Gmail thread and message, or Failed with the reason (the scope card then shows
  Not sent). An email is sent once; if Canvas does not answer the report, the next minute reports again without sending again.
- Settings > Scheduled tasks lists it as "RFPs from your Gmail" (Every minute). Run now sends at once; switching it off stops
  the minutes. Two runs never overlap. A minute writes a Job Runs row only when it sent, failed or could not report.
- A cloud check only reads the outbox and returns what it would send.
- Staff RFPs are unchanged: they open in the staff member's own Gmail.
- `test/fixtures/ZapBridge.gs`: the CRM funnel bridge (Canvas PR #232) plus the two RFP actions (PR #230). No AI call. Tests: 415 (RS1 to RS6).

## Cue 1.27.57: daily release notes at 8 PM (not deployed)

Kiko 27 Oct 2026 02:12Z: "Everyday at 8PM i would like release an announcement. This includes bug fixes and functions deploy in
Canvas and Cue." At 02:17Z he chose staff only, with his approval each day, and at 02:34Z he approved the spec
(`daily-release-notes.md`). Built 27 Oct as 1.27.35 (Cue PR #108) and restacked on the live line on 28 Oct after Kiko's 07:39Z "stop dillydallying"; Kiko's go 08:20Z ("yes"). Rebased on live
1.27.56 (Version 126, `claude/project-thread-y5l4x9-rel12757` @ fea47f2). 1.27.55 is held for Cue's button. The 8 PM tick is a
line in the background job list (CueJobs.gs), so it shows in the Job Runs tab as "Release notes at 8 PM".

- A new Scheduled tasks row, "Daily release notes", runs at 19:45 Manila. It reads the "Release Log" tab of the Cue sheet. The
  "Cue and Canvas deploys" thread adds one row there for each release it ships: went live, app, release and what it changes.
  The job keeps the releases, Canvas and Cue, that went live in the 24 hours before 19:45 and were never announced. If a run is
  missed until the next morning, it covers the day it missed. If the tab is missing, Cue makes it, and the run says "Nothing went live".
- When nothing went live, there is no thread, no AI call and no post.
- Otherwise one Claude call turns the entries into plain New and Fixed lines. If the call fails, the card shows the entries
  themselves to edit. The card shows the title and text to edit and an "Ask people to confirm they read it" tick. It has
  Post at 8 PM (Post now after 8 PM) and Skip today.
- Canvas posts the notes once, at 8:00 PM or at Kiko's tap if that is later, through the bridge write `ann_post` (live since
  Canvas V283): to Business Lead, Manager and Specialist only, from Kiko, not emailed. The request id `relnotes:<day>` means a
  retry never posts twice. A new Cue sheet tab, "Release Notes", lists every entry posted or skipped, so no entry is listed twice.
- No new access and nothing for Kiko to set up (no GitHub token: Kiko 27 Oct 09:21Z, no tasks for him).
- Cloud check `test/checks/1.27.57-release-notes.check.mjs` runs the card on two made-up releases through `cueRnCheck` (check
  mode only). It edits the text, taps Post at 8 PM, and then taps Skip today. A check's notes never post: check mode refuses `ann_post`, and
  the 8 PM tick skips a check's tasks. The dry run passes.
- Tests: new `test/features/48-release-notes.js` (RN1 to RN7); SC4, CMD2 and the feature map are updated. 422 tests.

## Cue 1.27.56: Help answers from Canvas's Help Q&A list (not deployed)

Kiko 27 Oct 2026 01:48Z: "Can you store How to questions? and What is questions? something that Crew, Client and Suppliers
might ask"; 02:34Z "Yes, build it" (Cue answers from the list); 02:54Z "go ship"; 28 Oct 07:39Z "stop dillydallying". First built
as 1.27.36 on main (#109, 29b617e); rebuilt here on live 1.27.54 (Version 117, `claude/project-thread-klmtzh-rel12754p3` @
24c7942). The Canvas side (bridge `help_qa` and `help_qa_add`) is live since Canvas V283, so this release needs no Canvas release.
If 1.27.55 (Client Desk on phase 1 Approve) ships first, this stacks on it unchanged.

- "help: <question>", "faq: <question>" or "help crew|client|supplier: <question>" reads the Live rows of the "Help Q&A" tab
  (cached 10 minutes) and matches the question in code, with no AI call. The card shows the best answer, its Canvas page and up
  to two close matches, with Copy reply, Rephrase (one Claude Haiku call, Taglish, same facts) and Edit answer in bank.
- With no match, Add as Draft puts the question on the list once (`help_qa_add`) for Kiko to answer. Nothing is sent to anyone.
- Ported onto the structure phase 2 layout: the kind and its route are one line each in `CueCommands.gs`, the card is in
  `IndexCards.html` and `IndexThreads.html`, and the tests are `test/features/48-help-qa.js` (HQ1 to HQ6). CMD2 now lists the
  help run and stopped line. Cloud check `test/checks/1.27.56-help-answers.check.mjs` (read only; dry run passes). Tests: 415.

## Cue 1.27.54.1: the Cue page opens again (bug fix, deployed 28 Oct 2026 08:22Z as Version 124; Kiko 08:20Z)

Kiko sent a screenshot on 28 Oct 2026 08:07Z: the Cue panel inside Canvas showed "Exception: Malformed HTML content" followed by
Cue's own script as text, so Cue could not be used at all.

- Cause: structure review phase 2 (live since Cue 1.27.52) split the page into parts. `cueInclude_` read each part with
  `HtmlService.createHtmlOutputFromFile`, which runs Apps Script's HTML parser on the part by itself. The script parts (IndexChat,
  IndexViewer, IndexThreads, IndexPages, IndexCards) have no `<script>` tag of their own, so the parser rejected them and doGet failed.
  The tests and the cloud checks join the parts in Node and never ran Apps Script's parser, so none of them caught it.
- Fix: `cueInclude_` reads each part raw with `HtmlService.createTemplateFromFile(name).getRawContent()`. The joined page is still
  checked once, when Index is evaluated, exactly as the single file was before the split. Nothing else changes.
- Built on live 1.27.54 (Version 117, 24c7942). Releases 1.27.55, 1.27.56 and 1.27.57 sit on the same broken line and need this fix under them.
- Test PG3 now makes `createHtmlOutputFromFile` throw the same error Apps Script gives, and checks that every part is read raw. It fails
  without the fix. 409/409 pass.

## Cue 1.27.54: structure review phase 3, job runs list and one project finder (deployed 28 Oct 2026 07:39Z as Version 117; Kiko 28 Oct 07:36Z)

Kiko approved phase 3 of the Cue structure review on 28 Oct 2026 06:05Z ("yes"); spec `specs/cue-structure-review.md`, epic
Cue #133, stories #142 and #144. Built on live 1.27.53 (Version 114, ed62d61, compact cards) plus the 1.27.52 deployed mark, as the deploys thread asked. No bridge, email or AI change.

- Job runs (3.1): `cueResume` runs its jobs from one list (`src/CueJobs.gs`). Each run writes one row to a new "Job Runs" tab in
  Cue's sheet: Started, Finished, Job, Result (OK or Failed), Error (first line) and Count. One write per tick. Rows older than
  30 days are deleted once a day (Kiko 06:08Z, "Yes, keep 30 days"). Canvas Admin reads the tab (notifications story N8) and
  raises the one failure alert (N9); Cue has no jobs page. A job whose function this build lacks is skipped, so the same file
  fits main and the live line.
- One project finder (3.3): crew docs (FSAs and ARs), readiness and supplier search now find the project the way Canvas
  commands, CE cost, expenses and TRI already did (`cueCanvasFind_`): an S- id as typed, else every word (search_projects),
  else a similar name, and one exact name wins. Before, those three used only find_similar_projects, which drops the client's
  own name, so "Unilever" found no Unilever project there. Readiness now opens straight away when one project has exactly the
  name asked.
- One inbox read (3.2): measured instead of built. Each 5-minute tick reads the inbox at most once (the email check, every
  10 minutes); the project log reuses it. Triage (07:00) and RFQ chasers (Sent) read once a day each.
- Cloud check: `test/checks/1.27.54-job-runs.check.mjs` runs one job (Bid check tidy) through the tick runner via the check
  door (`cueJobsCheck`, check only) and reads its Job Runs row back. It writes that row (and the tab on first use) in Cue's own sheet.
- Tests: 409 (404 before): JR1-JR3, PF1-PF2; readiness tests follow the finder.

## Cue 1.27.53: each waiting email carries its first line, for Canvas's compact cards (deployed 28 Oct 2026 06:20Z as Version 114)

Kiko 28 Oct 2026 04:51Z, on the Team Cue panel in Canvas: "can cards be more compact? and show a summary of the details so we
know what the card is about?"; 04:55Z: "the one that says Open Gmail needs to show more summary and buttons can they be more
compact". Kiko's go: 05:33Z ("yes"). First built as 1.27.52 on 1.27.51; restacked on live 1.27.52 (Version 112,
`claude/project-thread-klmtzh-rel12752` @ 9cabc60). Ships with the Canvas release that shows the line (built by the deploys thread).

- The 10-minute email check (`CueMailAlerts.gs`) writes `gist` for each waiting thread: the first words of the newest message
  from Gmail's own preview line, greetings left out, at most 220 characters. No AI, nothing sent anywhere new: it goes only into
  Kiko's `canvas-email-alerts.json`, which Canvas shows to Kiko alone. Staff email checks stay headers only.
- The thread cache key moves to `cue_ma_seen2`, so the first run after the deploy reads every waiting thread once.
- New test MA3 (`test/features/40-mail-alerts.js`). Tests: 404.

## Cue 1.27.52: structure review phases 1 and 2 on the live line, no visible change (deployed 28 Oct 2026 05:54Z as Version 112; Kiko 28 Oct 05:53Z)

Kiko approved phase 1 of the Cue structure review on 28 Oct 2026 03:47Z ("yes") and phase 2 at 04:21Z ("okay lets do that");
spec `specs/cue-structure-review.md`, epic Cue #133. Both were built on main (#131, #132, #152, #158, #159). Main also carries
features that never went live, so the deploys thread asked for the same structure rebuilt on the live code (rel12747, live
1.27.47 = Version 103). This release is that rebuild, on top of live 1.27.51 (69285e7, Version 108). Nothing Kiko sees or does changes; no bridge, email, sheet or AI change.

- Shared helpers: the Gmail, text and date helpers move unchanged into `CueGmail.gs`, `CueText.gs` and `CueDates.gs`.
- Tests by feature: `test/cue.test.js` loads `test/features/NN-*.js` in order, cut the same way as main.
- Command list (`src/CueCommands.gs`): every task kind with its run, Approve and "stopped" line, and the ordered word checks and
  chat-call starts that `cueSendWith_` goes down. Fitted to the live kinds (funnel and tri; no status, help or relay) and the
  live checks (add task|issue|risk, the "add project" intake, the funnel). Test CMD1 replays the order the old chain called
  its checks in, recorded from the live code, for twelve kinds of message.
- Page in parts: `src/Index.html` keeps the markup and puts six parts in place (IndexStyle, IndexChat, IndexViewer,
  IndexThreads, IndexPages, IndexCards); `doGet` serves it as a template (`cueInclude_`). The Today frame is unchanged.
  Joined, the page is the live 3,156-line file plus one blank line. `test/page.js` joins it for the tests and the cloud check.
- Card families: the page's `kindOf` table gives each kind its name, family (Approve, Draft and send, Info, Question), work
  steps and finished-card test, in place of three hand-written chains. Chromium rendered every kind in five states before and
  after: 184 captures identical.
- `FEATURE-MAP.md`, written by `node tools/map.mjs`; tests FM1 and FM2 fail when it is out of date.
- Tests: 403 (392 before, plus CMD1 to CMD4, PG1 to PG3, CF1, CF2, FM1, FM2). The cloud check dry run passes. Built first as 1.27.49 on 1.27.47,
  where Check Cue run 40635150415 (1.27.41-canvas-edit) passed: the template page loads on real Apps Script.

## Cue 1.27.51: the contact scan leaves alone cells changed before, and says which (deployed 28 Oct 2026 05:14Z as Version 108; Kiko 28 Oct 04:43Z)

Kiko 28 Oct 2026 04:43Z, while running "fill contact details from old emails": "please observe as well the history of what
he have done so far to not overwrite what changes we already did". Needs the Canvas history check, live in Canvas V310 (28 Oct 05:08Z;
`src/ZapBridge.gs` md5 7d86216f57ad34d0b74d212e322af7d9). Built on 1.27.50 (Version 106), Kiko's go 05:05Z.

- Canvas's `contact_gaps` and `contact_fill` now leave a blank P0 Contacts cell alone when it has history: a CRM Auto Added
  row for that contact and column (still added or undone in Accounts › Auto add), or an edit of that column for that contact
  in the Canvas Changes log.
- `contact_gaps` lists those cells under `held` with the reason. Cue names up to 8 of them on the Approve card and in the
  "nothing to fill" answers ("Left alone, changed before: Ana Cruz Position (changed in Canvas by … (2026-10-20))").
- `contact_fill` checks again under the lock and reports any such cell as skipped, with the same reason.
- Bridge copy `test/fixtures/ZapBridge.gs` is that branch file. New test CS6. Tests: 391.

## Cue 1.27.50 fix: no chasers for projects in a status they do not fit (deployed 28 Oct 2026 05:06Z as Version 106)

Kiko asked on 28 Oct 2026 04:46Z: "Cue - shouldnt ask or give tasks that should only be done for projects that are in a
different status". Built on live 1.27.47 (release branch `claude/project-thread-y5l4x9-rel12747`) as a bug fix. Numbered
1.27.50 because 1.27.48 (Cue button) and 1.27.49 (structure Phase 1+2) are already taken; the deploys thread decides the order.

- The morning batch (`src/CueSweep.gs`, `cueStatusFilter_`) now checks every line that has a Canvas project against a map of
  the Canvas phases each chaser kind fits (`CUE_FIT_`). The phases are Canvas's own (`PROJECT_PHASES_` in Canvas Code.gs), and
  the phase Canvas sends wins:
  - RFQ chasers: Initiation, Planning, Execution (no supplier quote chasing once a project is in Closure, Complete, On Hold,
    Cancelled or Not Awarded).
  - CE award chasers: Planning (the kind itself still keeps only For Client Awarding).
  - Accreditation chasers: Initiation, Planning, Execution, Closure (none for Complete, On Hold, Cancelled, Not Awarded).
  - Signature chasers (FSA and AR): every phase except On Hold, Cancelled and Not Awarded.
  - Payment chasers: no limit, because money owed is chased whatever the status.
- A blank or unknown status, and a line with no project, are kept; each kind's own checks still apply. Inbox triage and the
  HubSpot line have no project and are never filtered.
- Lines left out are named in one batch note ("Left out 2 lines whose project status does not fit: ..."). Accreditation and
  signature lines use the status Canvas already sends with them, so there is no extra Canvas read; RFQ uses the board read the
  kind already makes. If Canvas cannot be read, the lines are kept and the batch says the status was not checked.
- New tests PS1 to PS5. Tests: 391.

## Cue 1.27.47: contact scan fills blank P0 Contacts cells from old email signatures (deployed 28 Oct 2026 03:22Z as Version 103; rollback Version 101; feature group "Integration specs")

Kiko 26 Oct 2026 09:05Z chose this third ("2,3,4,1"); spec `specs/crm-email-scanner.md`, tracked on the Feature Board card
"Integration specs". Kiko said Yes on that card on 27 Oct 2026 15:54Z to Cue reading the signatures in his own Gmail for it.
Needs the Canvas release with `contact_gaps` and `contact_fill` (CanvasWorkspace PR #183); until then Canvas answers
"unknown action" and Cue says so and reads nothing.

- "fill contact details from old emails" in the chat (`src/CueContactScan.gs`, no AI call to route it). Canvas lists P0
  Contacts rows with an email and a blank Position / Title, Phone or Company (`contact_gaps`). Cue takes up to 20 people not
  scanned in the last 90 days (Cue sheet tab "Contact scan") and resumes the list where the last run stopped.
- Gmail, read only: the newest 5 emails from each person in the last 3 years. Only the signature lines (after the last
  sign-off, before the quoted reply, at most 12, none of BSE's own) are kept. Nothing from the email is stored.
- One Claude call reads only those lines and the blank cells. Code keeps a value only when the signature line Claude quotes
  holds it, and a phone only when its digits match a Philippine number in that line.
- One Approve card lists every proposed cell. Approve sends one `contact_fill` as the one command of a claimed plan. Canvas
  writes only cells that are still blank and logs each in CRM Auto Added, so Accounts › Auto add's Undo takes it back. No
  HubSpot write, no email, no schedule.
- Bridge copy `test/fixtures/ZapBridge.gs` is the PR #183 branch file (live V294 plus the two actions); refresh it from main
  when that release ships. New tests CS1 to CS5. Tests: 378.

## Cue 1.27.47: sheet reads through the Canvas bridge (deployed 28 Oct 2026 03:22Z as Version 103; rollback Version 101; feature group "Integration specs")

Kiko 26 Oct 2026 09:05Z chose this second ("2,3,4,1"); spec `specs/bridge-sheet-reads.md`, tracked on the Feature Board card
"Integration specs". Uses Canvas's generic bridge (live since V293), so no Canvas release.

- ChatGPT tasks (`cueGtTab_`) and the personal-expense check (`cuePeBse_`) read TRI, Supplier Database (`Main`), Admin
  Directory Projects, Tracker Personal Expenses, Transfers and Payment Request through `read_rows` when the tab is on Canvas's
  allow-list. Pages of 500 rows; the pages after the first go out in one batch. The allow-list is read once per run.
- A tab not on the list is read direct as before, so nothing stops working before its allow-list row is approved. Transfers
  and Payment Request are seed rows, so they switch at once. A refused read is a failed "Every record read" check with
  Canvas's own message.
- The P0 tabs stay direct: their header is in row 4 and `read_rows` reads row 1 only (asked of Canvas Integration).
  Tasks and Kiko's own sheets stay direct: they are not Canvas books.
- New tests SH1, SH2; PE1 and PE4 now allow the one allow-list read. Tests: 373.

## Cue 1.27.46 fix: no bank or TIN details go to ChatGPT from records tabs (deployed 27 Oct 2026 14:02Z as Version 101; rollback Version 99)

Found 27 Oct 2026 by the "Generate integration spec" thread while planning the sheet reads (focus area 3). Bug fix, so it
ships alone after its checks (Kiko's "bugs first" rule).

- The Monday supplier files review read whole Supplier Database rows into the ChatGPT prompt, and those rows hold Bank,
  Account Name, AccountNumber and TIN. `cueGtLine_` now drops any column named like a bank, account name or number, IBAN,
  SWIFT, routing, card number, TIN, signature, password, PIN, secret or token, on every records tab. Account and Account
  Owner columns (the client company) stay.
- New test GT12. Tests: 371.

## Tests only: bridge contract check (no release, nothing to deploy)

## Cue 1.27.45: Cue edits Canvas records through the generic bridge (deployed 27 Oct 2026 11:32Z as Version 99; rollback Version 97; built as 1.27.41, first numbered 1.27.43)

Kiko 27 Oct 2026 09:41Z ("Cue should be able to edit in the first place right coz thats why you were given API access to Claude... Claude will edit") and 10:06Z ("Cue received it - should passed to Claude - Claude should have updated the file"). Kiko tapped "Yes, build it" on the generic bridge (`specs/generic-bridge.md`) at 10:10Z.

- New `CueEdit.gs`. When Kiko asks to change, correct or fill in a value in a Canvas record, the chat call routes it (new field `canvas_edit`). The chat call's own guess is not shown.
  - Cue reads Canvas's allow-list and the columns of each allowed tab (`allow_list`, `read_rows`).
  - One Claude call picks the tab, the filter that finds the row and the new values. A value can replace the old text, or go before or after it.
  - Cue reads the matching rows. Exactly one row must match, otherwise Cue asks which.
  - An Approve card shows each column's old and new value. Nothing is written before Approve.
  - Approve writes once, as the one command of a claimed plan (`write_rows`), and Cue shows what Canvas read back.
- "allow cue to read <tab> in <book>", "allow cue to edit <columns> in <tab> in <book>, key <column>" and "allow cue to add rows to <tab> in <book>, key <column>" show an Approve card. Approve adds one allow-list row (`allow_list_set`). This takes no AI call.
- Canvas still refuses anything on its code never-lists, whatever the allow-list says: bank, signature and password columns; status, award and payment columns; Users, Settings and `_` tabs.
- The cloud check may read `bi_list`, `allow_list` and `read_rows`. `write_rows` and `allow_list_set` name no project, so a check run stops them.
- Needs Canvas `releases/rel-v293-genericbridge-main` (rebuilt by the deploys thread on V292) and its Client release. `test/fixtures/ZapBridge.gs` is refreshed from it.
- Tests: ED1 to ED4 are new. 361 tests on main.
- Release branch `claude/project-thread-y5l4x9-rel12741b` is live 1.27.42 (rel12742) plus this change (a204834 on main).

## Cue 1.27.44: each Canvas project gets a log of its emails, Ask Cue results and chasers (deployed 27 Oct 2026 11:27Z as Version 97; rollback Version 93)

Kiko 27 Oct 2026 10:34Z: "i want a section on Projects and then all communications and updates done in other chats are also
typed in the project in that section", and "include the mails that i receive in that section". Feature group "Projects
section"; the Canvas part is `releases/rel-v294-projects-main` and `rel-v154-projects-client` (live as Canvas V294 / Client C154).

- New `CueProjectLog.gs`. Cue sends Canvas the lines only Cue knows, through the new bridge action `project_log`:
  - Emails: every inbox thread with a new message that the 10-minute email check reads (received or sent, sender, subject,
    time and a Gmail link; headers only). Canvas files a line under the sender's contact project or a project named in the
    subject, and drops the rest, so Cue never decides which emails belong to a project. The first run after this ships
    reads the 40 newest inbox threads once, so each log starts with them.
  - Ask Cue: the one-line summary a finished task posts, when the task is about a Canvas project.
  - Chasers: each chaser email the Morning batch sent, under its project.
- Lines wait in a small queue (Script Property `CUE_PLOG_Q`, at most 300) and go in one bridge call per 5-minute tick. Each
  line has a key, so a repeat is a no-op on Canvas's side. A refusal keeps the lines for the next tick. The cloud check never
  queues. No AI call and no new access: the email check already reads these headers.
- `test/fixtures/ZapBridge.gs` has the `project_log` schema from Canvas rel-v294-projects-main (rebuilt by the deploys thread on V293).
- Tests: PL1 to PL3 are new. 373 tests on the live line (`claude/project-thread-y5l4x9-rel12744b`, on 1.27.42).

## Cue 1.27.42: Emails waiting stays up to date, because Cue now runs the email check (deployed 27 Oct 2026 10:47Z as Version 93)

Bug fix. On 27 Oct 2026 Kiko's Emails waiting thread in Canvas said "The email check hasn't run for a while" (coordinator
10:34Z: "find out why the mailcheck stopped and fix it first").

- Cause: Emails waiting is read from `canvas-email-alerts.json` in Kiko's Drive. The separate Canvas email check app wrote
  it from a 10-minute trigger in Kiko's account. Its last write was 25 Oct 2026 01:31Z, when Kiko tapped Turn on. The trigger
  never wrote again, and Google sent no failure email, so the list froze on 25 Oct items. The hourly client email log
  (1.27.34) reads the same list, so it stalled too.
- Fix: new `CueMailAlerts.gs`. Cue's own 5-minute trigger, which has run without a gap, now writes the same file every 10
  minutes with the same rules: Inbox threads whose newest message is from outside BSE, within 14 days, not from a no-reply
  address, headers only. A thread is read again only when its Gmail history moves. The file is Cue's own (`drive.file`) and
  is shared view-only with info@ without a share email. Nothing is sent, labelled or changed in Gmail. No AI call.
- Needs Canvas `releases/rel-v292-mailfix-main` (Emails waiting reads the newest such file Kiko owns) and
  `rel-v152-mailfix-client` (pin 292). Until that ships, Canvas keeps reading the old file.
- Tests: MA1 and MA2 are new. 370 tests on the live 1.27.40 line (363 on main).

## Cue 1.27.40: Chaser bug fixes (deployed 27 Oct 2026 10:32Z as Version 92)

Found 27 Oct 2026 by the "Show chaser setup and email content" thread, after Kiko asked at 09:57Z whether the chasers were set up and what they say. The coordinator asked for both fixes at 10:01Z (bugs first). Built on the live line 1.27.33 (6be58a7, Cue PR #117), then moved by the deploys thread onto live 1.27.38, release branch claude/project-thread-y5l4x9-rel12740. 1.27.39 is held for New mail.

- RFQ chasers no longer chase BSE's own applications to become a client's supplier. These are emails about supplier accreditation, vendor registration or a procurement process inquiry, and they mention "RFQ" in the body. On 22 Oct three were sent as "RFQ reminder", and on 27 Oct three more were waiting. They are left out of the Gmail search, and a thread whose first subject names them is skipped.
- Accreditation chasers never email an address that cannot take a reply, such as no-reply, bounce, mailer-daemon, notifications or an invoicing app's sender like message-service@sender.zohoinvoice.com. A supplier with only such addresses becomes a "No email address on file" line.
- Accreditation emails never ask for an account number or account name. Code turns down a ChatGPT draft that does, and the template is used instead. Canvas's ask list item "Bank details for payment (bank, account name and account number)" becomes "Bank details for payment". Kiko's own edit that asks is refused with a plain reason, and no draft is made.
- Tests: Q5, AC8 and AC9 new (367/367 on the release branch).

## Cue 1.27.38: Transfer lookup and invoice line edit in the chat (deployed 27 Oct 2026 10:18Z as Version 90)

Kiko 27 Oct 2026 08:47Z asked "do you really not have access?" after the chat refused to check the Transfers sheet for a GCash payment matching a cash one (Cups, AP-CUP-TRI-1) and refused to add REC-10307792 to the Telus Trick or Treat invoice. Cue had the access; it had no command. Kiko approved the spec (`transfer-lookup-invoice-edit.md`) at 09:20Z: "give cue edit rights and look up rights".

- Transfer lookup (`CueLookup.gs`, read only, no AI call): a question naming a transfer, GCash, InstaPay or PESONet ("is there a gcash transfer for Cups that day", "any transfer of 1,200 on 12 Oct", "find transfer 7046033873147") is answered in code from BSE Scopes and Transfers. Cue finds the payment request by request ID or by the words in the message, then lists transfers of the same amount from 3 days before to 3 days after its date. A same-amount row is never called a match. The answer also lists that day's transfers and any same-amount transfer within 30 days. Account numbers are never shown.
- Invoice line edit (`CueLookup.gs`): "add REC-<number> to the <project> invoice" (or a line in quotes) reads the project's billing invoices and POs through Canvas's new `bi_list`, and shows an Approve card with where the line goes and what the Description becomes. The line goes first, so the printed form never cuts it. A REC number gets " for <PO number>" added, as on BI 0013. Approve writes it once through Canvas's new `invoice_line`, as the one command of a claimed plan: on the open BI's Description, or, when the project has no BI yet, on its unbilled PO's Full Description, which New invoice copies. Paid BIs and BIs with payment advice stay locked, as in Finance Desk. Two open BIs, two unbilled POs or two equally likely projects make Cue ask which.
- Needs the Canvas release with `bi_list` and `invoice_line` (CanvasWorkspace `releases/rel-v289-invoiceline-main` on live V288, then `rel-v149-invoiceline-client` pinning 289). test/fixtures/ZapBridge.gs is refreshed from it.
- The question cards take a new Approve button label.
- Tests: LK1, LK2, IL1, IL2 new. 349 tests on main.
- Release branch `claude/project-thread-y5l4x9-rel12738b` is live 1.27.33 (`claude/project-thread-mg5lcj-rel12733`) plus the claimed-plan bridge helper from afbbe23 (without the 1.27.34 email log, which waits for its own check) plus this change (d2dde8b; 73bb2d6 on main). 355 tests.


Kiko 26 Oct 13:22Z ("i need you to have a command that can trigger this"), 13:24Z ("generate ARs, for... generate FSAs, for ... and then you will ask do you want me to send those after?"), 13:25Z (making the files takes a while, so the send question comes after), 13:30Z ("Generating 15 of 50") and 13:31Z ("60 files done. Do you want me to send these files... a draft with buttons... Send, Edit and Send Later").

- "Generate FSAs for <project>" and "Generate ARs for <project>" (also make, prepare, create) start the command in code, with no AI call. "Prepare ARs" through the chat call still works, and now covers FSAs too.
- The card lists the people from Canvas with nothing ticked, so one tap on Make can never make the whole list (PC check 27 Oct 01:53Z). Kiko's ticks are kept when a warning redraws the card. A crew row with no email on file is turned off (Kiko 12:58Z). Each "Can't make yet" row shows the reason Canvas gives. Up to 60 per Make.
- Canvas makes the files in the background (Canvas bridge crew_docs_make, then its own documents run). The thread shows "Generating 15 of 50" with a bar; the page looks every 30 seconds, and the 5-minute resume looks when the page is closed.
- When all are made, Cue says "N files done. Do you want me to send these files?" and shows the email draft (subject, message, Open Canvas button) with Send, Edit, Send later and Finish without sending. Edit changes the message for everyone. Send later takes a day and time (Manila), and the 5-minute resume sends at that time.
- Crew are emailed only when registered with a crew sign-in; the rest are listed as "made, not emailed" with the reason. A held AR waits for Paid. Each person is sent once (crew_docs_send).
- Needs the Canvas release with the crew_docs bridge actions (CanvasWorkspace branch claude/project-thread-mg5lcj). test/fixtures/ZapBridge.gs is refreshed from it.
- Release branch claude/project-thread-mg5lcj-rel12733: live 1.27.27 (c02a463) plus this change.
- Tests: AR1 to AR7 rewritten for the new flow, CV1 and CV11 updated.

## Cue 1.27.27: bid contacts on the card and into intake (release branch, not deployed)

Kiko asked 24 Oct 2026 13:36Z: "I think you should have also the contacts. When intake runs: Also we need to store the contact
details of the clients." Spec `specs/bid-contacts-reminder.md` part A, Kiko "Go" 13:54Z. Built on 1.27.26 (tasks tab scroll) on live 1.27.25 (V67). Registering the agency
in Client Desk (part B) needs a Canvas release and ships separately.

- The document read Cue already does now also returns up to 3 BAC or procurement contacts (name, role, email, phone). No extra AI
  call. As before, an email is kept only on the agency's own domain or a .gov.ph one.
- Each notice shows a Contact line. A notice whose documents were read but name no one shows "No contact in the documents".
- Start intake adds "Client: <agency>" and one "Client contact: name, role, email, phone" line per contact to the notice text.
  Phase 1 picks them up as client contacts, and on Approve Canvas writes them to PROJ Contacts, as it already does.
- Notices read before this release are not read again. When they have a BAC email, it shows as their contact.
- Draft a question to the agency uses the first contact's email when the documents gave no separate BAC email.
- PC check 25 Oct 01:51Z fixes: (1) the read often gives several BAC addresses in one string ("a@tpb.gov.ph; b@tpb.gov.ph"),
  which failed the email check as a whole, so every notice said "No contact in the documents". Each address is now checked on its
  own and shown as a contact, so the stored readings show their contacts without a re-read. (2) Start intake on TPB RFQ 2026.10.291
  landed in the AMI/Unilever thread because "2026" matched "UNILEVER YEAR END PARTY 2026". A bid-notice intake now always gets its
  own thread, and a number never ties a message to a task by name.
- PC recheck 25 Oct 02:15Z fixes: Start intake from a card made before this release took the notice from the card, which had no
  contacts, so phase 1 said "Contact: Not given". It now takes the contacts from the stored reading (no new read). The TPB intake
  that the old build filed into the AMI/Unilever thread now shows in its own thread, so that thread no longer carries the TPB title.
  The stored record is not changed.
- PC recheck 25 Oct 02:27Z fix: phase 1 showed a nameless BAC contact as "BAC, BAC, email" because the read put the role in the name
  too. A name that only repeats the role is dropped; the contact keeps its role and email. A bare "BAC" entry with no email or phone, whose name
  is only another contact's role, is left out too (PC recheck 02:37Z).
- PC recheck 25 Oct 02:48Z fix: phase 1's read kept rewriting the same BAC contacts in new ways ("BAC, BAC (bid contact), …"). A bid
  intake now keeps the notice's own contact list (made by code) and phase 1 shows exactly that list; the read's contacts are not used
  for a bid. Other intakes are unchanged.
- Tests: 349 of 349 pass. BD23 and BD24 are new; BD6 checks the Contact line on the card.
## Cue 1.27.26: the HubSpot tasks tab opens at its top (release branch, not deployed)

PC recheck of 1.27.25, 24 Oct 15:17Z: passed. Follow-up (not a blocker): after Open funnel, Review tasks opened the tasks tab scrolled
down by about one item, so the "HubSpot tasks · yours" header sat just above the view.

- Inside Canvas's slide-in, the first scroll can land before the Cue frame has its size again. The opener now sets the place again
  at 0.12, 0.4 and 1 s: the top for the HubSpot tasks tab, the funnel card's top for Open funnel. It stops as soon as Kiko scrolls
  or switches tab.
- Tests: 347 of 347 pass (FN5 checks the re-set).

## Cue 1.27.25: Review tasks opens its own HubSpot tasks tab (release branch, not deployed)

PC recheck of 1.27.24, 24 Oct 15:00Z: after Open funnel and closing the slide-in, Review tasks still opened Sales funnel at the top
of the card (twice, 18 to 26 s each). It worked only as the first open after a reload. The jump inside the thread could not be made
to fail outside Canvas (Chromium with Cue in nested and cross-origin frames passed), so the cause in Canvas is not proven.

- Review tasks (and the "HubSpot tasks need a key change" row) now open a pane tab of their own, "HubSpot tasks", that shows only
  that funnel run's tasks, from the top. No jump inside the funnel thread is needed. The tab is a view of the funnel run: Mark done,
  Done and replies go to that run. If the page no longer has that run, the tab shows the newest funnel run.
- Open funnel keeps the 1.27.24 jump to the top of the funnel card, which passed.
- Checked in Chromium: Open funnel, close, Review tasks, Open funnel again, Review tasks after 9 s of refreshes, and Review tasks on
  a fresh page each land where they should; Mark done in the tab closes the task.
- Tests: 347 of 347 pass (FN3 checks the tab id, FN5 runs the tab lookup). C32 failed once in about 10 runs, with and without
  this change: a known timing flake, not this build.

## Cue 1.27.24: Review tasks jumps to the tasks on a thread already open (release branch, not deployed)

PC recheck of 1.27.23, 24 Oct 14:39Z: Review tasks worked on a fresh page, but tapped right after Open funnel (slide-in closed,
then reopened on the same thread) it stayed at the top of the funnel card.

- Cause: when the thread was already drawn, the pane's own render used up the spot, and the thread opener then scrolled to the
  bottom. The opener now scrolls to the bottom first and goes to the spot after the pane's render. Checked in Chromium with
  Cue in nested frames: Open funnel, Review tasks, Open funnel again and Review tasks on a fresh page all land on their spot,
  and stay there through 9 s of refreshes.
- Not changed: the Bid thread header reads "Bid opportunities · Sat 24 Oct, 15:…" when the first run of the day has dropped out
  of the 20 newest runs the page loads. It is the same thread; the page names it from the oldest run it still has.
- Tests: 347 of 347 pass (FN5 now runs the opener with the pane's render; it fails on 1.27.23).

## Cue 1.27.23: Open funnel opens at the funnel, Review tasks at the tasks (release branch, not deployed)

PC check of 1.27.22, 24 Oct 14:29Z: the repeated Done entry is gone, but [Open funnel] on Canvas Home opened the funnel thread
scrolled to the bottom (the tasks). Every Canvas Home button opened its thread at the bottom; the funnel card is long, so that
landed on the tasks.

- The Today rows now name a spot in the thread: Open funnel goes to the top of that run's funnel card, Review tasks (and the
  key-change row) to its HubSpot tasks. Canvas passes the thread id through unchanged, so no Canvas release is needed.
- Any other thread link still opens at the bottom, as before.
- Tests: 347 of 347 pass (FN3 checks the spots, FN5 runs the page's thread opener).

## Cue 1.27.22: one funnel entry a day on the Today card (release branch, not deployed)

PC recheck of 1.27.21, 24 Oct 14:22Z: passed. Follow-up (not a blocker): the Today card's Done line listed "sales funnel (…)" once
per funnel run, two or three times a day.

- Only the day's latest funnel run counts, as rows or a Done entry, the same way bid checks are handled.
- Tests: 347 of 347 pass (FN3 checks three runs give one entry).

## Cue 1.27.21: the funnel's stage sections show they open (release branch, not deployed)

PC check of 1.27.20 (test V61), 24 Oct 14:13Z: version, bars, totals, tasks, the Canvas Home rows and the earlier rows passed. The
"Inquiry / RFP received (2)" header showed no deals under it. The deals were there, folded: the section's summary was styled
`display:inline`, which hides the browser's open marker, so a closed section looked like an empty header.

- Stage and task sections use the `.sec` style, with the › marker that turns when open.
- A section with 5 or fewer items now starts open, as do Awaiting award and Deal follow-ups. Long ones (like Lost) stay folded.
- By design, "my HubSpot tasks" starts a fresh "Sales funnel" run (one thread holds the funnel and the tasks) and closes the older
  waiting one, since each run is a full snapshot.
- Tests: 347 of 347 pass (FN5 checks no summary hides its marker).

## Cue 1.27.20: sales funnel and HubSpot tasks on the Today card (release branch, not deployed)

Asked by Kiko, 24 Oct 2026 13:50Z: "How can we place the funnel in Cue? Or the hubspot action items". Kiko chose "Yes, build both"
at 13:56Z. Spec: `specs/sales-funnel-tasks.md` in the project files. Built on the live line (1.27.19, V60).

- New `CueFunnel.gs`, kind `funnel`. Code reads every HubSpot deal (stage, amount) and Kiko's open HubSpot tasks with the deal each
  is on. No AI call. Runs daily at 7:00 (new Schedule row `sys-funnel`, on) and on chat words ("show the funnel", "my HubSpot
  tasks"). "Review the funnel" still goes to the Thursday ChatGPT task.
- Today card: two rows from one run. "₱X waiting for award" with a line per stage, and "N tasks overdue" with the first two.
  Both open the funnel thread. On Canvas Home the rows are text; the bars show in the thread. Bars on Canvas Home would need a
  Canvas release.
- The thread: bars per stage (empty open stages folded into one line), deals with no stage named, deals by stage biggest first,
  and the tasks grouped as deal follow-ups, company category and other, overdue first.
- **Mark done** closes one HubSpot task (`hs_task_status` COMPLETED) and reads it back. Nothing closes in bulk. Deal stage and
  amount are never changed. A newer funnel closes the older waiting one.
- Needs the HubSpot key "Cue" to have task read and write scopes. Without them the funnel still works and the tasks row says what
  to add.
- Tests: 347 of 347 pass (FN1 to FN5 new; SC4 lists the new row).

## Cue 1.27.19: the Today card's bid row really names its run (release branch, not deployed)

PC recheck of 1.27.18, 24 Oct 12:46Z: the Home card, both row taps, the Today line and the Done line passed. The bid row's top line
still read "Bid check". The cause was in Cue, not Canvas or a stale copy. The Today rows are built from the page's view of each run
(`cueView_`), and the bid view carries the run's title ("Bid opportunities · Sat 24 Oct, 17:58 · 2 new, 5 still open") but not the
stored `bids.base`. So 1.27.17 and 1.27.18 always fell back to "Bid check". The tests fed stored requests, not views, so they
missed it.

- The bid row's top line now comes from the view's title, without the counts: "Bid opportunities · Sat 24 Oct, 17:58".
- TD1 and TD5 now build the card from `cueView_` output, the same input `cueToday()` and `cueState()` give it. TD5 asserts the view
  has no `base`.
- Tests: 342 of 342 pass.

## Cue 1.27.18: the Today card uses only the day's latest bid run, and says which build answered (release branch, not deployed)

PC recheck of 1.27.17, 24 Oct 12:39Z: two bid-row failures. The row showed "2 new bids" from an older redo, and its top line said
"Bid check".

- Only the day's latest bid run counts, as a row or a "Done for you" entry. A redo lists only notices new since the run before it.
  The earlier run's new notices move into its Still open list. So an older card's "new" no longer shows once a later run replaced it.
- The Cue chat's Today line now shows each row's top line too (for a bid row, the run's name: "Bid opportunities · Sat 24 Oct, 17:58").
  Before, only Canvas Home showed it.
- `?view=today` sends `version` ("Cue 1.27.18") with the rows. The Cue panel's header already shows the same version for the same
  test deployment.
- Tests: 342 of 342 pass (TD5 rewritten, TD3 checks the version).

## Cue 1.27.17: the Today card's bid row says which run holds the new bids (release branch, not deployed)

PC check of 1.27.16, 24 Oct 10:41Z: the Cue chat's Today line passed (one line for the day). It said "1 thing needs you: 2 new bids
worth a look" (PCC catering for the FY2026 Midyear General Assembly, printing of PCC IECs), but the checker did not find them on the
bid card. Both are in the "New (2)" list of the 17:58 redo's card ("Bid opportunities · Sat 24 Oct, 17:58 · 2 new, 5 still open"). The
day's Bid check thread holds several cards, and the row did not say which one to look at.

- The bid row's small top line is now that run's name ("Bid opportunities · Sat 24 Oct, 17:58"), not just "Bid check". The tap still
  opens the day's Bid check thread.
- Unchanged: a redo with no new notices, only Still open ones, goes in the "Done for you" line, not a row.
- Tests: 342 of 342 pass (new TD5).

## Cue 1.27.16: live 1.27.15 (V55) + one Today card for the scheduled jobs, drawn by Canvas Home (release branch, not deployed)

Kiko 23 Oct 07:37Z ("i get confused with how its presenting information"), 08:49Z ("Cue can place them in my Home page"),
08:52Z ("make sure the UI matches Canvas"), 24 Oct 01:31Z (show who did the work: ChatGPT, not Cue alone), go 24 Oct 06:44Z.
Spec: specs/daily-digest.md. Same change as Cue 1.33 (PR #97), ported onto the live line (1.27.8).

- `CueToday.gs`: `cueTodayFrom_` turns today's runs of the morning batch, bid check, HubSpot check, status report, pipeline review and
  ChatGPT tasks into one row per thing that needs Kiko (title, one detail line, one button, the run's thread) and one "Done for you"
  line. Morning batch first (its 9:00 send has a clock). A failed run is a "didn't finish" row with Try again. Built from what the runs
  hold: no AI call, nothing sent, nothing changed.
- Who did it: each row says "Done by ChatGPT · checked by Cue" or "Done by Claude · checked by Cue", from the run's logged AI calls;
  a run with no AI call says "Done by Cue".
- `Today.html` at `/exec?view=today`: a hidden frame for Canvas Home. Same guard as 1.32 (Google windows only above it, silent until
  `cueHost`), then it posts `{canvasWs:'cue-today', day, count, rows, done}` to that window, again every 5 minutes. Canvas draws the
  card with its own styles (Canvas Home draws it since Canvas V215; the "by" pill is Canvas PR #32); a tap opens the run's thread with `cueThread`.
- Cue's chat: a day's scheduled-job lines fold into one "Today: N things need you" line, each row opening its thread.
- Rebased onto live 1.27.15 (Version 55, bid card v2) on 24 Oct 10:10Z; version 1.27.16. Tests: 341 of 341 pass (TD1 to TD4 new).

## Cue 1.27.15: Still open leaves out notices the documents show as closed or outside the budget (release branch, not deployed)

PC check of 1.27.14 on /dev, 24 Oct 09:41Z: all 7 document checks passed. One fix before live: Still open listed notices whose own PDF, now read, gave a past deadline (TPB RFQ 284 closed 16 Oct, 288, 289, the PCC Manila Forum notices from Nov 2025, ICN 0040/0043 8 Apr 2026) or a budget outside ₱150,000 to ₱700,000 (TPB RFQ 292, ₱20,000 A3 maps). The Still open list was built before the documents were read, from the sheet's blank dates.

- After reading, a Still open notice whose document shows a deadline already past, or a budget outside the range, leaves the list. It is counted in the process check (lines 3 and 5). Its sheet row gets the document's deadline and budget, so the next run leaves it out at once.
- Not changed, by design: one link listed on two notices (PCC 0040 and 0043 share one PDF) is opened and saved once, in the first notice's folder; the second shows the same copy. The first run after this release reads every document not read before, so it makes more ChatGPT calls than a normal day (the PC check run made 11); later days read only new documents.
- Tests: 337 of 337 pass (new BD21).

## Cue 1.27.14: the bid sheet's document links are read correctly and followed to the files (PC check passed; shipped as part of 1.27.15)

PC recheck of 1.27.12 on /dev, 24 Oct 09:01Z: the run (08:40Z, "redo bid check") finished in 73 seconds with "0 of 16 documents opened by Cue"; almost every document said "(not opened yet)", and the hidden "Bid documents" record (in the Cue sheet, not the bid sheet) got no new row. Root cause, from the record and the bid sheet's column N:

- **Links were lost when reading the sheet.** ChatGPT wrote most document cells with a note bracket before the status, for example "PBD_Redacted.pdf (Project Brief / Bidding Documents link shown on page) (not opened) https://tpb.gov.ph/wp-content/uploads/2026/10/PBD_Redacted.pdf". The parser took the first bracket as the status and then expected the link, found the second bracket, and dropped the link. A document with no link is never fetched, so the Reading stage had nothing to open and moved on at once. It was not the resume trigger: the run never needed one.
- **Most links are listing pages, not files.** ChatGPT gave "https://tpb.gov.ph/invitation-to-bid/" (or the CITEM and PCC listing pages) as the link of most documents, and some have no link at all ("RFQ2026-10-284_compressed (not opened)"). Opening that link alone reaches no file.

Fixed:

- The parser takes the last https link in each entry and the last bracket before it as the status, so "(note) (status) link" keeps its link.
- A document whose link is a web page, or that has no link, is looked up on that page (or on the notice's own page): Cue opens the page once per run, lists its PDF, Word, Excel and ZIP links, and picks the one with the same file name, or else the notice's reference number in the file name or link text. The file is then opened, saved and read like any other. The answer is recorded once ("page:<page>#<name>" in the Bid documents record), so the page is not searched again for that document on later days; Request more details searches again. When the page has no such file, the document says "Could not open: no file for it on the page (web page only)" instead of "not opened yet".
- The card names the agency page a file was found on. The bid sheet keeps the file link (or the page link when no file was found).
- Tests: 336 of 336 pass (new BD20 uses the PC recheck's own cells: the bracket case, a listing-page link, no link, a match by reference number and by link text, a page with no file, and nothing opened, searched or read again the next day).

## Cue 1.27.12: every bid document is attempted, each with a status (PC recheck failed, replaced by 1.27.14)

PC recheck of 1.27.11 on /dev, 24 Oct 08:26Z: the junk rows were gone ("0 new, 14 still open", all real), but most documents still showed "(not opened yet)" and only one notice got a folder in Drive "Cue bids". Cause: the limits of 10 notices a run and 3 documents a notice (TPB annexes used up the 3 slots), and the reading stopped at its time budget without ever coming back to the rest. Asked through the coordinator: "every document is attempted, across runs if needed, with a status for each", as its own release.

- No more caps. The Reading stage goes through every notice, New and Still open, and every document link on it, one notice at a time. It stops starting new notices after 3 minutes and saves. The next 5-minute resume carries on where it stopped, until every link has been tried. The card shows "Opening and reading the bid documents (N of M tried)" meanwhile.
- Every link gets a status before Cue fetches it: "Could not open: no answer in time (the site did not respond)". If a site never answers and Apps Script ends the run, that status stays, and the next resume moves on instead of waiting on the same site again. A real answer replaces it with "Opened · saved", "HTTP 403", "needs sign-in" and so on.
- A PDF that was saved but not read when the run ended is read once from Cue's Drive copy at the next resume.
- Read once still holds: a link in the "Bid documents" record is never fetched again by the daily run. Request more details retries the failed ones, including "no answer in time".
- Check 10 now reads "N of M opened"; documents not tried yet are named as such.
- Read once, tightened (Kiko 08:44Z: "make sure that it will not read again the same file"): the "Bid documents" record now also notes when each file was sent to ChatGPT (new column J). Before, a file whose reading call failed, or that ChatGPT skipped, could be sent again the next day. Now a file goes to ChatGPT once, whatever happened. Only Request more details may try it again, when Kiko taps it.
- The card writes dates the way Kiko reads them: "Fri 30 Oct 2026, 5:00 PM" instead of "2026-10-30T17:00+08:00", in Bid start date, Bid end date and the "Deadline moved" tag. The sheet keeps the full format.
- Tests: 335 of 335 pass (new BD18: 13 notices, 61 documents, four resumes, one site that never answers; new BD19: no second read across 3 days after a failed read).

## Cue 1.27.11: bid card v2 with the PC check fixes (release branch, not deployed)

PC check of 1.27.10 on /dev, 24 Oct 07:28Z: the card itself passed (title, New and Still open, the 7 fields, the buttons). Two things failed, and both are fixed:

- **Documents were never opened.** The run found 0 new and 19 still open notices, and Cue opened documents only for new ones. Now the Reading stage also opens the documents of Still open notices, once each, within the same limits (3 a notice, 10 notices a run). The read-once record still applies. Values read from the documents go back to the notice's row in the bid sheet. Links in Kiko's own Documents cells, without Cue's "(status)" format, count as documents too.
- **Non-notices showed under Still open.** The same filter now runs on the sheet's rows. It drops page and listing rows ("(last-updated page)", "page shows", "page lists advisories", "entries listed on", "list contains"), BAC resolutions and award postings. A document named as an award posting or NOA is not listed under a notice.
- Tests: 337 of 337 pass (new BD17 uses the PC check's own rows).

## Cue 1.27.10: release branch, live line 1.27.9 + bid card v2: Cue opens the bid documents itself and reads each one once (PC check failed, replaced by 1.27.11)

Kiko 24 Oct 01:39Z (screenshot of the 07:04 card: "separate the new ones from the ones we already found", "Fix the title of the card", the seven fields, Request for more details and Project intake), 06:45Z ("please make sure that the bid document is actually accessed"), 06:46Z (Request more details = digging first, then an agency question) and 06:52Z ("ok, just make sure that Cue will not read the same bid opportunity daily"). Spec: specs/bid-card-v2.md. Built on the release branch for 1.27.9 (claude/project-thread-y5l4x9-rel1279, 5b8f169), as the coordinator asked: main is a dead line. The change is in `src/CueBids.gs`, `bidsCardHtml` and its three click handlers in `src/Index.html`, and the BD tests. No Canvas release.

- The card: title "Bid opportunities · Fri 24 Oct · 2 new, 4 still open" (a later run that day adds its time), a sub-line with the sources checked, then **New** and **Still open**. Still open is the bid sheet's rows with Intake?? blank, a deadline later than now (or none, for 14 days after first seen), not cancelled, one per notice. A changed one carries a tag: "Deadline moved to …", "Amended". A cancelled one leaves the list and gets "Cancelled" in column E.
- Each notice shows Title, Organization, Bid start date, Bid end date, Budget, Summary of requirements and Bid documents available, an Official notice link, and the buttons Request more details and Start intake. The process check moves into the Sources details and has a 10th line: every listed document opened by Cue, or the reason it could not be.
- Only single notices: listing pages ("Multiple … notices shown on page"), sign-in pages, award notices (NOA), "RECHECK:" lines and items without an organization, reference, title or their own link are left out and counted in the Sources report. One key per reference number: "CITEM 2026-0404 (listing)" and "CITEM 2026-0404" are one notice. The same number at two different agencies stays two notices (the agency names are compared loosely, so "CITEM" and its full name match). Check 2 lists the titles it left out, so a real notice dropped by a word like "multiple" can be seen. The junk rows already in the sheet are not changed; the card ignores them.
- Documents: a new Reading stage after the search. Cue's code fetches each document link (HTTP 200 and a real PDF, Word, Excel or ZIP file by its first bytes), saves it to Drive "Cue bids / <agency> <reference>", and ChatGPT reads Cue's saved PDF (one call per notice, in parallel). Values from the document replace the web page's: budget, bid start and end dates, summary, eligibility, with the pages they came from. The card shows "Opened · saved · read" with a link to Cue's copy, or "Could not open: HTTP 403", "needs sign-in", "not a document (web page)", "too big (over 20 MB)". "Opened" never comes from ChatGPT's word. Limits: 3 documents a notice, 10 notices a run, 20 MB a file; the rest wait for Request more details. The stage saves after every 3 notices and stops starting new ones after 2.5 minutes, so a run is never cut off; the next resume carries on.
- Read once (Kiko 06:52Z): every document Cue opens is recorded in a hidden "Bid documents" tab of the Cue sheet (link, notice, result, HTTP code, Drive file, opened, read, what ChatGPT found). A link in that record is never fetched or read again. Notices already in the sheet show their stored values, so the daily run reads nothing it read before. Only a new link, such as an amendment, is opened.
- Request more details: opens the notice's documents not opened yet, retries the ones that failed, and ChatGPT reads every saved copy not read yet, in at most one call. A document already read is never read again. The notice and its sheet row update. If budget, dates or requirements are still missing, the card offers **Draft a question to the agency**: one ChatGPT call writes a short clarification email, saved in Kiko's Gmail Drafts (To = the BAC email from the documents only when it is on the notice's own domain or a .gov.ph one, otherwise blank; a second tap makes no second draft). It is never sent from Cue.
- Start intake: the same as "do intake for <reference>", for New and Still open notices. The intake text now has the bid start date, the summary and Cue's Drive copy of each opened document.
- Bid sheet: new column R "Bid start date (PHT)" (header written once); column K holds the summary; column N lists each document with its real state.
- Cost: 3 search calls as before, plus about 1 reading call per new notice with an opened PDF. Nothing on a day with no new notices. Request more details and the agency question cost at most 1 call per tap.
- Not tested yet: whether the agency sites let Google's servers download their files. The first /dev run shows it per file.
- Tests: 336 of 336 pass (BD1, BD4, BD6, BD8 updated; new BD13 read once, BD14 notice filter and Still open, BD15 Request more details and the agency draft, BD16 Start intake).

## Cue 1.31: ChatGPT reads Canvas and hands Cue work, start to finish in ChatGPT (not deployed)
## Cue 1.27.9: live 1.27.8 + add tasks, issues and risks + "add project" + tighter inside Canvas (release branch, not deployed)

Kiko 24 Oct 06:47Z ("they dont have add project", "add the tasks"), 06:49Z ("make the window smaller and tighter"), 06:50Z ("go").
Spec: specs/cue-add-tasks.md.

- "add task call venue to Globe party, due Friday, for Ana" (also "add issue …" and "add risk …") is read in code, with no AI call.
  Canvas finds the project (search_projects, a read), and Cue shows a card with Project, Type, Description, Due and Assigned to.
  Every field can be changed. When several projects match, Kiko picks one on the card. Nothing is written until Approve. Approve
  adds the row once through the bridge's add_tri_items (live since Canvas V202), which reads it back and never adds the same
  description twice (CueTri.gs).
- "Globe party tasks" and "tasks of Globe party" open the project's Main tab, the same place as Canvas's "Open tasks" button.
- "add project Unilever townhall, 300 pax, Dec 5" starts a normal project intake with no chat call. Every phase still needs
  Approve.
- Inside Canvas's slide-in, Cue is denser: smaller header, bars, thread rows, cards and buttons. Cue in its own tab is unchanged.
  The Canvas side narrows the panel from 1100 px to 860 px (CanvasWorkspace branch claude/project-thread-oqjr6f).
- `test/fixtures/ZapBridge.gs` refreshed from Canvas main (adds add_tri_items).
- PC check: on /dev, type "add task test from Cue to <a test project>". Check the card's fields, then tap Close. Approve
  writes to Canvas, so that tap stays Kiko's.
- PC check fixes (24 Oct 07:28Z; Kiko held 1.27.9 until "<project> tasks" opens the tasks):
  - "<project> tasks", "tasks of <project>" and "open <project> tasks" link to Main with `&focus=tasks`, and a saved task, issue
    or risk card opens Main with `&focus=tasks`, `issues` or `risks`. Canvas has no Tasks tab: the Canvas build with
    CUE-TASKS-FOCUS scrolls Main to that block and outlines it. Live Canvas before that build ignores the parameter and opens
    Main at the top, as before.
  - Close on a task card now ends as Closed, not Rejected, so the thread list says Closed.
- Tests: 332 of 332 pass (TR3 and TR5 cover the fixes).

## Cue 1.27.8: live 1.27.7 + pipeline review cards (Kiko 24 Oct 01:35Z) and the ✓ in every thread (06:44Z; release branch, not deployed)

- System emails are no longer "the client wrote last": Gmail drops no-reply, notification and HubSpot senders, and Cue skips mail with Auto-Submitted, bulk or list headers, or a login-code, password-reset or "you've been assigned" subject. Cue reads the 3 newest per deal and uses the first one a person sent.
- A deal with no HubSpot contact but a real email thread says who: "Contact not saved in Canvas (Gmail: name@client)" instead of "Missing contact".
- Each deal has its own action after Next: Draft reply or Draft follow-up (drafts that deal only), Fix in Canvas (the project, or the client's account), or Open email.
- Order on each deal: status, Last email, Next, action.
- The event countdown shows once: when a flag counts the days, the line under the name shows just the date, and Claude is told not to repeat the stage, amount, date, countdown or flags.
- No extra AI calls. Read only, as before.
- The ✓ (Close this thread) now shows in every thread that still has an open run, including threads whose older runs wait (a day's Bid check, earlier pipeline reviews) and failed runs. One tap closes every open run in the thread (`cueCloseThread`); a running or scheduled run is left alone and named. An intake that saved to Canvas still asks to cancel and remove, as before. Nothing is written or sent.
- Old runs (Kiko 06:52Z go): a new pipeline review closes the older one still waiting (same scope, no follow-ups drafted) with "Replaced by a newer pipeline review". Waiting on you gets "Close older runs" (`cueCloseOlder`), which closes the waiting or failed runs from before today of the scheduled jobs only (bid checks, ChatGPT tasks, pipeline and HubSpot reviews, status reports, skill checks). Kiko's own tasks and intakes are never closed by it. PC recheck fixes: a pipeline review that a newer review of the same scope replaced also counts as old, even from today; a review Kiko is working in (deals ticked, or follow-ups drafted and not all sent) is never replaced or closed by either path; and each thread gets one "Closed" line however many of its runs closed.
- A contact finding (Contact or Correction) on a ChatGPT task opens the client's Canvas account as "Fix contact in Canvas". Cue never deletes a contact; Canvas is where contacts change and HubSpot copies it.
- Tests: 323 of 323 pass.

## Cue 1.27.7: live 1.27.6 + CE cost / expense tasks save "Done" + Cue-in-Canvas guard fix (release branch; live as Version 50, 23 Oct 18:48Z)

Found while building the AI relay (dropped by Kiko 23 Oct 13:36Z). After Approve, a CE cost or expense task kept "Writing to Canvas" in the Cue sheet, though Canvas had saved it. A reload therefore showed the card still writing. The finished state ("Done" or "Done, check Canvas") is now saved. Nothing else changes.

- Backfill (PC check 13:44Z): tasks approved before this fix, such as the ₱540 printer ink expense recorded as AP-UNI-TRI-1, are set to Done on the 5-minute tick. A task qualifies when it is a CE cost or expense task, still at "Writing to Canvas" more than 10 minutes after Approve, and its thread has its "Summary for ..." line. A summary that names a problem gives "Done, check Canvas". Cue only reads its own sheet for this and makes no Canvas call. A task with no summary line stays as it is.
- Cue inside Canvas (Kiko screenshot 13:44Z): Cue showed "Cue only opens on its own or inside Canvas" in the Canvas slide-in. The frame guard now also accepts Canvas opened from its short link (canvas.blankspaceevent.com), and the cover names why it blocked ("Blocked: <site>" or "Canvas did not answer").
- PC look: approve one CE cost or expense card on /dev, reload, and check it shows Done. Old stuck cards turn Done within 5 minutes.
- Tests: 320 of 320 pass (CC2 and X4 check the saved state; X4b covers the backfill).

## Cue 1.27.6: live 1.27.5 + Cue 1.32 Cue inside Canvas only (release branch; 1.28 to 1.31 not included)

Same change as Cue 1.32 on main.

Kiko 23 Oct 07:39Z ("can we embed Cue in Canvas now. somewhere only i can see"), 08:48Z ("replace quick actions in canvas as Cue"),
08:52Z ("okay"; "make sure the UI matches Canvas since it will be inside it moving forward"). Spec: specs/cue-in-canvas.md.

- `doGet` allows framing (`XFrameOptionsMode.ALLOWALL`) so Canvas can show Cue in place of Quick actions (Canvas branch
  claude/project-thread-oqjr6f). Cue's web app stays "only me", so nobody else can load it.
- Frame guard (Apps Script can't set CSP frame-ancestors): every window above Cue must be script.google.com or an Apps Script
  sandbox, or Cue stays covered. Inside another app, Cue stays covered until Canvas sends `cueHost` (Canvas sends it only after its
  server confirms Kiko) and then answers only that window.
- Inside Canvas, Open in Canvas links ask Canvas to go to the page (`cueOpen`) instead of showing Canvas inside Cue, and Canvas
  can open a thread (`cueThread`, used by the Today card on Canvas Home).
- Look: Canvas's Workspace tokens (cream ground, white cards, ink text, deep purple buttons, magenta for "needs you").
- Tests: 337 (CIC1 to CIC4 new; CV10 follows the new button label colour).

## Cue 1.27.5: image batches for one task (not deployed)

Kiko 22 Oct 03:03Z, spec specs/image-batches.md (approved 12:39Z).

- One task now takes up to 30 files and 30 MB (was 10 and 20 MB), in one message or across several. Files from a client email (inbox triage) stay at 10 and 20 MB.
- "more coming", "sending images in batches" or the **More coming** chip (shown once files are attached) holds the files and text of each message instead of running a task. A line above the box keeps the count ("Holding 14 files from 2 messages for one task") with **Done** and **Cancel**.
- "done", "that's all", "go" or Done sends everything as one normal message: all typed text in order, plus all files. Text after "done" ("done, this is for the Unilever launch") is part of the instruction. With no text at all, Cue asks once what to do with the files, and the answer starts the task.
- "cancel batch" or Cancel drops the held list; nothing went to any AI. The last files and "done" can come in one message.
- One batch per box: the main chat or a thread. The held list is kept by Cue (one script property per box), so a reload keeps it. A batch untouched for 2 hours is dropped with a line in its chat.
- No AI call until Done. Expenses work too while the page stays open (an expense needs the photos themselves); after a reload, Cue asks to attach the receipts again.

## Cue 1.27.4: expense card doubts start ticked (not deployed)

- Kiko 22 Oct 06:09Z: every "Check these first" box on the expense card starts ticked; Kiko can still untick one before Approve. The ones Cue's own checks raise stay unticked with a note: a missing amount, date, expense type, CE category or proof file, an id Claude named that Canvas doesn't have, Canvas unsure of the project, a possible duplicate, or a scope that already has an award.

## Cue 1.27.3: in a Bid check thread, only an explicit redo runs again (not deployed)

PC session 22 Oct 05:58Z: on live 1.26.5, any reply Kiko typed in a Bid check thread, plain questions too, started a new check in a new thread, and those threads did the same.

- In a Bid check thread, only an explicit ask runs the check again: "redo bid check", "refresh bid opportunities…", "run it again", "check again". A question (ending in "?" or starting with can, why, what, how…), a "did not / don't" message, a sign-in question, or any other reply is answered in the thread.
- 1.27.2 change taken back: a later run no longer closes the earlier card. A later run lists only notices new since the last run, so the earlier card still holds its own notices (for example the 07:00 card). Runs still share one thread per day. The one-time tidy only groups threads and closes nothing ("Nothing was closed or changed"). It now runs under property value 2.
- Tests: 311 of 311 pass (new BD12; BD11 updated).

## Cue 1.27.2: one Bid check thread per day (not deployed)

Kiko 22 Oct 05:52Z: "why so many Bid checks?" Six Bid check threads waited at Needs you (13:10, 13:27, 13:28 x2, 13:29 x2).

- The day's first bid check is that day's thread. Any later run that day, typed or the 07:00 one, posts into it ("Running the bid check again in today's Bid check thread"). It never makes a new thread.
- A new run closes the earlier card in that thread that was still waiting, because it replaces it. That card says "Closed: a later run today replaced this card." The new run waits for Kiko only when it finds new or updated notices (as before).
- Once, on the first page open or 5-minute tick after this ships, the bid checks already made are grouped into one thread per day, and only each day's latest waiting card stays open. One line in that thread says so. Nothing in them was written anywhere but the bid sheet, so nothing else changes.
- Tests: 310 of 310 pass (new BD11; CC9 and CC12 now expect the same-day thread).

## Cue 1.27.1: bid check only when asked (not deployed)

/dev 22 Oct 05:27-05:29Z: five bid checks in 3 minutes, about 15 AI calls. Each one was started by a Kiko message that only mentioned bids: "refresh bid opportunities based on new rules" (a real ask), two questions about giving the PhilGEPS username and password, and twice "i did not ask this chat to run the bid opportunities again". The word "philgeps", or "again" inside a Bid check thread, was enough to start a run.

- A message that says no ("did not", "don't", "never", "stop", "no more", "not ask/want/need") or asks about a sign-in (username, password, login, sign in, credentials, account) never starts a bid check, in the main chat or in a Bid check thread. It gets a normal chat answer instead.
- Tests: 309 of 309 pass (new BD10 with Kiko's four messages).

## Cue 1.27: unscheduled alarm (not deployed)

Kiko 22 Oct 05:20Z: "can this alarm me if there's any task that is unscheduled". At 05:21Z Kiko picked Both.

- New system row **Unscheduled check**, daily 07:00, on. Code only, no AI call.
- It lists scheduled jobs that will not run: switched off, on with no next run, missed by more than 30 minutes, or last run failed.
- It also lists open tasks waiting on Kiko (Needs you, Failed or Reopened) that have no due date and no reminder. Reports that a schedule made (bids, the Monday check, ChatGPT tasks) are left out, because they come back on their own.
- One card in the main chat, only when something is found, with Got it and Mute these buttons. Mute these keeps those items off later cards. A new failure or missed run still shows. Run now says "everything is scheduled" when all is fine.
- Day one note: the HubSpot sales review and the ChatGPT tasks ship switched off, so the first card lists them. Turn them on in Settings, or tap Mute these.
- Tests: 307 of 307 pass (new SC8; SC4 and SC6 updated for the new row and the 3-rows-per-tick limit).

## Cue 1.26.7: the quick-action chip row under the chat box is gone

- Kiko 22 Oct 05:25Z: remove the chips (not used). Removed: New project intake, What needs me?, Money check, Clean up HubSpot, Snap an area. The features stay: type the ask in chat, open threads from the threads pane, and snap an area from the right-click menu ("Cue: snap an area").
- "Start an intake with that message" stays: it is not a fixed chip, it shows only after Cue suggests an intake for a chat message.
- Not deployed: handed to the Cue and Canvas deploys thread.

## Cue icon: the tab shows the Cue orb whichever Google account Chrome lists first; bubble icons all show the orb

- Kiko 22 Oct 02:33Z asked to fix Cue's icon and favicon; Kiko chose to keep the plain orb (05:20Z).
- The tab icon loads from Cue's private "Cue icon.png" in Kiko's Drive. Drive answers as Chrome's first signed-in account, so when that was not the BSE account the tab fell back to the Apps Script icon. The address now carries `authuser=<Cue owner's email>`, so Drive answers as Kiko's BSE account. The file stays private.
- Cue bubble 1.4.1: the 128 px icon (extensions page, Chrome Web Store style tile) was a ring with "Cue"; it is now the same orb as the 16 and 48 px icons, the tab and the header. Reload the bubble from chrome://extensions to see it.
- Tests: new IC1. Not deployed: handed to the Cue and Canvas deploys thread.

## Cue 1.26.6: answered questions no longer leave blank CUE_ASK_ Script Properties

- Kiko 22 Oct 02:49Z: the Apps Script Script Properties page listed many `CUE_ASK_ask-…` keys with empty values ("Value is required"). Each question with buttons (plan cards, Remember?, Learned, TickTick, schedule, which-command) is kept as a `CUE_ASK_<id>` property until it is answered. Answering set the value to blank instead of deleting it, so one blank key was left behind per answered question. Script Properties have a 500 KB cap, so these would keep growing.
- Answering now deletes the property. When a new question opens, Cue also removes every blank `CUE_ASK_` key and any question left unanswered for over 30 days (its button then says the question was already answered, or is over 30 days old).
- A tap that is not one of a which-command question's choices now keeps that question open, as the other question types already did; before, it closed the question.
- Tests: new TC8b. Not deployed: handed to the Cue and Canvas deploys thread.

## Cue 1.26.5: fixes from the /dev PC recheck of 1.26.4 (22 Oct 05:13Z)

- The leftover intake card in "Bid check 10/22 10:44" did not close. It had failed ("Canvas did not answer find_similar_projects"), and only Needs you cards were closed. "redo bid check" now also closes it when it failed, still only if it was never approved and saved nothing to Canvas.
- A readiness Go for Trick or Treat – Manila opened a new thread named "S-25506500TR" and sat at Finding project. The 1.26.3 run had gone to the Trick or Treat Iloilo thread instead. The chat call sees only the 10 newest threads, and "manila" was a skipped name word, so Manila matched Iloilo. Now code picks the thread for a readiness check: the thread of the project the ask names by Canvas id or by name. A name that carries a word the project lacks while the project carries one the ask lacks (Manila vs Iloilo) is not a match. A thread is about the first project it matched, so a run that joined it by mistake does not change it. A check that joins its project's thread reuses that project and skips Finding project, also when it is asked by Canvas id. The pointer names that thread.
- Old chat lines keep their text. The 1.26.3 "Answered in the Trick or Treat Iloilo thread." line stays as written.
- Tests: new CC15 and CC16 (305/305). Not deployed: handed to the Cue and Canvas deploys thread. No Canvas change.

## Cue 1.26.4: fixes from the /dev PC recheck of 1.26.3 (22 Oct 05:00Z)

- "redo bid check" in the "Bid check 10/22 10:44" thread still re-ran the PHASE 1 intake card that 1.26.2 had left there, and Kiko's message never showed. The waiting card took the reply before the bid route saw it. Now bid words in any thread whose root is a Bid check run a fresh bid check first, before any waiting card. Kiko's line shows in that thread. The stray intake card there is closed with "This thread is a bid check, not a project intake", but only when it was never approved and saved nothing to Canvas.
- After Go on a readiness plan card into the Trick or Treat – Manila thread, the main chat showed no "On it" line. The server wrote it, but the page shows each thread only once in the main chat, and the line came after other lines. Now the chat call's own pointer says "On it. Continuing in the <name> thread." when a readiness check, email, supplier search or map joins a thread, and no second line is added. The page also shows a pointer that comes right after a Go tap in the main chat.
- The old CE costs card for JBL Booth stayed open at Needs you next to the new one. A new CE costs check for the same project now closes an older card that was never approved, with "A newer CE costs check replaced this one. Nothing was written to Canvas." A card that was approved stays open.
- Tests: new CC12 to CC14 (303/303). Not deployed: handed to the Cue and Canvas deploys thread. No Canvas change.

## Cue 1.26.3: fixes from the /dev PC check of 1.26.2 (22 Oct 04:45Z)

- CE costs: Zaina Yu's quote for JBL Booth (AMI-66858OJB-V1) is one VAT-inclusive lot of ₱616,000. Cue had ticked Booth Area and Flooring ₱615,000 to ₱616,000 and left every other line blank. A price the email gives for several lines or the whole job is now a lot: the card shows it as one price, with what those lines add up to now, and ticks nothing, so Kiko types each line's unit cost or asks for a breakdown. ChatGPT is told to list lots separately. If it still puts a lot, package, all-in or VAT-inclusive total on a single line while the others are blank, code takes it off that line.
- "redo bid check" in a Bid check thread became a Project intake plan and an empty PHASE 1 card. "bid check" is now a bid ask, and inside a Bid check thread "again", "redo" or "re-run" also start a fresh bid check in its own thread, with no AI call.
- A photo Kiko sent in the Morning batch thread turned that thread into a change request. An intake never runs inside a thread that is not about a project (Morning batch, bid check, email draft, ChatGPT task, Teach Cue and similar). It gets its own thread, and the old thread says so. More papers sent in a supplier registration thread still stay there.
- Learned patterns showed "Project intake: update CE cost..." and "Project intake: redo bid check". Intake rows and routing examples for asks that now have their own code route (CE costs, bid check) are ignored and no longer shown.
- After Go, a readiness check (also a workflow map, email or supplier search) that joined an earlier thread said nothing in the main chat. It now says "On it. Continuing in the <name> thread."
- Tests: new CC8 to CC11 (300/300). Not deployed: handed to the Cue and Canvas deploys thread. No Canvas change.

## Cue 1.26.2: update CE costs from an email, with Kiko's approval

- Live 22 Oct 02:35Z: "Can you update CE Cost for JBL Booth? get cost from Zaina Yu's email and update the CE." showed a plan card promising "Write the approved CE cost in Canvas", then after Go said "I can't update the CE from chat", started a change request, said "This is about the email to Rommel, so I reopened its thread", and labelled the thread "Project intake". Cue had no CE cost command.
- New task "CE costs" (CueCeCost.gs). Kiko's words name the project and the person (no AI call, no plan card; nothing is written before Approve). Canvas finds the project (the thread's own project first) and lists its CE lines (new bridge read `ce_lines`). Cue finds that person's newest email in the last 120 days, preferring one that names the project, and reads its text, PDFs and photos. One ChatGPT call matches each quoted cost to a CE line (a line total is divided by qty x occurrence). The card shows every CE line's unit cost, old to new, ticked and editable, plus email items that fit no line, and Open in Canvas (CE Desk) as the other way.
- Approve and update CE writes only the ticked unit costs through the new bridge write `ce_update_costs` (CE Desk's own save, audit log, project-done lock). Canvas refuses a line whose cost changed since the card was read, reads every line back, and Cue reports each line. Prices, quantities, filed CE versions and the active CE are never changed. A reply in the thread ("from zaina@...", or the project) carries the same task on.
- An intake or change never "reopens" an email draft, style guide, Teach Cue, personal expense, workflow map, supplier registration or morning batch thread any more; only project threads take a new message.
- Tutor plans: the plan call is told to list only steps the command really does, and that CE cost changes are not a Project intake.
- Needs Canvas with `ce_lines` and `ce_update_costs` (CanvasWorkspace, same branch name). Until that Canvas release is live, the task stops at reading the CE lines with "Canvas refused ce_lines".
- Tests: new CC1 to CC7 (296/296). Not deployed: handed to the Cue and Canvas deploys thread.

## Cue 1.26.1: Morning batch inbox lines say what they are and what to do; missing tabs are made on first use

- Live 22 Oct 02:30Z: inbox lines on the Morning batch (for example "SALES TEAM", "Happi Party") showed only the sender, a "none" button, and Skip today / Stop chasing. The card read only a line's `why`, which inbox triage leaves empty, and drew the triage action `none` as a button. Inbox lines now show a tag (New inquiry, Needs your reply, FYI), the email's subject, ChatGPT's one-line summary, and what to do. The `none` button is gone.
- Inbox lines are not chasers, so their buttons are now Done (Got it on FYI lines) and Mute this sender. Muting adds a mute rule to the Triage rules tab, so that sender's mail is skipped from then on.
- Live 22 Oct 02:31Z: the card said "Inbox: The Cue sheet has no Triage log tab. Run cueSetup again." Any registered Cue tab that is missing (Triage log included) is now made, with its header row, the first time Cue needs it. Kiko never has to run cueSetup for a new tab.
- Tests: new TR7. Not deployed: handed to the Cue and Canvas deploys thread.

## Cue 1.25.7: Reset a learned pattern's count

- My rules > Learned patterns: any pattern with a count above 0 that has not graduated now has a Reset button, which puts its Go count back to 0. Graduated patterns keep Demote, which does the same and brings the plan card back. PC tests had left "Supplier search" at 2 of 3 and "ARs: prepare ARs" at 1 of 3 on the real Patterns tab, with no way to clear them.
- Tests: new TU21.

## Cue 1.25.6: readiness skips the project search inside a known thread, and times each Canvas call

- Live readiness checks took over 200 seconds, nearly all of it Canvas bridge time. A check asked inside a thread that already knows its Canvas project (an earlier readiness check, a change request, an intake written to Canvas, or AR prep) now reuses that project and skips find_similar_projects. An ask that names a different project, or gives a project ID, still goes through the normal path.
- Each Canvas call's time is kept on the request (metrics.canvas: calls, seconds, ok, start time), including calls Canvas refused. get_readiness and list_project_files still run together, so they share one entry whose time is the slower of the two.
- No Canvas changes. Not deployed: handed to the Cue and Canvas deploys thread.

## Cue 1.25.5: a finished readiness thread shows its card again

- Live 22 Oct 01:29Z: opening a readiness thread showed a blank pane. Its card drew nothing (the card function never returned what it built), and since 1.25 added Open in Canvas to that card, the page then hit an error. That error also stopped the chat and thread list from updating while the thread was open, so a new run looked stuck at "Finding project" and replies seemed not to come. The readiness card now returns its content, and a card that draws nothing can no longer stop the rest of the page.
- Tests: new RD20 (renders the card in a sandbox).

## Cue 1.25.4: a plan card's Go runs the task at once

- Live 22 Oct 01:22Z: tapping Go (or Change) on a tutor plan card started the task but the page never ran it, so it sat at its first step ("Finding project") until the 5-minute background check picked it up. A readiness check took 5 to 7 minutes this way. The page now runs the started task right away, as it does after a normal send. Picks that only answer in chat are unchanged.
- Tests: new TU20.

## Cue 1.25.3: trigger rollback safety

- When Cue sees a stored trigger version other than its own, it reinstalls every timed job it uses. That covers the sweep, the 07:00 bid check and now the Monday HubSpot check (`cueHsWeekly`). Rolling back from the single-trigger scheduler build (CUE_TRIGGERS_V 5) to this version therefore brings all three back the next time Cue is opened. Nothing changes while the stored version is 4.
- Tests: new S1b; S1 and BD9 now expect the Monday HubSpot trigger.

## Cue 1.26: fixes from the /dev PC test (01:41Z)

- Settings, Scheduled tasks showed every time as "Sat Dec 30 1899 07:00:00 GMT+0800". Sheets had turned the Time cell into a date. Cue now reads such a cell back as HH:mm and writes times as text, so the cell stays a time of day. Rows already in the sheet read correctly without being changed.
- Test taps on the test link (/dev) graduated Kiko's real tutor pattern for readiness. A preview now marks the copy it pushes to /dev as the test build (`CUE_DEV_`), and Go there never counts toward graduation or saves a routing example. src/ and every live version keep `CUE_DEV_ = false`.
- Tests: new SC9 and TU21; SC2 expects the time written as text.

## Cue 1.26: task scheduler (not deployed)

Kiko 21 Oct 19:12Z "we need a task scheduler", 19:13Z "run a command and tell Cue to Schedule a task followed by the task we want it to do". Spec: `specs/task-scheduler.md`, Kiko "Go" 22 Oct 00:57Z.

- **Chat:** `Schedule <when> <command>` (for example "Schedule every Monday 9am pipeline review", "Schedule Friday 3pm remind me to send the invoice", "Schedule 15th of the month 4pm …") shows a Save / Not that card. The time is read in code, so there is no AI call. Cue asks when the time is missing or already passed, and refuses intake because an intake needs an inquiry. `show my schedules` lists every schedule.
- **Settings > Scheduled tasks:** every timed job, both Cue's own and Kiko's, with on/off, Change time (in words), Run now, Open last result, and Delete (Kiko's only).
- **One trigger:** a new Schedule tab in the Cue sheet holds every timed job. The existing 5-minute `cueResume` starts due rows, at most 3 per tick, after its other work. The `cueSweep`, `cueBidsDaily` and `cueHsWeekly` triggers are removed (`CUE_TRIGGERS_V` = 5), so Cue keeps only `cueResume`. Their jobs are system rows: Morning sweep daily 07:00, Bid opportunities daily 07:00 and Monday HubSpot check Mon 06:00, all on. HubSpot sales review Thu 08:00 starts off because it needs CUE_HUBSPOT_TOKEN. The sweep row's hour and Chaser rules' "build at" stay in step.
- **ChatGPT tasks:** when `cueGtSchedules_` is in Cue (CueGptTasks.gs, separate branch), its tasks become system rows, off until Kiko turns them on, and each run calls `cueGtScheduled(key)`.
- **What a run does:** a reminder posts "⏰ Reminder: …" with no AI call. Sweep, bids, HubSpot and pipeline start their tasks directly with no routing call. Any other command runs as if Kiko had typed it (one chat call, and the tutor card if tutor mode is on). A run only prepares: drafts and approval cards, nothing sent. A late run says how late it was, and a missed time runs once, never piled up. A tick with nothing due reads one Script Property and does not open the sheet.
- Tests: 271 of 271 pass (new SC1 to SC7; S1, R6, C44 and BD9 updated for the single trigger).

## Cue 1.26: ChatGPT scheduled tasks (ships with the task scheduler)

Kiko's "Go" 22 Oct 00:55Z on specs/lead-gen-tasks.md and specs/cleanup-review-tasks.md. New `src/CueGptTasks.gs`, kind `gtask`.

- 12 scheduled skills from Kiko's Lead Generation Handbook and Cleanup and Review Schedule, plus 2 on request. Each one: code reads the records the skill names (corporate funnel workbook, Shared Task Tracker, TRI, Supplier Database, Admin Directory, BSE transfers, personal expense sheets, Kiko's work Gmail, Canvas board and readiness), ChatGPT follows the skill's numbered steps in one call (web search for the research skills), and code checks the steps were followed.
- Process check on every card: every step reported, coverage stated, evidence on every finding, no guessed email address (removed when not in any record), nothing claimed as sent or changed, only new findings (the new "ChatGPT findings" tab in the Cue sheet). Friday readiness also checks every eligible project was rated.
- Taps per finding: Draft email (a Gmail draft, never sent), Draft all (separate drafts), Add note or task to HubSpot (Kiko 19:54Z: HubSpot + Canvas; needs CUE_HUBSPOT_TOKEN with write access for companies, notes and tasks), Open in Canvas (Accounts, Suppliers or the project).
- Outreach holds (Accenture, IBM) never get a draft. LinkedIn, Facebook and sign-in pages are listed as not checked.
- Scheduler entry `cueGtScheduled(key)` (once per Manila day per key) and `cueGtSchedules_()` for the Schedule rows: repeat events 15th 07:00, moved contacts 16th 09:00, account research Tue 09:00, prospect follow-ups weekdays 08:00, monthly email 15th 16:00, daily plan 08:00, supplier files Mon 09:00, payment records Tue 09:00, project records Wed 09:00, funnel records Thu 09:00, production readiness Fri 09:00, personal spending 19:00. No trigger of its own.
- Chat words start each one with no chat call ("plan my day", "prospect follow-ups", "account research", "friday readiness", "personal spending report"...).
- PC test fixes (22 Oct, /dev): a record that could not be read now fails a new check "Every record read" and the card says "Incomplete: N records could not be read", status Needs you, never "Nothing new, all passed". Project records and Friday readiness retry Canvas's project list once, then stop with Try again (the test saw get_project_board answer HTTP 404 with no JSON; the action exists in Canvas V195). "What was checked" drops ChatGPT's talk of its instructions or the records tags.
- A ChatGPT task's thread and its summary line carry the skill's name (for example "Daily plan 10/22"), never the "Project intake" default.
- Tests: 275 of 275 pass (new GT1 to GT11).

## Cue 1.25.2: Request payment fill-ins from the 1.25.1 PC test (not deployed)

- Request payment now passes the card's expense type (`etype`) as well as the scope. Canvas fills Expense type from it once the CUE-LINKS etype patch ships (CanvasWorkspace, same branch); an older Canvas ignores it.
- Canvas's Request payment lists only scope cards marked For Payment Request. When the card's scope has another status, the card now says so under Open in Canvas ("SCP26-017-09 is "Awarded" in Canvas…"), and the Canvas patch's toast names the status instead of a generic "pick the scope".
- Only an amount given ("979 snack packs") now reads as quantity 1. A quantity of 0, or one equal to the amount, becomes 1; a real quantity (3 rolls) stays. The new scope's quantity follows the same rule.
- Tests: 264 of 264 pass (new CV14).

## Cue 1.25.1: fixes from the 1.25 PC test (not deployed)

The PC test at 20:33Z passed ARs, FSAs and New scope. Two fixes:

- "open receivables for Telus" opened Finance on Requests. Finance (page=playbook) starts on Requests; Sales, Payables and Projects with a client filter are on Finance Desk, so these links now open Finance Desk on the right tab, filtered to the client. "open finance" alone still opens Finance.
- "Record project expense 979 Fresh N' Famous snack packs for Trick or Treat Manila" (no file) showed PHP 0 and "Project not found". GPT was told to record only what a file shows, so it skipped the typed amount; it now reads Kiko's own line too, and code takes the typed amount if GPT still gives 0. When Canvas's expense lookup finds no project, Cue now runs the same project search as "open <project>" and uses what it finds (marked best guess when there are several).
- Tests: 263 of 263 pass (new CV13).

## Cue 1.25: Canvas opens filled, for everything Canvas 194 can take (not deployed; needs Canvas 194 live first)

Kiko's "Go" at 19:46Z, specs/open-in-canvas.md "Release" rows. Every link still works on an older Canvas: it opens the page without the new fill-ins.

- Prepare ARs: the card's Open in Canvas opens the AR generator on the project, not just the project.
- "make FSAs for <project>" opens the FSA generator on the project.
- Expense card: Request payment opens filled with the scope, amount, supplier and cost item from the card.
- Supplier card: Add supplier opens with every column on the card filled (address, province, owner, website, business type, TIN status and the rest). Bank details never go in the link: on tap, Cue hands them to Canvas over the bridge (`handoff_put`) and the link carries a one-time code that lasts 10 minutes. If Canvas can't take them, the plain link opens and Cue says to copy them from the card.
- When Kiko saves the new supplier in Canvas, Canvas says "saved" and the card moves on by itself (files the documents, drafts the request), the same as tapping Saved in Canvas. Other saves show "Saved in Canvas" on the pane.
- New commands: "open receivables for <client>" and "open payables for <supplier>" (Finance on that tab, filtered), "open account <name>" (Accounts, searched), "open CE for <project>" (Cost Estimates, searched).
- Money question and payment chaser cards open Finance.
- Tests: 262 of 262 pass (new CV11, CV12). The bridge fixture is Canvas PR #15's ZapBridge.gs.

## Cue 1.24.1: daily bid check at 07:00 (not deployed)

- Kiko 19:50Z moved the daily bid opportunity check from 08:00 to 07:00 Manila.
- On the first page open after the deploy, Cue deletes the 08:00 trigger that version 3 made and adds one at 07:00 (CUE_TRIGGERS_V 4). The other triggers are not changed.
- Tests: 260 of 260 pass (new BD9).

## Cue 1.24: AI usage and cost in Settings (not deployed)

Kiko 19:25Z: see how many API calls Cue made this month, the likely cost, and a monthly view. Spec: specs/usage-cost.md (Kiko OK 19:47Z).

- Settings (K avatar) > **AI usage and cost**: this month's AI calls (Claude, ChatGPT, failed), cost so far and the likely month-end in ₱ and US$, marked ESTIMATE. Tables by AI (model, calls, tokens in/out, ChatGPT web searches) and by command (top 8, rest as Other). A Monthly table with every month since Cue started; tap a month for its tables.
- Read only and plain code: it reads the AI Runs tab and the kind of each request. No AI call. It loads only when the section is opened.
- Prices are one editable table (US$ per million tokens in/out per model, US$ per 1,000 ChatGPT web searches, ₱ per US$), saved as Script Property CUE_AI_PRICES. Defaults: Claude prices as before, gpt-5-mini 0.25 / 2.00, web search 10.00, ₱58. Dated model ids (gpt-5-mini-2025-08-07) use the plain name's price. A model with no price shows "no price set".
- Likely month-end = cost so far + the average day of the last 7 days (or since the first call, if newer) x days left. Marked "rough" while Cue has under 7 days of log.
- The AI Runs Cost column now fills for ChatGPT too (it was blank because OPENAI_PRICE was never set), web searches included, from the same table.
- Tests: 259 of 259 pass (new UG1 to UG5).

## Cue 1.23.2: Open in Canvas fixes from the PC test (not deployed)

The PC test of 1.23.1 at 19:40Z passed: Canvas opens signed in inside Cue's right-hand pane. Fixes from it:

- The supplier card's "Open in Canvas" button showed as a blank blue bar. Links on cards were coloured the same blue as the button. The label is now dark on blue (light on the outline buttons).
- "add scope LED wall to …" now also sends the scope name. Canvas picks the Requirement when one matches that name; otherwise it fills Scope. Description is filled as before. Filling Scope and Requirement together needs one line in the next Canvas release (Cue already sends `scope` for it).
- The Canvas pane shows "Loading Canvas… a project can take up to 30 seconds." It goes away after 30 seconds or when Kiko clicks into Canvas.
- Why the 12-second "Open in a new tab" note never showed: Canvas sends its "ready" signal as soon as its page starts, before the project's data loads. So sign-in worked and the note correctly stayed hidden; the wait after that was Canvas loading the project.
- Tests: 254 of 254 pass (new CV9: a supplier's bank, account, IBAN and SWIFT never go into the Add supplier link; new CV10: the button label and the loading line).

## Cue 1.23.1: bid check polish from the PC test (not deployed)

The PC test of 1.22.1 at 19:32Z passed (5 new notices, 8 of 9 checks, 49 s). Three small fixes from it:

- Each bid check's name now includes the time ("Bid check 10/22 03:15"), so two runs on the same day have different names.
- Blank rows in the bid sheet no longer count as earlier notices, so check 7 never shows an empty "Not rechecked: ," line.
- Check 9 now reads "You pick which ones go to intake (Cue never marks them)" instead of "Intake?? left for you".
- Tests: 252 of 252 pass (new BD8).

## Cue 1.23: Open in Canvas, filled (not deployed)

Kiko 18:57Z and 18:59Z: when Canvas has the data or the process, Cue opens that Canvas page with the details filled in and shows it, instead of redoing it in a Cue card. Spec: specs/open-in-canvas.md (Kiko OK 19:20Z: no bank details in links).

- Canvas shows inside Cue, in the right-hand viewer pane, on a PC. On a phone it opens in a new tab, because Google blocks the sign-in inside a frame there. If Canvas doesn't send its "ready" signal within 12 seconds, the pane says so and offers a new tab.
- New commands, read in code with no AI call: "open <project>" (also "open <project> expenses / scope / checklist / timeline"), "request payment for <project>", "add scope <what> to <project>", "close task <task> in <project>", "price watch <item>" / "past prices of <item>", "open supplier <name>", "open finance / accounts / cost estimates / price list / suppliers / freelancers / canvas", and "make FSAs [for <project>]". Canvas finds the project with search_projects, then find_similar_projects (both reads). Several matches: Cue asks which, with one button each. A name Canvas doesn't know goes to the normal chat call.
- Cue uses the links Canvas's own quick-command bar already uses, so this needs no Canvas release. The Canvas address is Canvas Workspace's main /exec (script property CUE_CANVAS_URL overrides it).
- Register supplier: the card's main button opens Canvas's Add supplier form with the name, contact, type, city, service and TIN filled in. If Canvas already has the supplier, the button opens that supplier instead. Bank details never go in the link; the card shows them to copy. After saving in Canvas, **Saved in Canvas** finds the supplier there (supplier_check), then files the documents and drafts the documents request. Adding from Cue stays as a fallback.
- Prepare ARs: the card's main button opens the project in Canvas, where Generate ARs is. Making receipts from Cue stays as a fallback.
- Every card with a Canvas page gets an Open in Canvas button. Readiness opens the Checklist tab, an expense opens Request payment, a change request opens Scope, a supplier search opens Price Watch, and an intake opens its project once Canvas has it.
- Tests: 251 of 251 pass (new CV1 to CV8), on top of 1.22.1.

## Cue 1.22.1: a bid check never shows as a Project intake (not deployed)

PC test 19:23Z on /dev: "run bid opportunity check" posted the right summary ("4 new … Process check 7 of 9"), but the thread was titled "Project intake" and the card read "Project intake stopped" with Try again / Reject.

- The page names a bid check "Bid check" while it works, and every bid check uses its own card. A stopped one shows "Bid check stopped" with the error and Try again. It never shows the intake card or Reject.
- While ChatGPT searches, a bid check holds its run for 7 minutes, longer than Apps Script's 6-minute limit. The 5-minute resume can no longer start a second run of the same check midway (which also meant paying for the searches twice).
- Tests: 243 of 243 pass (new BD7).

## Cue 1.22: Find and Screen Bid Opportunities (not deployed)

Kiko 19:04Z-19:10Z, specs/bid-opportunities.md, Route B (ChatGPT through the API).

- New command: any chat message about bid opportunities ("run bid opportunity check", "any new bids today?", "check philgeps", "look for tenders") starts a bid check in its own thread, with no chat call. It also runs by itself every day at 08:00 Manila (trigger cueBidsDaily, once per day).
- ChatGPT searches Kiko's 11 sources in 3 parallel web-search calls, following the 8 recorded steps, and reports each source as Checked, Partial or Blocked.
- Code applies Kiko's screen: ABC from ₱150,000 to ₱700,000; NCR, Batangas, Laguna, Cavite, Rizal, Bulacan or Quezon; never Bataan; deadline still open. An unclear budget, place or deadline is marked "For verification", not dropped. Duplicates are merged, and earlier open notices are rechecked.
- The card shows only new opportunities, plus an "Updated" line for an earlier one whose deadline or amendments changed. It also shows the 9-point process check and the sources list. There is no Pursue button: "do intake for <reference>" starts the normal intake with that notice and sets Intake?? = Yes.
- New rows go to the "Web bid findings" tab of Kiko's bid sheet, and one row per source to "Web source scan log" (Script Property CUE_BIDS_SHEET_ID; the default is the BSE Inbox RFP & Bid History sheet). Nothing is emailed, written to Canvas, registered or submitted.
- Limit: the API has no browser and no sign-in, so the new PhilGEPS signed-in search and locked files show as Blocked or "not opened".
- Tests: 242 of 242 pass with 1.21.1 merged in (new BD1 to BD6; S1 now expects the 08:00 trigger).

## Cue 1.21.1: a thread keeps the name of its first task (not deployed)

Kiko 19:20Z picked "First task names it". A thread's title comes from its first named task (a Morning batch never names it), so a later task filed into it, like an expense, no longer renames the LED wall thread "Expense · AMI Group".

## Cue 1.20.3: page fixes from the 1.20.2 PC test (not deployed)

- Thread ✕ closes the pane and forgets the threads opened before it, so it never steps back to an earlier thread or keeps its title. The narrow-window ✕ does the same.
- A workflow map thread ("Map: Supplier payments") shows its card again instead of "undefined". The card function had lost its return line.
- Kiko's sent line shows once when a poll brings it back from the server before the send returns.
- Learn my memory: Claude's summary names saved facts by their words, not by their number (no more "fact 77's neighbor (fact 68)").

## Cue 1.20.2: tutor mode fixes from the PC test (not deployed)

PC test of 1.20 on /dev, 21 Oct 18:15Z.

- "LED wall for AMI Group" showed the old "I am not sure… Supplier search / Project intake / Just chat" buttons, with a recap of an earlier search. Tutor mode now shows the plan card in both cases: when Claude is not sure, and when a short main-chat message names no command. The card shows Cue's best guess (a phrasing Kiko taught wins), plus "Not sure: it could also be …". Not that lists those other guesses first. Go on the best guess needs no second AI call when Claude filled it in.
- A rejected expense's summary read "Summary for Project intake: rejected". It now names the expense, for example "Summary for ₱500.00 tarp for AMI Group".
- A thread showing the Unilever intake was titled "Morning batch 10/22". Phased intakes now carry their client name for the thread title, and a morning batch never names a thread that holds other tasks.
- Expenses still start their own flow with no plan card. Their own approval card comes before anything is saved, as the spec says.
- Tests: 229 of 229 pass (new TU7, TU8), on top of 1.20.1.

## Cue 1.20.1: a table pasted with tabs is learned, not run (not deployed)

PC test of 1.19.6 (18:17Z): three "phrase<TAB>meaning" rows starting "Record project expense" still started an expense, and one row did too. 1.19.6 only looked at pastes of 5 lines or more.

- A pasted table of "phrase<TAB>meaning" rows goes to Learn my memory, even one row. Each tabbed row needs a short phrase and a meaning of 3 words or more, and no amounts. A tabbed receipt or bank table with amounts routes as before.
- The page and the server use the same check.

## Cue 1.20: tutor mode (not deployed)

Kiko 17:39Z-17:46Z: "rather than it doing things right away... it asks first Claude to see what it needs to do". Kiko picked option C of specs/tutor-mode.md.

- Claude now makes the chat call (it was GPT). When a message would start a command, nothing starts. Cue shows a plan card first: "Here's what I'll do", the reading in one line, numbered steps with who does each (code, Claude, ChatGPT, Canvas, Kiko), and Go, Change and Not that.
- Go runs the plan as planned with no new AI call. It also counts one approval for that kind of request and saves the phrasing as a routing example.
- Change: Kiko types what to do instead. Claude plans again with that correction, and a new card shows.
- Not that: up to three other commands plus Just chat. The pick is saved as a routing example.
- Second opinion in code: Kiko's saved phrasings (word for word, or most words shared). When the code and Claude disagree, a fresh ChatGPT call sees both plans unnamed and in random order, and picks one or neither. Two of three win, and the card says so under Checks. When they are still split, Kiko picks from buttons.
- Graduation: 3 Go taps in a row for the same pattern (command plus Claude's short name for the kind of request) and it runs on its own, with "Ask me again next time" under the run. Change or Not that start the count again. Emails never graduate. If Kiko repeats the exact words of an approved request for a graduated pattern, it runs from the saved plan with no AI call.
- My rules now has a "Learned patterns" section: each pattern, its Go count, and Demote for the graduated ones. Store: the new Patterns tab.
- In tutor mode, the 1.19.1 rule (a short "LED wall for AMI Group" asks intake or supplier search) is replaced by the plan card.
- Not changed in 1.20: explicit commands ("remember:", "learn my …", "connect ticktick"), replies to a phase card, and the keyword shortcuts. Those are money questions, personal expense, supplier registration, HubSpot clean-up and re-cost, and each still shows its own approval card before anything is saved.
- Switch: Settings > Tutor mode ("Show me the plan before Cue starts anything", Script Property CUE_TUTOR). Off goes back to the GPT chat call that acts at once. CUE_TUTOR_EFFORT (default low) sets Claude's effort for the plan call.
- Tests: 226 of 226 pass (new TU1 to TU6), on top of 1.19.6.

## Cue 1.19.6: a pasted memory list is learned, not run (not deployed)

Kiko 18:00Z: a pasted phrasebook whose first row was "Record project expense" started an expense.

- A pasted memory list or phrasebook goes to Learn my memory, with or without "learn my memory" in front: "learn my memory" anywhere, a "What you say / What it means" table, a column of quoted phrases, or mostly "Kiko prefers / wants / uses …" lines.
- The page no longer sends such a paste to the expense form, and the server checks it before personal, money and chat routing. A client brief or a one-line expense routes as before.
- Kiko's 10 phrases from that paste are saved as Always rules under My rules.

## Cue 1.19.5: plan asks stay out of unrelated threads (not deployed)

PC retest of 1.19.4 (17:58Z): "Write a plan for a client year-end thank-you campaign" went into the Morning batch thread, and the chat said "Answered in the that task thread."

- A plan, checklist, brainstorm or analysis ask joins a task's thread only when it names that task's client, project or topic. Otherwise the main chat answers it. A Morning batch never matches, because its name has no topic words.
- The pointer line uses the task's real name ("Answered in the Morning batch 10/22 thread.") and never says "the that".
- Tests: 219 of 219 pass (new SK4, through cueSend).

## Cue 1.19.4: long chat replies are not cut (not deployed)

PC retest of 1.19.3 (17:52Z): the "Write a plan" reply stopped mid-sentence ("I'll make Gmail drafts and a").

- Cause: Cue cut every chat reply at 3,000 characters (and the chat log at 5,000).
- Chat replies now keep up to 8,000 characters, and the chat log up to 9,000. Anything longer ends at the last full sentence with "(cut short)", never mid-word.
- Plan, checklist, brainstorm and analysis asks get up to 4,000 output tokens, so the model can finish. Other chat stays at 1,500.
- Tests: 218 of 218 pass (new SK3).

## Cue 1.19.3: PC regression fixes, Personality, Settings page, card minimize (not deployed)

PC test of 1.19.1 (21 Oct 17:42Z), and Kiko's asks at 17:29Z, 17:42Z and 17:44Z.

- "LED wall for AMI Group" shows Intake / Supplier search / Just chat even when the chat call only answered (for example "No Canvas project matched").
- Thread ✕ closes the pane on a wide screen too. ☰ Threads opens it again.
- Chat order: when Cue answers a main-chat message in an older thread, the "Answered in the … thread" line now shows under the message it answers, not only at the thread's first line.
- Viewer: a fresh screenshot (image.png) with no Drive thumbnail yet is fetched from Cue itself, so zoom and rotate work, and file-card thumbnails no longer stay black. Transparent images sit on white.
- Chat bubbles: file names under a main-chat message are links again and open the viewer.
- A thread's task card can be minimized. It becomes a bar on top of the reply box showing the title and "Needs you"; tap the bar to open it again. This is remembered per thread.
- Personality: Kiko picked "Warm and witty". It goes only into the chat call; cards, errors and emails stay plain. Edit it or switch it off at the top of My rules. It is stored as one Memory row, Topic "personality".
- Settings page: the K avatar at the top right, or ⋯ in the Threads pane, opens it. It has Memory, rules and personality; Processes; Chaser rules; Connections (TickTick, HubSpot, Google: shows only whether each is set, never a token); and Auto-send (all off). My rules and Chaser rules moved here from the Threads pane.
- Tests: 217 of 217 pass (new TC14).

## Cue 1.19.2: TickTick card always shows; "write a plan" is chat (not deployed)

PC test on /dev 1.19.1 (17:42Z) found two problems.

- TickTick not connected: Cue said "tap Add" but showed no card, then "not connected". Now the Add or Skip card always shows. When TickTick is not connected, the card says so first. Add keeps the to-do (up to 20), and Cue adds it right after Kiko types "connect ticktick" and signs in.
- "Write a plan for onboarding a new freelancer" started a workflow map. A plan, checklist, brainstorm or analysis ask is now answered in chat with the Write a plan (or matching) process. Only map, Zap, workflow or automate words, or picking Workflow map, start a map.
- Tests: 216 of 216 pass (new SK2; TT2 covers the kept to-do).

## Cue 1.19.1: fixes from the PC test of 1.18.1 (not deployed)

PC test of 1.18.1 on /dev, 21 Oct 17:30Z.

- A short main-chat message with no verb or question, like "LED wall for AMI Group" or "LED wall", no longer starts a task or joins an open thread. Cue asks "Project intake or Supplier search?" with buttons plus Just chat. This is decided in code, so it happens even when GPT is sure. Greetings and clear asks ("find suppliers for an LED wall in Cebu") work as before.
- Chat replies are in English unless Kiko writes in Tagalog or Taglish.
- "remember:" for a rule that was switched off turns it back on and shows Learned with Keep/Undo. For a rule that is already on, the reply says so and points to My rules.
- The thread's ✕ closes the pane. "Threads ›" is still the way back to the list.
- Tests: 215 of 215 pass (new TC12, TC13).

## Cue 1.19: skills and TickTick (not deployed)

Kiko 17:26Z approved "step 1 + TickTick" of specs/cue-skills-connectors.md.

- Skills: the useful parts of the Data, Superpowers and Product design skills are now four approved processes in the Workflows tab: Analyze data, Brainstorm an idea, Write a plan, Review a design. They are written once, with Target "Chat" and Use in prompts on. Kiko edits or switches them off there.
- A Chat process shapes only the chat reply, and only when Kiko's words match its trigger. An intake brief that says "booth design" never pulls the design review into costing. No extra AI call.
- TickTick: "add … to my TickTick" fills a to-do in the chat call Cue already makes (new "todo" field, no extra AI call). Cue asks "Add to TickTick: …?" with Add or Skip. Nothing reaches TickTick before Add, and Add creates it once.
- "What's on my TickTick" lists open tasks from the Inbox (and CUE_TICKTICK_PROJECT when set), soonest due first. Read only.
- Connect: "connect ticktick" (no AI call) gives the setup steps, then a sign-in link. TickTick sends Kiko back to Cue, which checks the one-use state and keeps the token in Script Property CUE_TICKTICK_TOKEN. The token never shows in chat or the sheet.
- Kiko setup: make an app at developer.ticktick.com (Manage Apps), set its redirect URL to Cue's web app URL, add CUE_TICKTICK_CLIENT_ID and CUE_TICKTICK_CLIENT_SECRET in Script Properties, then type "connect ticktick".
- Tests: 213 of 213 pass (new SK1, TT1 to TT3).

## Cue 1.18.1: My rules (not deployed)

Kiko 17:12Z: "we should have custom rules area and it should pick up these rules as we go".

- A "My rules" card in the Threads pane, open by default, above Chaser rules. The pane's ⋯ button jumps to it.
- It lists the rules Cue follows, newest first. Each one has a switch, Edit and Delete. An Add box at the top lets Kiko write a rule by hand; it is on and used in every task.
- The other facts Cue remembers sit in a folded section below the rules, with the same controls.
- It reads the Memory tab, so there is one store. A rule Cue learns shows in the list once its "Learned" question appears in the chat, and an approved "learn my memory" or "learn from chats" card refreshes it too.
- Each change checks that the row still holds the text Kiko saw. If the tab changed underneath, nothing is changed and the list reloads.
- Tests: 209 of 209 pass (new TC11).

## Cue 1.18: learn from exported chats (not deployed)

Kiko 17:04Z: "i wanna be able to download chats and load it to him so he can learn". Spec: specs/teach-cue.md "Next".

- Type "learn from chats" (or "learn from chats 100"). Cue asks for the ChatGPT or Claude data-export zip, or its conversations.json.
- The page reads the export on Kiko's computer, straight from the zip's directory, so a large export never uploads. It keeps the newest 50 conversations: Kiko's own words, a little of each answer, about 3,000 characters a chat.
- Claude reads 10 chats per call, all in parallel (5 calls for 50). It returns facts, rules and "phrase means command" examples. Repeats, anything Memory or routing already has, and secret-looking lines are dropped. A batch that fails is skipped with a note.
- One card, grouped by topic: untick, edit, Approve, or one-tap Reject. Facts and rules go to the Memory tab (rules are used in every task). Phrasings go to the hidden Routing examples tab. The chats file is binned after Claude reads it.
- Tests: 208 of 208 pass (new TC10). Playwright read a real zip in Chromium and sent the newest 2 chats.

## Cue 1.17: Cue learns from corrections at once; asks when unsure; Wrong command (not deployed)

Kiko 17:00Z picked Teach Cue items 2 and 3; 17:03Z "something needs to be done to expedite how he learns". Spec: specs/teach-cue.md (add-on sections).

- Corrections are learned at once. When Kiko corrects Cue or states a rule, the chat call Cue already makes returns it (new "learn" field, no extra AI call). Cue saves it to the Memory tab as a rule used in every task and shows "Learned: …" with Keep or Undo where Kiko said it. Undo switches the row off. Every GPT and Claude call reads Memory, so the rule applies from the next message.
- "remember: …", "rule: …" or "from now on …" in any thread, including a phased intake's, saves the rule with no AI call.
- Kiko's intake rules are seeded into Memory once: same-project check first, answer questions instead of rescanning, nothing saved before Approve, cancelling an intake removes its records.
- Asking when unsure: when the chat call cannot tell which command Kiko means, Cue starts nothing and shows the top 2 as buttons plus Just chat. A button starts that command from the details the same call filled. In a task's thread it asks in words.
- Wrong command?: on a waiting task that came from a message (no files, nothing in Canvas yet), pick the right command. Cue closes the task, starts the right one from the same message, and asks once "Remember that … means …?". Yes saves it to the hidden Routing examples tab, and the 5 closest examples go into each chat call.
- Up to 12 rules marked Always are added to every call, newest first.
- Tests: 207 of 207 pass (new TC5 to TC9).

## Cue 1.16.1: Same project? first, Cancel intake removes it from Canvas (not deployed)

Kiko re-ran the Unilever intake at 16:45Z. Phase 1 failed with "is already in the Admin Directory", four times, and Cue never asked whether it was the same project.

- Cause: Cue's "Same project?" check did run, but Canvas's similar-projects list came back empty for this project, so Cue did not ask. The Cue matcher accepts it (test SAME1), and so does the Canvas matcher in the repo (test SIM1).
- Before phase 1, Cue now also asks Canvas for a project with exactly this name and an event date within one day (search_projects). A match shows the Same project? card.
- If Canvas still refuses a project it already has, the refusal becomes the Same project? card in the thread, never an error.
- On that card, "Remove it, add this one" asks once, then removes that project from Canvas (only a project a Cue intake made) and shows phase 1 again for approval.
- Phased intakes now show the Same project? card. Before, the phase card covered it.
- Cancel intake (Kiko 16:53Z: "when the whole thread gets cancelled it should delete and not save any record"): a button on the intake card, and the thread's Close button for an intake that saved something in Canvas. One confirm, then Canvas removes the project, its lines, contacts and folders (folders go to the Drive trash). Reject on one phase still only stops that phase.
- A question asked in an intake thread gets an answer, not a re-read with the question as the note.
- The same error shows once, not once per tap.
- This needs the Canvas bridge step intake_remove (CanvasWorkspace branch claude/project-thread-q9uyhb). Until Canvas has it, Cancel intake says Canvas cannot remove projects yet, and removes nothing.
- Tests: 202 of 202 pass (new SAME1 to SAME3, UNDO3, UNDO4, ASK1).

## Cue 1.16: Teach Cue, memory and processes (not deployed)

Kiko 16:26Z: "go build Teach Cue". Spec: canvas-integration/specs/teach-cue.md.

- "learn my memory" followed by a pasted list (ChatGPT: Settings > Personalization > Manage memories) starts its own thread. One Claude call splits it into facts, tags a topic, and marks up to 5 as used in every task. Code drops repeats, facts already in the Memory tab, and anything that looks like a password, key or account number; long digit runs are masked before the text leaves Cue.
- "learn my process" followed by pasted custom instructions, a GPT skill or a description: one Claude call writes each process as short steps with one owner each (Claude, ChatGPT, Code, Canvas, Kiko). The Process Mapper's rule check flags writes or sends with no Kiko step, Canvas writes not read back, and too many AI steps.
- The card: tick, edit (facts, or steps as "Who: what" lines and when it applies), Approve and save, or one-tap Reject. Nothing is saved before Approve.
- Facts go to a new Memory tab (On | Topic | Fact | Always | Saved | Request). A fact that updates an old one replaces its row. Processes go to the existing Workflows tab with a new "Use in prompts" column switched on; a re-taught process becomes the next version. Kiko edits or switches either off in the sheet.
- Every GPT and Claude call now adds, after its own instructions: the Always facts, up to 8 facts that share words with the call's input (about 1,200 characters at most), and at most one process whose name or "when it applies" words match. No extra AI call. With no Memory tab and no process switched on, every call is exactly as before.
- Tests: 196 of 196 pass (new TC1 to TC4).

## Cue 1.15.3: Leave blank per line; Reject on costing (not deployed)

Kiko 15:48Z: "there should be an leave cost and price blank per item" and "why is there no Cancel or Reject?" on the phase 3 costing card.

- Each costing line has a "Leave blank" tick. Save prices then writes that line to Canvas with no unit cost and no unit price, whatever was suggested or typed on it. Its sources and BSE price link are cleared, so Canvas does not fill a price back in.
- The costing card has Reject (one tap, no reason) next to Save prices and Edit. Edit becomes Cancel edits while editing. Reject keeps the project and its lines in Canvas with no costs, and the chat says so.
- Tests: 192 of 192 pass (new PH11).

## Cue 1.15.2: one save per tap; task errors stay in the thread (not deployed)

Kiko's live test at 15:43Z: "Approve, add to Canvas" showed "Canvas refused intake_add_project (Blocked): request is Adding project" twice in the main chat, then the same for intake_add_lines. Canvas had in fact added the project (S-11267432UN, 15:42:57Z) and the lines (15:45:38Z) on the first tap; the AI Queue ledger shows both.

- Cause: the card is redrawn every few seconds, so the tapped button came back on while Canvas was still saving (30 to 100 seconds). The later taps also got past Cue's "already saving" lease, because sheet writes were not flushed before the lock was released.
- The lock now flushes before it lets go, so a second tap sees the lease and is ignored without an error.
- The tapped button stays off and reads "Saving…" until Canvas answers.
- If Canvas says an earlier tap is still saving, the card says so. That is not an error, and nothing is saved over the newer copy of the card.
- A failed tap never saves its stale copy over a newer one, so a phase can no longer be undone by a late error.
- Errors about a task go to that task's thread, not the main chat. The Chrome snap note shows under the chat box for 12 seconds and is not a chat message.
- Tests: 191 of 191 pass (new PH10).

## File names open in the viewer; version label (not deployed)

Kiko's live check of 1.15 at 15:35Z: tapping image.jpg in a chat bubble, or on the Project intake card, did nothing.

- Cause: the "📎 a.jpg, b.pdf" line under Kiko's message, and the 📎 line on the intake card, were plain text, not links. Only the file cards in a thread were links.
- Each file name that matches a saved Drive file of the task is now a link, and tapping it opens the viewer (third pane). Tapping a file name in the main chat opens the file, not the thread. A name with no saved file yet (still uploading) stays plain text.
- The header now shows the version the page runs, for example "· Cue 1.15", next to "One chat. Each task gets its own thread." Kiko can confirm after a reload that /exec serves the new version.
- Tests: 189 of 189 pass. Playwright checked the chat bubble chip (opens floorplan.jpg, 1 of 2) and the intake card chip (opens brief.pdf, 2 of 3).
## Cue 1.15.1: one card per request (not deployed)

Fixes a problem found in the live test at 15:34Z: one Unilever request made two intake cards, and the two cards disagreed.

- Pasting or attaching a project again while its phased intake card is waiting no longer starts a second intake. The message goes into the same card, and Cue says so in the main chat.
- A second read of the details (from a new message, a note or new files) now adds to the first read and never wipes it. Contacts, venue, dates, schedule and questions found by either read stay on the card.

## Cue 1.15: Project intake in four phases (not deployed; needs the Canvas release with it)

Kiko 21 Oct 14:53Z asked for this, and said "build" at 14:57Z. Spec: specs/phased-intake.md.

- Each intake now runs in four phases, and each phase has its own Approve. Canvas gets only what that phase approved:
  1. **Project details.** GPT reads the inquiry, and Canvas checks for the same project. Approve adds the project only: client, contacts, schedule and folders.
  2. **Requirements.** Claude breaks the inquiry into short rows: item (6 words at most), spec (12 words at most), qty and days. Approve adds the lines with no costs. Rescan reads them again, using Kiko's note if there is one. Reject keeps the project in Canvas, with no lines.
  3. **Costing.** Canvas evidence comes first, then GPT web research for the gaps, then Claude's costing. Save prices writes unit cost and price after Canvas re-checks them.
  4. **RFQs.** Each RFQ has Send RFQ (from Kiko's Gmail), Save as draft, Edit email and Cancel. Canvas records each one, and the task is Done when no RFQ is left open.
- **One card per task, inside its thread.** The card updates in place, and finished phases fold to one line. A reply in the thread while a card waits changes the same task (re-read, rescan, re-cost or redraft). It never starts a new run or a new card.
- **Reject is one tap.** There is no reason box on any card now, and Cue records "Rejected by Kiko" with the phase.
- The card shows short flag labels: No cost, No price, Research price, No supplier.
- The budget is unchanged at 5 AI calls (4 without research). Cue's working time is counted across phases.
- Setting the Script Property `CUE_PHASED=off` brings back the old one-card intake.
- **Needs the Canvas release (CanvasWorkspace branch claude/project-thread-q9uyhb).** It adds the bridge steps intake_add_project, intake_add_lines, intake_save_costs and intake_log_rfqs. Deploy Canvas first, then Cue.

## Three panes: a file and image viewer on the right; Cue bubble 1.4.0 (not deployed)

Kiko 21 Oct 14:54Z: "3 pane window - 3rd pane is for file / image viewer", with a screenshot of Claude's file viewer.

- Cue now has three panes: the chat on the left, threads in the middle and the viewer on the right. Any Drive or Docs link opens in the viewer, including a file card in a thread, a 📎 link or a link in the chat. Files no longer open as tabs in the threads pane.
- The viewer is laid out like Claude's:
  - The header shows the file name and ✕.
  - A row of buttons holds Download, Open externally and ⋯ More (Copy link, Reset zoom and rotation).
  - Image controls are − / Fit / + with a % readout, rotate and fullscreen.
  - The foot shows the type ("PNG • Image preview") and ‹ 1 of N ›.
- 1 of N steps through the files in the thread (or the chat) the file was opened from. ← and → step too, and Esc closes the viewer.
- Images load from Drive's thumbnail service, so zoom and rotate work on them. If an image doesn't load, the viewer falls back to Drive's own preview. PDFs and other files always use Drive's preview, which zooms by itself, so the zoom buttons are greyed out. Download uses Drive's download link; a Google Doc, Sheet or Slides file downloads as PDF, XLSX or PPTX.
- Fullscreen uses the browser's fullscreen when the Apps Script frame allows it. If not, the viewer fills the window.
- Narrow screens:
  - 900 px or less without the bubble: the viewer takes the threads pane's place until it is closed.
  - Phone width: the viewer is full screen.
  - With the bubble: when the window is under 1200 px, opening the viewer widens it by another 440 px, and ✕ gives that width back.
- **Cue bubble 1.4.0:** window shifts now add up when both the threads pane and the viewer ask for room, and each gives back its own share. Kiko reloads the extension once; the zip in project files is updated.
- Tests: 181 of 181 pass, and SN2 now expects 1.4.0. Playwright checks at 1440, 440 and 390 px covered open, zoom, rotate, next, fullscreen and Esc, with no page errors.

## Project intake card sections fold; only the first is open (not deployed)

Kiko 21 Oct 14:49Z: "for Project Intake - can the sections become an expandable section. on load they are folded except for the 1st section".

- The Project intake card has these folding sections: Details, Lines, RFQ drafts, Claude's study, Risks and Ask the client. A finished intake also has an RFQs section. Each section title shows its count.
- When the card loads, only Details is open. The card remembers what Kiko opens or folds when it refreshes. Edit lines opens the Lines section.
- The card's title, its warnings and its buttons stay visible outside the sections.
- The thread reply box no longer draws a second outline when it has focus.
- Tests: 181 of 181 pass. Playwright checked that the folding works at load, after a toggle and after Edit lines.

## The right pane looks like Claude's Threads panel; no Due / Priority / Remind row (not deployed)

Kiko 21 Oct 14:38Z sent two screenshots of Claude's Threads panel: "2 pane window how should look like". Kiko 14:42Z on the Due / Priority / Remind row: "remove this. i dont need this".

- Threads list: a header with a threads icon, "Threads" and a blue count of threads waiting on Kiko, then search, an archived filter and ⋯ (jumps to Chaser rules). Below it: "Welcome back, Kiko." and "N threads are waiting on you."
- Groups are rounded bars that collapse: Waiting on you, Working on and Recent. Each row has a dot, a bold title and a status of up to two lines; "Needs you" and "Failed" show in amber. A message-count chip and the time sit on the right.
- An open thread has a breadcrumb header, "Threads › name", with ✓ (close the task), ⋯ (Archive, closed threads only), ⤢ (wider pane, wide screens only) and ✕. Kiko's messages are bubbles on the right. Cue's messages are plain text. Attached files show as cards with a type label and a Drive thumbnail, and they open in the pane.
- The reply box spans the pane, with a ↵ send button inside it and + (attach) below it. A file opened in the pane has the same breadcrumb, plus ↗ to open it in a new tab.
- The Due / Priority / Remind row is gone from every thread. Close moved to ✓ in the header, and Archive moved to ⋯.
- Tests: 181 of 181 pass. Playwright screenshots were taken at 1440, 900 and 390 px with no page errors.

## Cue 1.14 (Kiko said deploy 14:36Z): 1.13.1 match fix, 1.13.2 ask first, ☰ Threads on the right (PR #23), one line per task and no double-Reject error (PR #24)

## A task shows once in the chat; a second Reject is a no-op (in Cue 1.14)

Kiko 21 Oct 14:32Z: "can the update not appear again? like the Pipeline Telus 4 replies. changes can appear on the first line since it updates anyway".

- In the main chat, each task appears once: its first line and its row, which keeps updating (replies, status, time). Later Cue lines that point to the same thread, such as "Summary for …", now show only in the thread.
- Rejecting a task that is already Rejected now changes nothing and posts nothing. It used to show "Something went wrong: This intake is Rejected and can no longer be rejected here." Other closed states still refuse as before.
- Tests: 181 of 181 pass, and the intake Reject test now also checks a second Reject.

## Cue 1.13.2 (Cue asks first when a project looks the same; Kiko 14:26-14:27Z; in Cue 1.14)

- Similar now means the Project Name, Account and Event Date all match: the client words overlap, the distinctive name words mostly match, and the event dates are within 30 days (or one side has no date yet).
- When Canvas has such a project, Cue stops at a new step, "Same project?", and asks on a card: "Yes, same project" for each look-alike, or "No, it is a new project". Nothing is done until Kiko picks. Yes runs the change function for that project; No runs the full intake. A Project ID in Kiko's message is the answer, so there is no question. A change request Kiko asked for goes to the change card as before.
- New server function `cueSameAnswer(id, projectId | 'new')`. No new AI call; answering repeats the two Canvas reads.
- Tests: N1 and C24 cover the question, both answers and the date and account rules. 181 of 181 pass.

## ☰ Threads in the chat's top bar (in Cue 1.14)

Kiko 21 Oct 14:24Z: "remove the Threads with a rounded border... the Threads with a Burger Menu put it on the main pane but on the right".

- The rounded Threads button is gone. **☰ Threads**, with its needs-you badge, now sits at the right of the chat's top bar, styled like the pane's tabs, and opens the Threads list.
- The pane's tab bar now holds only the threads and files Kiko opened. On a wide screen it hides when nothing is open.
- Tests: 181 of 181 pass. Checked in Chromium at 440 px and 1440 px.

## Cue 1.13.1 (intake never joins a project on a "similar name" alone; Kiko 14:22Z; in Cue 1.14)

- Cause: Canvas's duplicate check called "UNILEVER YEAR END PARTY 2026" similar to "Exilara Year End Party" (they share only "year end party"), and Cue turned any similar name into a change.
- Now Cue checks each Canvas hint itself (`cueSameProject_`). It is the same project only when Kiko's message has its Project ID, or the clients match and the distinctive name words (not client words, event-type words like year, end, party, launch, or years) mostly match. A different client, or a date more than 90 days away, is never the same project.
- No real match: the intake runs as new, with a note naming the near names. A change request Kiko asked for still goes to the change function.
- Tests: N1 (this case); C24 and C25 now use a read whose names really match. 181 of 181 pass.

## Cue 1.13: side pane in a narrow window, no Widgets page, Cue bubble 1.3.0 (Kiko said deploy 14:18Z)

Kiko 21 Oct 13:58Z: in the narrow Cue window, the pane must slide in on the right without covering the chat.

- The left side is always the main chat. **Threads** at the top opens the right pane, and its badge counts what needs Kiko.
- **No Widgets page** (Kiko 14:03Z: "if ever it should be embedded within the thread"). Needs you, Working on and Recent are the Threads list's groups. Each task's card (approve, send, progress) is in its own thread, and a closed task's thread ends with **Reopen**. **See archived**, the Chaser rules card and the Google access card sit in the Threads pane.
- At 900 px or narrower, the pane stays shut until Kiko taps Threads, a thread name or a file. It then sits beside the chat, never over it. With **Cue bubble 1.3.0**, the window grows by 440 px to make room. If there is no room on the right, it grows to the left. **✕** shuts the pane and puts the window back to its old size and place. Without the bubble, the pane takes half of a narrow window, and it covers the chat only on a real phone-width screen (640 px or less).
- Bubble 1.3.0 adds one message, `cue-resize`, which only Cue's own page can send (the same `isCueTab` check as 📷). It needs no new Chrome permission. Kiko reloads the extension once.
- Tests: 180 of 180 pass, with SN2 now expecting bubble 1.3.0. Checked in Chromium at 440 px (the pane opens, the window grows to 880, and it shuts back to 440) and at 1440 px.

## Cue 1.12 (Kiko 13:53Z "lets deploy everything that can be deployed already")

### Two-pane layout (Kiko approved the mockup 13:01Z and the build 13:05Z)

Kiko 21 Oct 12:59Z, mockup approved 13:01Z: Cue looks like Claude's desktop app.

- **Main chat on the left, a pane on the right.** The right pane has tabs. **Threads** is always first and lists every task in three groups: Needs you, Working on, and Recent. Each row shows the task's latest line and how long ago it changed. The list has a search box, and each group folds. Recent shows 8 at first, with Show more.
- **Tapping a thread's name opens it in the right pane**, as its own tab, with the tracker, the cards and a reply box of its own. In the chat, only the name under a message is a link; the reply count is plain text (Kiko's rule). Tapping a task's message still opens its thread too. Widget cards, Reopen and the "Answered in" pointer lines open the thread in the pane as well.
- **The chat's box always posts to the main chat.** Thread replies go through the thread's own box. Attachments stay with the box they were added to, by 📎, paste or drop.
- **Files and images open in the pane.** A Drive file or Google Docs link opens as a tab with Drive's preview, plus "Open in a new tab". Folders, Gmail and other sites still open a new browser tab, and Ctrl/Cmd-click always does.
- Up to 8 tabs stay open, and the browser remembers them after a reload. The old "Pinned widgets" side column is gone, because the Threads tab now does that job.
- **Phone (900 px wide or less):** the chat fills the screen. A **Threads** tab in the top bar slides the pane over the chat, and **← Chat** closes it.
- No server change and no new scopes. Tests: 150 of 150 pass. The layout was checked in Chromium at desktop and phone widths with stub data.

### Write Like Me, step 2 "Draft an email"

- Ask in the chat, e.g. "email Lights Inc asking if they can deliver a day early" or "reply to Marco about the LED wall". The chat call that reads every message picks it (new field email: new or reply, who, what to say, audience, project), so routing costs no extra AI call.
- Code finds your newest email with that person in Gmail (read only; an email address is matched exactly, a name in From/To) and reads its last message. Canvas matches come from the chat's own project lookup. Your own domain makes it a team email.
- One GPT call drafts it with your style guide for that audience and the guide's sign-off. Missing facts come back as [brackets] and a note.
- The card shows To, subject and text to edit. Approve and send (one confirm) replies in the thread, or sends a new email. Save to Gmail drafts never sends. Close saves nothing. No thread and no address: a new email with To blank, and sending waits until you type the address.
- Budget: 1 AI call for the run, plus the chat call. Well under a minute.

## Cue 1.11 (Kiko 13:00-13:03Z "deploy and release the other tasks"; needs Canvas main V189 / Client V47)

Write Like Me, and the chasers that were waiting on Canvas: payment (from info@, Kiko on CC), FSA/AR signatures (from freelancers@) and supplier accreditation, plus the RFQ and CE award chaser fixes. Nothing sends without Kiko's approve on a line.

### Write Like Me, step 1 (Kiko said deploy 21 Oct 13:02Z)

- Kiko approved specs/write-like-me.md (21 Oct 08:21Z: the old skill lives in ChatGPT; yes to reading sent emails; Claude writes the guide, ChatGPT keeps drafting).
- Type "learn my style" in the chat (optionally paste your old Write Like Me notes after those words). Plain words, so no AI call routes it. Cue reads up to 100 of your sent emails from the last year (Gmail read only), keeps one per thread, drops forwards, auto-replies, quoted replies and anything over 2,000 characters, masks email addresses and phone numbers, and tags each one team (your own domain) or outside. Then one Claude call writes the guide: tone, greeting and sign-off per audience, phrases, things to avoid, length, language, and short example emails with placeholders.
- The guide waits on a card in its own thread. Edit or untick lines, then Approve and save. Only then does Cue write the new Style tab of the Cue sheet (On | Audience | Kind | Text). Close saves nothing. Re-learning replaces the tab, and the replaced lines are kept in the request.
- Every drafting call now adds the guide for its audience to the call it already makes (no extra AI call): intake RFQs, requotes and supplier-search RFQs (supplier lines), pipeline follow-ups (client lines), readiness follow-ups and the morning chasers (every audience, labelled). They use the guide's sign-off instead of CUE_SIGNOFF. With no guide, the prompts are exactly as before. Edit or switch off any line in the sheet.
- Budget: 1 AI call (Claude), well under a minute.
### Chasers: CE award details, payment, FSA/AR signatures, accreditation

Chasing sweep task 3 (spec `canvas-integration/specs/ce-award-chasers.md`, approved by Kiko 21 Oct 08:11Z). New file `src/CueSweepAward.gs`, a sweep kind.

- **What it finds.** Projects in **For Client Awarding** on the Canvas board. For each, Cue searches Kiko's Sent Gmail for the CE email (CEs only go from Kiko's own Gmail, Kiko 08:10Z) and reads that thread's headers.
- **When.** Set on Kiko's Chaser rules card (`ctx.rule('award')`; the default is 3 business days after "waiting since", then every 5, at most 3). "Waiting since" comes from `awaiting.since` in the next Canvas release, or from the CE email date until then. Chasers Kiko sent by hand in the thread count, and so does a chaser saved with Drafts only. Pausing the chaser on the card stops the Gmail search too.
- **Flags with no draft.** The client replied: "have a look". Chased 3 times: "call the client or mark Not Awarded". Event within 7 days or past: urgent. No CE email found: chase by hand.
- **Who does what.** Canvas: the board read the sweep already makes. Code: Gmail search and timing. ChatGPT: the sweep's one combined draft call, with no call of its own. The CE number and total show on the card line but are kept out of the facts given to ChatGPT. Client chasers only go out when Kiko approves.
- The file name sorts after `CueSweep.gs` on purpose, because Apps Script runs files in order and `cueKind_` must exist first.
- Tests: 10 new (A1 to A10), 69 of 69 pass with the chaser rules merged in. Other tests run with the award kind off (`CUE_CHASE_OFF=award`).

**Payment chasers** (backlog task 4; spec `canvas-integration/specs/payment-chasers.md`, approved by Kiko 21 Oct 08:16Z). Needs Canvas with the bridge actions `overdue_billings` and `send_payment_chasers` (CanvasWorkspace branch `claude/project-thread-r3ta54`); until that Canvas release is live, the kind shows a "could not check" note and the rest of the batch is unaffected.

- **Find (no AI).** One Canvas read lists every open billing invoice at least 7 days past due, with the balance worked out the way Finance Desk does (BI minus collections, Date filed + terms). A client's BIs become one email, anchored on its oldest BI. The contact is the billing contact in Client Desk when there is one, otherwise the invoice's contact (Kiko 08:16Z).
- **Draft.** The sweep's one ChatGPT call writes the words. A new engine hook, `check(item)`, makes sure every BI number and the balance are in the draft, exactly as Canvas has them; otherwise the fixed wording is used and the batch says so.
- **Send (Kiko 08:08-08:09Z).** From info@ with Kiko on CC, as a reply in the BI's own thread, only after Kiko approves the line; never automatic. Approved before 09:00 = sent at 09:00. Drafts only saves an info@ draft. Canvas re-checks each BI is still open and the balance unchanged, refuses an email that leaves out a BI or the balance, and never sends the same chaser twice.
- **Timing.** 7 days after due, then every 7 days, at most 3 chasers; then the line is flagged to Kiko. A client who replied after BSE's last email, or a BI with no billing email, shows as a line for Kiko with no draft.
- Engine: the approve and done lines now say when emails go from info@ instead of Kiko's Gmail Drafts.
- **Chaser rules.** The kind reads `ctx.rule('payment')`: `first` is the days after the due date asked of Canvas, `every` and `max` come from the engine; a paused rule skips the Canvas read.
- Tests: 6 new (PY1 to PY6); 65 of 65 pass with the chaser rules tests.
- **Accreditation chasers** (backlog task 5; spec `specs/accreditation-chasers.md`, approved by Kiko 21 Oct 08:22Z; file `CueSweepAccr.gs`, which sorts after `CueSweep.gs` so `cueKind_` exists first). Canvas lists the Supplier Accreditation rows that still miss something, awarded or newly registered (`accreditation_gaps`, needs the Canvas release with `AiAccr.gs`). Suppliers who never got the form get it; the others get a reminder 3 days after the last email, then every 3, at most 3 (the accreditation Chaser rule). Sent from Kiko's Gmail, as a reply in the accreditation thread when there is one, with suppliers@ in CC. At send time Canvas re-checks the row is still open and logs the email after (`log_accreditation_reminder`). A supplier who answered by form or email since the last email gets no email; the line says to read their documents in Canvas. Urgent when the event is 5 days away or less. The form link is always kept in. No AI of its own (it shares the engine's ChatGPT call). Tests AC1 to AC7; 65 of 65 pass.
- **FSA / AR signature chasers (task 6; spec `canvas-integration/specs/06-freelancer-signatures.md`, approved by Kiko 21 Oct 08:16Z).** `src/CueSweepSignature.gs` lists every FSA and freelancer AR still waiting for signature through the new Canvas read `list_unsigned_docs`. Chasing starts the day after the event's last day (Kiko 08:08Z), or the day after a late AR was made, then every 2 days, at most 3 times. Each freelancer gets one line covering all their unsigned papers. The reminder is a fixed template with the Canvas sign-in link, so there is no AI call. On Approve and send, Canvas sends it from freelancers@ (`send_doc_reminder`, Kiko 08:09Z), only for papers still unsigned. Drafts only puts it in Kiko's own Gmail Drafts. Cancelled projects are skipped. A freelancer with no email on file shows as a "remind them by text or call" line. Needs the Canvas release that adds the two bridge actions.

## Cue 1.10 (deployed as Version 27, 21 Oct 12:59Z, with Canvas main V188 / Client V46)

One release made of the branches below. Each feature keeps its own notes.

### Chasing sweep

The chasing sweep engine and task basics (backlog task 1; spec `canvas-integration/specs/sweep-engine.md`, approved by Kiko 21 Oct 07:31Z).

- **Morning batch.** At 07:00 Philippine time, `cueSweep` builds one batch of follow-ups, grouped by kind. Each line can be ticked, edited, skipped for today, or stopped. **Approve and send** makes the drafts at once and sends them at 09:00 PH time; if Kiko approves after 09:00, they go out straight away. Before 09:00 the send can be cancelled, and the emails stay in Gmail Drafts. **Drafts only** sends nothing. Kinds marked `sendAllowed: false` are always drafts. A kind with a `send` hook (payments, sent from info@ with Kiko on CC through Canvas, Kiko 08:09Z) is sent by that hook at 09:00 instead of Kiko's Gmail. A day with nothing to chase gets a single chat line and no card. An older batch that was never approved is closed when the next one is built, so its lines come back.
- **Who does what.** Code finds, filters and sends. Canvas is read once with `get_project_board`, and only when a kind needs it. ChatGPT drafts every line in one call, or two when the batch is big. If ChatGPT fails, each kind's template is used, so the batch never depends on ChatGPT. Claude is not in the daily run. The budget is 3 AI calls or fewer.
- **Chase log tab.** It keeps when each line was last chased, how many times, when it's next due, whether it's muted, and a note. The engine applies each kind's `every` and `max` from this tab. When a line reaches `max`, it shows once under "Chased the max times, no reply. Your call" and is then left alone (Kiko 07:31Z). Caps are 15 lines per kind and 40 per batch; the rest wait for tomorrow.
- **Kind hook for tasks 2 to 6 and inbox triage:** `cueKind_({ kind, label, find(ctx), draftBrief, template, every, max, sendAllowed, send?, act?, posted?, chase? })`. Kinds can be paused with the Script Property `CUE_CHASE_OFF`. The only kind built in is **Your tasks due**, which lists Cue tasks that are due today or overdue. It has no email and no AI.
- **Task basics.** Every task has a due date, a priority (High, Normal or Low) and a reminder. Kiko can set them on the bar at the top of the thread, or by saying so in chat; that uses the same chat call, with no extra AI call. Needs you sorts by priority, then due date. A reminder posts in the thread and the main chat and puts the task in Needs you. Reminders that fall due in quiet hours (21:00 to 07:00) wait until 07:00. **Close** works on any task that isn't running. **Archive** hides a closed task, and **See archived** brings it back.
- **Chaser rules card** (Kiko 08:12Z; spec `specs/chaser-rules.md`, approved 08:15Z). In Widgets, under Chaser rules, there is one row per chaser (RFQ, CE award, payment, accreditation, FSA/AR) with on/off, first chase after, then every, and stop after. A General section sets the build time, send time, quiet hours and caps. The defaults are the ones each chaser's spec agreed. Values are checked, kept in a new **Rules** tab (with the time of each change and the old value), noted in the chat, and used from the next batch. A broken value typed straight into the tab falls back to its default, and the batch says so. Working-day rules skip weekends, and moving the build time moves the trigger. Kinds read their numbers with `ctx.rule(kind)`; the kind names are `rfq`, `award`, `payment`, `accreditation` and `signature`. Code only, no AI.
- **No new Google scopes.** The 07:00 trigger is installed the next time Cue opens (`CUE_TRIGGERS_V=2`), so a deploy needs no setup step.
- Tests: S1 to S13, S5b and R1 to R6 (chaser rules); 58 of 58 pass on the branch.

### RFQ chasers

RFQ chasers, a kind in the morning batch (backlog task 2; spec `canvas-integration/specs/rfq-chasers.md`, approved by Kiko 21 Oct 07:49Z). Built on the chasing sweep engine.

- **Who gets a nudge.** A supplier who got an RFQ from Kiko's Gmail and hasn't replied in time. The timing comes from Kiko's Chaser rules card: by default 3 working days (Mon to Fri, PH time), then every 3, up to 2 nudges; when the Canvas event is within 7 days, it's 1 working day and then every 1. A follow-up Kiko sends in person restarts the wait. Cue checks the thread and any new email from that address. It skips a thread when a draft is already waiting, when the project is lost, cancelled or past, when the recipients are BSE only, or when the address is in `CUE_RFQ_NEVER`. Threads come from an RFQ-words search of Kiko's sent mail (not plain "quotation", so client quotations are never chased), plus every RFQ Cue sent itself, whatever its subject.
- **Nudges** are replies in the original RFQ thread (In-Reply-To the last message), with no attachments, and ask for the quote within 2 working days. ChatGPT drafts them in the engine's one combined call; if that fails, a template is used. RFQ chasers make no AI call of their own, and Claude isn't used. After 2 nudges Cue stops and hands the supplier to Kiko.
- **Never info@** (Kiko 07:45Z): the old `CUE_DRAFTS_IN=canvas` switch is removed, so RFQ drafts are always made in Kiko's own Gmail. Cue no longer calls `make_rfq_drafts`.
- **No new scopes and no Canvas writes.** It uses Gmail read (already granted) and the engine's one `get_project_board` read.
- Tests: Q1 to Q6 added. C8 now checks that the old switch is ignored, and C16b is removed.

### Project expenses (needs the Canvas release with expense_evidence / record_expense)

- Record project expense / payment (Kiko 07:34Z approved specs/c3-project-expense.md). A message like "Receipt for Telus Trick or Treat Manila > Venue Styling, duct tapes" (matched in code, no AI call) starts an expense thread. GPT reads the line and the files (call 1); Canvas finds the project and its CE categories, scopes, quotes, requests and transfers, and checks for duplicates (expense_evidence); Claude proposes the plan by the Finance Admin rules (call 2). The card shows every field to edit and each doubt to tick. Approve records it in Canvas through Canvas's own functions (scope, quote, award, payment request, Paid transfer or cash, proof and receipt in the project's Admin folder) and reads every row back (record_expense). A stop at a step comes back to the card; approving again carries on and never records twice.
- Expense files stay in the page (Kiko 07:27Z): nothing goes to Cue uploads. Cue keeps names, sizes and SHA-256 only; Approve sends the same files to Canvas. A reloaded page asks for them again and checks they match.

### CFO Advisor (needs Canvas with finance_snapshot; Kiko said yes 21 Oct 08:17Z)

- Money questions (Kiko 07:41Z approved specs/cfo-advisor.md; 07:38Z "quick questions can just have 1 API call"): profit on a project or client, who owes BSE, what is owed to suppliers, the next 13 weeks of cash. Cue's code spots the question and its scope (project id, client or project name, period), Canvas sends the numbers through the new read finance_snapshot, Cue's code does all the maths, and ONE Claude call answers. It replaces the chat call, so a quick question costs 1 AI call. Decisions that need outside prices add one GPT web search and a second Claude call (3 in all).
- Number check: every amount and percent in Claude's text must be a number from the maths; otherwise the text is dropped and the tables stand alone.
- Each answer gets its own "Money: ..." thread with a read-only card: the answer, flags, totals, projects, clients owe (aging), suppliers to pay, 13-week cash, what is missing, Your numbers (cash on hand, monthly overhead, minimum margin, cash buffer) and Save as Sheet (formulas, in Kiko's Drive). A reply in that thread is a follow-up on the same projects.
- Kiko's numbers can also be typed in the chat ("cash on hand is 1.25M", "overhead is 300k a month", "minimum margin 25%"): saved by code, no AI call.
- A "Money check" chip. Money threads never capture an intake, and a reply in an intake or change thread never becomes a money run.

### Supplier search (needs Canvas with supplier_lookup)

- Find, compare or assess suppliers (Kiko approved specs/vendor-management.md, 21 Oct 07:54Z). Ask in the chat, e.g. "find LED wall suppliers in Cebu", "compare Sonic Pro and Brightwave", "how reliable is Sonic Pro?" or "compare the quotes on JBL Booth". The chat call reads the ask (no extra call). Canvas returns the Supplier Database matches, past quotes for the item (count, median, low to high, awarded), named suppliers' history and a project's logged quotes (new bridge read supplier_lookup).
- Preferred first (Kiko 07:51Z): Preferred suppliers are listed first, every Preferred supplier that offers the item is shown even past 5, and Claude's pick is a Preferred one unless Claude says why not (the card shows the reason, or that Cue switched the pick to the Preferred supplier).
- Web search only when needed: GPT searches when Find has fewer than 3 matches, you ask for new options, or a supplier you named isn't in the Supplier DB. New finds are labelled "New, not in Supplier DB, not accredited", never ranked above an accredited DB supplier on Find, and remembered in a new Prospects tab so the next search shows them instead of searching again.
- Draft RFQs from the card: tick suppliers (Claude's pick is ticked), GPT drafts one RFQ each, then Approve and send, Drafts only, or Close RFQs. A supplier with no email stays a draft.
- Read only: nothing is written to Canvas. Each search is logged in a new Vendor runs tab. Budget: 1 AI call (Claude) when the DB is enough, 2 with web search, plus 1 for RFQs.

### Workflow maps (no Canvas release needed)

- Map a workflow (Kiko approved specs/process-mapper.md, 21 Oct 08:07Z). Ask in the chat, e.g. "map how we chase suppliers who haven't quoted, as a Zap", or attach a Zap screenshot with the word "map" or "zap". The chat call recognises the ask (no extra call); with files, GPT reads them first. Claude maps it: trigger, steps, each step's Cue block and owner (Claude, ChatGPT, Code, Canvas, Zapier, Kiko), inputs and outputs, and for Zapier the click-by-click build steps.
- Cue checks Kiko's rules in code and flags (never fixes) what breaks them: a write or send with no Wait for Kiko before it (stronger wording for money, contracts, signatures and clients), ChatGPT writing to Canvas, Canvas writes not via Canvas or not read back, unapproved blocks or wrong owners, more than 5 AI steps or over 3 minutes, a scheduled job that depends on ChatGPT.
- Approved blocks now include Read Canvas, Send email, Save file and Schedule (Kiko said yes).
- In the map's thread: any reply is a revision (one Claude call); "check with GPT" or "second opinion" asks ChatGPT (only when asked). Approve and save writes one row to a new Workflows tab (name, version, target, status, trigger, steps, flags, Zap steps, steps JSON). A map with the same name as a saved one updates it as the next version. Kiko can change Status there (Live in Zapier, Live in Cue).
- Never builds, changes or switches on a Zap, and writes nothing to Canvas, HubSpot or Gmail. Budget: 2 AI calls (chat + Claude), 3 with a screenshot, +1 per revision or second opinion.

### Screen snapshots, with Cue bubble 1.2.0 (spec screen-snapshot.md, Kiko approved 21 Oct 08:17Z)

- Screen snapshots for intake. Tap 📷 in Cue's message box, press Alt+Shift+S, or right-click a page and pick "Cue: snap this page" or "Cue: snap an area". The bubble captures the visible part of the Chrome tab (the bubble itself steps out of the picture), shrinks it to 1800 px, and drops it into Cue's message box with "New project intake." and the page's title and address. Nothing is sent until Kiko presses Enter. GPT's read call reads it as before, so there are no extra AI calls.
- "Send to Cue" on selected text puts the text in the message box with where it came from.
- Snapshots (`Cue snapshot …` files) go to Brief & Planning (or Client Documents for a change) after approval, not Designs & Visuals.
- The bubble asks Chrome for `activeTab`, `contextMenus` and access to all sites (to capture the tab behind Cue). Kiko reloads the extension and accepts the new permission once. 📷 shows in Cue only when bubble 1.2.0 is installed.
- Chrome pages (chrome://, the Web Store) and desktop apps can't be snapped: use Win+Shift+S, then Ctrl+V in Cue.

### Personal expense (Kiko approved specs/personal-expense.md 08:15Z)

- Record personal expense (Kiko 08:15Z approved specs/personal-expense.md; new file CuePersonal.gs). A message with "personal expense" or "record this as personal" (matched in code, no AI call) starts its own thread. GPT reads the line and the proofs (call 1). Claude looks again with the same files only when GPT marks an item unsure (call 2, else skipped). Code then checks Personal Expense 2 for the same reference (or the same day, amount and payee when there is no reference), and reads BSE Scopes and Transfers (Transfers by reference, Payment Request by amount and payee) read-only. Credits, refunds and own-wallet moves are set apart and unticked; receipt-only items are saved as evidence with no paid amount. The card lists each item to edit and tick. Approve moves each proof from Cue uploads into "Personal expense proofs" in Kiko's My Drive, writes one row per ticked item by live header name (formulas and formats from the row above, references as text, unknown fees blank), and reads every row back. A reference already in the sheet is never written twice. Nothing goes to Canvas, HubSpot or email.
- Claude calls can now take files (images and PDFs), used by the second look above.
- Optional Script Properties: CUE_PERSONAL_SHEET, CUE_PERSONAL_TAB, CUE_PERSONAL_BSE_SHEET (defaults are Kiko's sheets); CUE_PERSONAL_FOLDER is set by Cue.

### Pipeline health

_Needs CUE_HUBSPOT_TOKEN before deploy._

- Review deals and follow-ups (command C11, Kiko approved the spec 21 Oct 07:34Z). Ask in chat ("how's the pipeline", "which deals went quiet", "who's waiting on me", "where are we with Telus", "kumusta yung deals") and Cue opens a Pipeline review thread.
- Code reads the open deals from HubSpot (read-only private app token, `CUE_HUBSPOT_TOKEN`) and the newest email for each from Kiko's Gmail, by contact email, Canvas project ID or client name. Fixed rules flag each deal: they wrote last (1+ working day), event within 14 days, event passed but still open, quiet 7 days (3 working days once the CE is with the client), missing amount, event date or contact.
- One Claude call writes where each flagged deal stands and the next step, plus a short summary. If Claude is down, the rule flags still show.
- The card groups deals into Act today, Chase, Fix the data (in Canvas) and On track, with HubSpot and Gmail links. Tick deals and tap Draft follow-ups: one GPT call drafts a reply in each deal's thread; edit, then Approve and send or Drafts only. Done closes the review.
- Budget: 1 AI call for the review, 2 with follow-ups (plus the chat call). At most 40 deals (nearest event first). Read only: nothing is written to HubSpot or Canvas. Each review is logged in a new Pipeline tab of the Cue sheet.

### Supplier acknowledgement receipts (needs Canvas with the ar_list / ar_make / ar_email bridge actions)

- "Prepare ARs for <project>" (Kiko 07:42Z approved specs/supplier-ars.md). GPT recognises it in the chat call Cue already makes (new field start_ar), so the run itself makes no AI call. Cue finds the project (Canvas id as given, else Canvas's project match), and Canvas lists everyone the project paid: suppliers, talents and freelancers.
- One card: Ready to make (ticked), Already made (link, status, emailed; a Remake tick), Can't make yet (Canvas's reason, e.g. VAT registered, service fee, invoice on file, no paid amount).
- Make ticked receipts: one Canvas call per receipt, at most 15 per run, PDFs in the project's Acknowledgement Receipts folder and logged on the AR Receipts tab. A failed one stays ticked for a retry; a repeat never makes a second PDF.
- Then, only on its own approval, Email receipts sends supplier and talent receipts from AccountsPayables@ (Event Specialist and Kiko in CC), once each. Freelancer receipts are never emailed; they sign in Canvas Client. Finish without emailing ends the task.
- Summary line in the main chat and the thread. Bridge fixture refreshed to the Canvas bridge with the AR actions.

### HubSpot clean-up (command C12; needs the Canvas release with hubspot_scan / hubspot_fix)

- "Clean up HubSpot" (Kiko approved specs/hubspot-cleanup.md 07:50Z): typed in the chat or tapped as a chip, it starts its own thread without a chat call. Canvas scans HubSpot, the HubSpot Links tab and Client Desk with fixed rules (read only), Claude checks look-alike companies and contacts and reads real names from email addresses (1 call, skipped when nothing is unsure), and the card lists Duplicates, Fix in Canvas, Missing links, Missing info, Old records and Needs a look, each with a tick box.
- "Look up N missing websites" asks ChatGPT once, with web search; found websites come back unticked with their source.
- Approve ticked fixes: Canvas applies only those, at most 50 record changes at a time, re-checks each against live HubSpot and reads it back. Merges are marked "cannot be undone" and confirmed; archive goes to HubSpot's recycle bin (90 days); a Canvas deal is never merged or archived; a Canvas contact's name is fixed in Client Desk and reaches HubSpot on the hourly sync. Every change is logged in the Cue sheet's HubSpot Cleanup tab.
- Every Monday at 06:00 (trigger cueHsWeekly, installed by cueSetup or the first clean-up) Cue runs the scan by itself; the card waits in Needs you and nothing changes without Kiko. When the sweep engine is in, the waiting card also shows as one line in the Monday morning batch.

### Supplier registration

Register a supplier (command C5; spec `canvas-integration/specs/supplier-registration.md`, approved by Kiko 21 Oct 07:55Z). Needs the Canvas release with `supplier_check`, `register_supplier` and `save_supplier_file` (CanvasWorkspace branch `claude/project-thread-amreua`).

- **Start it in chat.** "Register this supplier" (or "add this supplier", "supplier registration for ...") with their documents attached. Kiko's own words decide, so it skips the chat call and never becomes a project intake.
- **Who does what. 1 to 3 AI calls.** GPT reads the message and the documents: details, every contact person, and bank details only when a document shows them. Canvas checks duplicates (name, aliases, TIN, email), the Supplier Database's own dropdowns, the documents the business type needs, and old payment requests and quotes for a supplier that was never registered. Cue's code searches every shared drive for old files of this supplier. Claude runs only when a value doesn't fit a dropdown or something old was found: it fits the values, fills gaps from the top 5 old files and adds contacts it finds there, and never touches bank details. GPT drafts the request for missing documents only when something is missing and there is an email to send it to; if GPT fails, a plain template is used.
- **The card.** Fields grouped like the Canvas supplier form, each editable (dropdown columns only take the sheet's values); every contact person, with Add and Remove; attached documents with what each one is; "Found in shared drives" with a tick and a document type per file; "Old supplier, never registered" when Canvas has old payments or quotes; what is still missing; the request email. A duplicate blocks Approve until Kiko ticks "Not the same supplier".
- **Approve.** Canvas adds the supplier once (a repeat resumes where it stopped), saves every contact in Supplier Contacts, opens its Supplier Accreditation row when something is missing (so the accreditation chaser follows up), and reads every cell back. The attached documents go in the supplier folder, and ticked old files are added there as shortcuts. **Approve and send** sends the request from Kiko's Gmail with suppliers@ in CC, after one confirm; **Approve, request as a draft** leaves it in Gmail Drafts.
- **Never.** Supplier ID, Accreditation Status, the four verification columns, the folder link, existing suppliers, deletes.
- **Shared-drive search needs Drive read access.** Cue has only drive.file today, so until the full Drive access for the Google files command ships, the card says the search was skipped. No new scopes in this change.
- **Not yet wired:** logging the first request through the accreditation chaser's `log_accreditation_reminder`, which arrives with that kind.

- Tests: 13 new (S1 to S13), 50 of 50 pass.

### Inbox triage (ships with the chasing sweep)

- Inbox triage (Kiko 07:30Z asked, spec approved 07:34Z, specs/inbox-triage.md): `CueTriage.gs` is the sweep engine's "Inbox" kind. Code lists inbox mail since the last run that Kiko has not answered, drops threads other tasks own (intake source, requote threads, chase log, a Canvas project ID) and ones already shown, and skips junk with no AI (Promotions/Social/Forums, mailing lists, no-reply senders, muted senders). ChatGPT sorts the rest in one call into new inquiry, needs a reply, FYI or skip; if it fails, everything shows as FYI. Reply lines carry a brief for the engine's one draft call. Read only.
- Start intake from an inquiry line (`cueTriageIntake`): the email and its photos, PDFs and text files become a normal intake linked to the thread.
- Sender rules (`cueTriageTeach`): Mute this sender, Not junk, Not an inquiry. New sheet tabs Triage log and Triage rules (cueSetup adds them; rows in Triage rules can be deleted by hand).

### CE award chasers (on top of the chasing sweep)
- Tests: S1 to S13, S5b and R1 to R6; 58 of 58 pass.

## Cue 1.9.5 (costing starts mid-way; Kiko 08:55Z)

- "Cost them", "re-cost" or "break it down by item" in a project's thread (an intake, or a change request that read requirements) now starts at the costing step, with the requirements and files GPT already read. There's no new GPT read, no duplicate check and no switch to a change request. The run joins the same thread.
- "By item" asks Claude to list each requirement's items (quantity, unit cost and where the cost comes from) in the line's note. Writing those items into Canvas as sub-items is still to come.
- "Start intake" or "full intake" still runs the whole intake.

## Cue 1.9.4 (chat never claims work; Kiko 08:53Z)

- The chat no longer says "I'm working on it" or "costing next" when no run started. Work only happens in a run, which always shows a card. If GPT still claims it, Cue adds a plain correction that nothing is running and how to start it.

## Cue 1.9.3 (a lookup only answers; Kiko 08:51Z)

- Asking Cue to look up, find or check a project only answers with what Canvas has. It never starts an intake or costing, and never says it did, unless that same message asks for it ("start intake", "requote"...). Earlier chat is history, not instructions.

## Cue 1.9.2 (intake means intake; Kiko 08:37-08:38Z)

- "Start intake", "run intake", "full intake" or "redo intake" always runs a new intake, even when Canvas has a project with a similar name (for example one left by an earlier attempt). The card notes the similar project so you can reject it if it really is a duplicate.
- Change requests search your sent RFQs by the project's own name only, never the client's name alone, so RFQs from other AMI projects no longer show up.

## Cue 1.9.1 (project lookup in chat; Kiko 08:25Z "i need this fixed asap"; needs Canvas main V187)

- Chat can look up Canvas projects. Ask "lookup AMI Group - Selecta" or "what's the status of S-…" and Cue searches Canvas by project name, client or ID (new bridge read search_projects, read only) before GPT answers, so the reply comes from real Canvas records. Cue no longer says it has no access to Canvas.
- Canvas V187 also tightens the duplicate check: the client's name alone no longer counts as a similar project name (Selecta was matched to the Halloween gift boxes), and the best match comes first.
- A new message no longer reopens an old task just because the client matches. When a client has several tasks this week (AMI: BEKO, Halloween boxes, Selecta), a word from the project name itself must match.
- In the chat, the thread title and the task's message open the thread, like Claude. Before, only "N replies" did.
- Budget: no extra AI call. One parallel Canvas read per name word, at most 4 plus 2 project IDs.

## Cue 1.9 (readiness check; Kiko said deploy 08:21Z; needs Canvas V186, live)

- Readiness check (Kiko approved specs/project-readiness.md, 21 Oct 07:32Z). Ask "is X ready?" or "what's missing for X?" in the chat. The chat call names the project; Canvas finds it (several open matches: pick on the card; a project ID works too) and returns its readiness checklist exactly as the Checklist tab scores it (new bridge read get_readiness: Pre-Event Readiness before the event, Closeout after). Cue flags overdue items, missing owners and blockers within 7 days of the event, and looks in your Gmail (subjects and snippets, last 60 days) for proof Canvas hasn't recorded. One Claude call writes the summary, the top 3 risks, what closes each open blocker, and whether each email or file looks like proof. The card leads with Canvas's own count (Blockers clear X of Y), never an AI number.
- Draft follow-ups on the card: one GPT call drafts a reply in the email thread for each item Waiting on Others. Edit, then Approve and send, or Drafts only, like requotes. Close follow-ups drops them and keeps the check. Re-check runs it again in the same thread.
- Read only: nothing is written to Canvas. Marking Ready, verifying and gate approval stay on the Checklist tab.
- Budget: 1 AI call per check (Claude), 2 with follow-ups, plus the chat call that reads the ask.

## Cue 1.8.3 (deployed as Version 19 with 1.8.1 and 1.8.2, Canvas main V186 / Client V44)

- New projects start at For Admin Completion with Kiko Dacanay as Account Owner (Kiko 08:06Z; set by Canvas).

- Approved spec (Kiko 07:41-07:46Z). GPT's read now keeps every client contact (role, email, phone), the proposal deadline, and ingress, event hours and egress apart from the event date. Each line is included, optional or not needed.
- No event date no longer stops an intake. The card shows "Date TBC" and Canvas holds a stand-in date until Kiko sets the real one.
- Optional lines are costed and marked, and totalled apart. Lines the client doesn't need are listed but never costed or written.
- Selling price: BSE's packages and price list first, then past CE prices Canvas shows (Claude cites them and Canvas re-checks). Otherwise the price stays blank and the line is flagged "No selling price: set it". Kiko can type a price on the card.
- RFQs ask for quotes back at least a day before the client's proposal deadline.
- After the write, the done card lists every project folder Canvas read back. A missing one is flagged with "Make folders again".

## Cue 1.8.2 (not deployed yet; best with Canvas V186)

- Budget (Kiko 07:19Z): the 3-minute budget counts Cue's own time only (the run to the card plus the work after Kiko approves), not the time a card waits for Kiko. Cards show "Cue worked N s".
- Project folder honesty: Canvas V186 says when a project has no Drive folder yet (usually no event date). Cue then says the files went to Canvas Files for that project (shown in Canvas's Files tab) instead of claiming the project folder. Before V186, Cue keeps the old wording.

## Cue 1.8.1 (not deployed yet)

- Reopen (Kiko 07:15Z): Recently done cards have a Reopen button instead of a reply box. A reopened task waits in Needs you ("Tell Cue what to do next") with a reply box and a Close again button, and its thread opens. Reopening runs, writes and sends nothing. When a new run joins the thread, the reopened one goes back to how it finished.

## Cue 1.8 (deployed as Version 18, with Canvas main V185 / Client V43)

- Files go in the project folder (Kiko 06:45Z): after Kiko approves, every file Kiko attached is saved in the Canvas project folder through the new bridge action save_project_file (photos to Designs & Visuals; other files to Brief & Planning for a new project, Client Documents for a change). The card lists them with links. A failure is a note and is retried on the next approve; Canvas never makes a second copy.
- Reply box on every widget card (Kiko 06:48Z), with Cue's latest line in that thread above it. It posts into the task's thread; Enter sends; typed text survives refreshes.
- Threads hold everything (Kiko 06:50Z): the request and its files, the conversation, and the full card for every run, also after it is done. Finished requotes are one line per supplier with sent / in Drafts, and expand in place to the whole email with an Open in Gmail link. Links open in a new tab.
- The progress tracker sits at the top of the thread (Kiko 06:51Z).
- Cue's messages point to the thread instead of Widgets.
- Cue answers in the main chat (Kiko 06:53Z): a task started there gets "On it. I started a thread for this" under Kiko's message, with the thread's reply count, title and status; a message filed into an existing thread gets "Answered in the <project> thread".
- Summary (Kiko 06:55Z): when a task finishes, is rejected, or something is sent, Cue posts one line in the main chat and in the thread saying what happened (sent, in Drafts, files saved, still open). Built from the record, no AI call.
- Task rules (Kiko 06:57Z): a new message about a task from the last 7 days reopens that task's thread instead of starting a new one. Cue guesses from the project or client name in the message (no AI call), and Canvas's project match confirms it or moves the run into the right thread. The main chat says "This is about BEKO Booth, so I reopened its thread." A reopened thread keeps its name while the new run is read.

## Cue 1.7 (deployed as Version 17)

- Answers go in the thread (Kiko 06:29Z, "like your own UX"): when Kiko writes in the main chat about a task that already has a thread, GPT (same single chat call) picks the task. Kiko's line stays in the main chat with "Answered in the <project> thread" and an Open thread row; Kiko's message and Cue's answer go in that thread. A redo started this way joins the same thread.

## Cue 1.6.2 (shipped in Version 17)

- Widgets (Kiko 06:28Z): tapping a card opens its thread; the "Open its thread" links are gone. Buttons, ticks, text boxes and links inside a card still do their own job.
- Recently done shows 3, then "See more".

## Cue 1.6.1 (deployed as Version 16)

- Change requests tick only the newest files (Kiko 06:25Z "kept on attaching the old files"): this message's files, or else the newest earlier message with files. Older files from the last day are listed unticked.
- Each attached file name opens it in Drive, and the card says uploads live in Kiko's own Drive folder "Cue uploads", with a link (Kiko 06:25Z "I don't know where it uploaded the new files").

## Cue 1.6 (deployed as Version 15)

- Edit and send (Kiko 06:17Z "show me drafts, allow me to edit it in that window, and when I approve it sends the emails"): every requote and RFQ is an editable text box on its card. "Approve and send" asks once, naming every recipient, then sends from Kiko's Gmail (change requests as replies in the original threads, with the ticked files). "Drafts only" still makes Gmail drafts and sends nothing. An RFQ supplier with no email stays a draft. A failed send keeps the draft and "Retry" sends only that one. Sending uses drafts.send, covered by the gmail.compose access Cue already has.
- The chat model knows Cue sends only from a card's Approve and send, never from chat.

## Cue 1.5 (deployed as Version 14)

- Threads per task (Kiko 06:03-06:07Z, "reply counter", like Claude's project chat): the chat shows Kiko's general messages and each task's first message with "↩ N replies", its status (Needs you, Working, Done) and when it last moved. Tapping it opens the thread: every message for that task, then its cards (review, progress or result). Typing in a thread files the message under that task's newest run, and a redo started there stays in the same thread. Widgets cards have "Open its thread". The reply dots and the Reply bar are gone.
- The chat model sees only the thread Kiko is in (or only the main chat), not every task mixed together.
- Cue keeps the last 300 chat lines (was 40) so older threads keep their history.
- A poll that changes nothing no longer redraws cards, so ticks and edits are not lost while Cue is busy.

## Cue 1.4.2 (shipped in Version 14)

- Change request card (Kiko 06:02Z): the requote texts are labelled "Preview only. Not in Gmail yet", and the button is now "Save to Gmail drafts", so it no longer reads as making the drafts twice.

## Cue 1.4.1 (deployed as Version 13)

- Sending never blocks (Kiko 05:59Z): your message shows at once and stays through refreshes; Enter works while Cue is still busy with the last message; the box and the reply bar clear on send.

## Cue 1.4 (deployed as Version 12)

- Requote files (Kiko 05:47Z "load again with new files"): a change request attaches this message's files, the task Kiko replied to, and every file Kiko sent for the same Canvas project in the last 24 hours (newest copy per name, up to 20 MB ticked). The card lists them with ticks.
- Reply to a task (Kiko 05:49Z, like ChatGPT): each chat line tied to a task shows a coloured dot and the task name; "↩ Reply" ties the next message to that task.
- Chat can start a run when Kiko asks ("load again", "redo the drafts"), with a self-contained instruction, no extra tap.
- Chat facts: Cue never sends email (drafts only), Google access works, file names are not cut off, no asking to confirm suppliers.
- Claude: a clear message when the Anthropic key is not tied to a workspace; optional Script Property ANTHROPIC_WORKSPACE_ID.

## Cue 1.3.4 (deployed as Version 11) and bubble 1.1.0

- Cue icon (Kiko 05:42Z): the Cue orb as the window favicon (saved once to Kiko's Drive as "Cue icon.png") and new extension icons (orb at small sizes, ring with "Cue" at 128 px).
- The bubble no longer shows on Cue's own page or inside the Cue window.

## Cue 1.3.3 (deployed as Version 10)

- Working on cards are collapsible (Kiko 05:39Z): collapsed shows the title, the current step and the bar; tap to see the full request, every step and the AI-call count.

## Cue 1.3.2 (deployed as Version 9)

- Removed the Speed budget widget (Kiko 05:38Z). Runs still record AI calls and seconds on each card.

## Cue 1.3.1 (deployed as Version 8)

- Fix Google access (Kiko 05:32Z): when Gmail or Drive says Cue lacks a scope, Widgets shows one button. It asks Google which access Cue's token has; if gmail.readonly, gmail.compose or drive.file is missing it resets Cue's authorization so the next open of Cue asks for all of them. Keys and requests stay. cueSetup now also reports missing Google access.

## Cue 1.3 (deployed as Version 7)

- Every request takes the intake steps first (Kiko 21 Oct 04:45Z). GPT reads, then Canvas runs the duplicate check. When Canvas finds the same project, or Kiko says it is a change, Cue switches to the change function. Otherwise it goes on to costing.
- The change card shows the Canvas match and the matched project's folder files, newest first, each linking to Drive (needs Canvas V184's `list_project_files`; until then the card notes that the folder could not be listed). GPT sees the file names when drafting requotes.
- "Not this project: run as new" sends a wrong match down the new-project path. The possible-duplicate warning stays on that card.
- When no past RFQ emails are found, Cue still shows the project card with its files and makes no requote call, instead of stopping.
- Version 6 also covered up to 10 attachments (20 MB) and switched on the Drive and Gmail advanced services.

## Cue 1.2 (deployed as Version 5)

- Change requests (Kiko 21 Oct): "this project changed, requote with the same suppliers". GPT spots it in the read call, Cue finds the RFQ emails Kiko sent (Gmail, read only), GPT drafts one reply per supplier, Kiko ticks and approves, and the drafts land in the original threads with the files attached. 2 AI calls. Nothing sent, Canvas untouched.
- Attachments upload one at a time with a progress count (one big call silently failed at ~10 MB); photos over 500 KB are shrunk to 1800 px JPEG.

## Cue 1.1 (Versions 3-4)

- Attachments for intake: photos, PDFs and text files (📎, paste or drag). GPT reads them in its first call, so still 4 AI calls.
- Deploy Cue and Connect Google Actions: no more copy and paste.
- BSE fonts (DM Sans, Archivo Black). Enter sends, Shift+Enter adds a line. Only the chat area scrolls. Cue's own Reject box.
- Small talk: anything that isn't an intake gets one GPT reply; an inquiry-looking message offers "Start an intake". Attachments or a "New project intake" opener start an intake directly.

## Cue 1.0 (not yet deployed)

- Project intake: start in chat, then GPT read, Canvas checks, Claude costing with GPT web research, and GPT RFQ drafts. Kiko approves, Canvas writes once, and the drafts go to Kiko's Gmail.
- Speed budget: at most 5 AI calls and 180 s, with runs over budget flagged.
- Cue bubble Chrome extension 1.0.0.
- Moved here from CanvasWorkspace (integrations/cue, commit 397d1f2).
