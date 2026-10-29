# Cue

Cue is Kiko's personal command center: an Apps Script web app in Kiko's own Google account, separate from company Canvas, plus a Chrome bubble. Cue is its own app with its own version numbers (live: Cue 1.27.46, Apps Script Version 101); Canvas keeps its V-numbers. It started as a project intake (below) and now runs 26 kinds of task plus quick commands, a morning chasing sweep and background jobs; `CHANGELOG.md` has every release.

**How everything connects:** `FEATURE-MAP.md` lists every command (the words that start it, its kind, file, card, Canvas bridge actions, sheet tabs and AI calls), every background job and which file uses which shared helper. It is made from the code by `node tools/map.mjs`, and a test fails when it is out of date.

## The flow

| # | Who | What happens | AI call? |
|---|---|---|---|
| 1 | GPT | Reads the inquiry and any attachments (photos, PDFs, text files; attach with 📎, paste or drag in) and pulls out the client, the event, the requirements and the scopes. | 1 |
| 2 | Canvas (code) | Runs the duplicate check (same client within 7 days, or a similar name). Then, for each requirement, looks up BSE packages and the price list, owned stock, past scopes, past quotes with exact stats, and the Supplier DB picks (preferred and accredited first). Both lookups run in parallel. | no |
| 3 | GPT and Claude, at the same time | **GPT** runs a web search for the lines that have no BSE price, no past quote and no stock, and looks for new suppliers wherever the DB has fewer than 3. This call is skipped when nothing is missing. **Claude** decides in-house or outsourced, costs the CE from the evidence, gives a one-line reason for each price, and names the current suppliers to ask. The research then fills the gaps in code, labelled "Research, not history". | 2 (or 1) |
| 4 | GPT | Drafts one RFQ per supplier: Claude's DB picks plus the new suppliers research found (marked new and unaccredited). | 1 |
| 5 | Kiko | Approves, edits first, or rejects in Cue. | no |
| 6 | Canvas (code) | Re-checks everything (`submit_intake`), writes the project and lines once, and reads them back (`apply_intake`). If the re-check changes a number, nothing is written and the card comes back. | no |
| 7 | Gmail | Each RFQ becomes a Gmail draft in **your own Gmail** (Kiko's choice, 21 Oct). With **Approve and send** (Kiko 21 Oct 06:17Z) Cue sends them after one confirm; **Drafts only** sends nothing. RFQs never go out from info@ (Kiko, 21 Oct). | no |

**Budget (Kiko, 21 Oct):** a major function makes 3 to 5 AI calls and finishes within 3 minutes. Every run records its AI calls and its seconds (time to the card and time to ready) in the Requests tab and on the card. A run over 5 calls or 180 seconds is flagged "Over budget". A retried call counts as a call.

**Safety:**
- GPT never writes to Canvas, and neither does Claude. Canvas writes only after Kiko approves, through the signed bridge, and only once.
- The inquiry, the evidence and the research are treated as data, never as instructions.
- Claude may cite only quotes it was shown, and BSE prices are taken from the list itself.
- No email address is ever guessed.
- The RFQs leave out prices, budgets, the client's name and signatures.

## Morning batch (chasing sweep)

| # | Who | What happens | AI call? |
|---|---|---|---|
| 1 | Code | 07:00 PH time trigger (or "run the sweep" in chat) | no |
| 2 | Canvas | One `get_project_board` read, only if a chaser kind needs it | no |
| 3 | Code | Each chaser kind finds what is outstanding; the Chase log drops muted, skipped, recently chased and maxed-out lines | no |
| 4 | ChatGPT | Drafts every nudge in one call (two if big); templates if it fails | 0 to 2 |
| 5 | Kiko | Ticks, edits, skips or stops lines; Approve and send, or Drafts only | no |
| 6 | Code, Kiko's Gmail | Drafts now; sends at 09:00 PH time (at once after 09:00); a kind's own send hook (payments via Canvas from info@) is used instead of Kiko's Gmail | no |

## Files

The Apps Script files are in `src/`, the Chrome bubble is in `extension/` and the tests are in `test/`.

- `Cue.gs`: the page, the owner check, the store (the "Cue" spreadsheet), the run lease and resume trigger, the metric, and what the page calls.
- `CueAi.gs`: GPT (OpenAI Responses API) and Claude (Messages API) over HTTP. Calls run in parallel with `UrlFetchApp.fetchAll`. Each call is logged to AI Runs.
- `CueBridge.gs`: signed calls to the Canvas bridge. Reads: `find_similar_projects`, `intake_evidence`, `list_project_files`, `get_project_board`, `get_readiness`. Writes (only after Kiko approves): `submit_intake`, `apply_intake`, `save_project_file`.
- `CueFiles.gs`: attachments. Up to 8 files, 10 MB each, 15 MB in all; big photos are shrunk to 2048 px on the page first. They are kept in a **Cue uploads** Drive folder Cue makes itself, and only GPT's read call sees them, so the call count does not change. Word and Excel files: save as PDF first.
- `CueNewMail.gs`: New mail (spec `specs/new-mail-check.md`, Kiko yes 27 Oct 2026 09:32Z). The "New mail" job checks Kiko's BSE inbox (Gmail history, read only) and info@ (Canvas bridge `inbox_new`) every 5 minutes, filters like the Morning batch and adds new emails to one "New mail" thread per day. Claude Haiku sorts them at most every 30 minutes, 07:00 to 21:00. Each line offers Start intake, Draft reply (the email card in the same thread, sent from Kiko's Gmail only after his tap), Open in Gmail, Done, Not an inquiry and Mute sender. A line also on Canvas's Emails waiting (bridge `mail_waiting`, read once per sort) shows the sender type and project Canvas knows. Nothing is labelled, archived or sent.
- `CueBidsPhilgeps.gs`: the bid check's own read of the public PhilGEPS notices site (1.27.68): the open lists of Events Management, Audio and Visual Equipment, Catering Services and Printing Services, and each notice's page once (ABC, area, closing time), kept in the hidden "PhilGEPS notices" tab. No AI call.
- Bid card (1.27.69, `CueBids.gs` + `IndexCards.html`): three parts, New: Scoped projects (Accept, Decide later, Decline), New: For clarification (Send email clarification, then Approve and send, Edit or Cancel on the draft) and Opportunities closing (Create CE into Canvas Cost Estimates once accepted, else Accept; Decline). Each notice shows its source, a short summary with the requirements, and View details for the rest. Decline writes No in the bid sheet's Intake?? column; Decide later writes nothing so the next check shows it again.
- `CueCrmTick.gs`: the "CRM work" job (1.27.68). Every 15 minutes the 5-minute tick calls Canvas's `crm_tick` (Accounts cache, deal award stages, win-back, Auto add) from Kiko's account, so info@'s old crmTick trigger retires. No AI call.
- `CueCrmLog.gs`: the client email log (1.27.34). The hourly "CRM email log" job writes Kiko's client emails from Emails waiting (`mail_waiting`) to Canvas Accounts › Activity (`crm_log`, under a claimed plan), one row per thread per day, 08:00 to 21:00, with no AI call.
- `CueSweepRfq.gs`: RFQ chasers, a kind in the morning batch. Finds Kiko's sent RFQs with no supplier reply after 3 working days and drafts a nudge in the original thread. Gmail read only; no AI call of its own; at most 2 nudges, then Kiko decides.
- `CueSweepFunnel.gs`: the morning batch's sales kinds (spec `canvas-crm-funnel.md` F6), sharing one Canvas read (`crm_funnel`) per batch. "Sales: do these today" lists CRM follow-ups due today or tomorrow (overdue ones urgent), Inquiries with no email on file and Delivered projects gone quiet past Canvas's limits; no email, no AI. "Inquiry chasers" (every 3 days) and "Win-back drafts" (every 30 days) draft follow-ups for quiet Inquiries and Canvas's win-back clients with an email on file: drafts only, in Kiko's Gmail. CE sent is left to the CE award chasers. `cueFunnelReview_` is the Monday 07:00 sales funnel review (Scheduled tasks row; `crm_funnel` + `crm_report`, one ChatGPT call, 3 to 5 lines in the chat). `cueFunnelCheck` is the read-only cloud check (`test/checks/sales-funnel.check.mjs`).
- `CueReady.gs`: readiness checks (spec `specs/project-readiness.md`, Kiko approved 21 Oct 07:32Z). "Is X ready?" in the chat: Canvas finds the project and returns its Checklist tab exactly as Canvas scores it (bridge read `get_readiness`, plus `list_project_files`); code flags overdue items, missing owners and blockers close to the event; Cue looks in Kiko's Gmail (subjects and snippets, 60 days) for proof Canvas has not recorded; one Claude call writes the summary, top risks, what closes each blocker and whether each email or file looks like proof. Canvas's counts are never changed. **Draft follow-ups** (one GPT call) drafts replies in the email threads for items Waiting on Others; they go out only on Approve and send. Nothing is written to Canvas. Needs the Canvas release that adds `get_readiness`.
- `CueChange.gs`: change requests, started when Canvas's duplicate check finds the project (or Kiko says it is a change). Lists the project's folder files through Canvas, searches Kiko's **sent** Gmail (gmail.readonly) for RFQ emails about the project, then makes reply drafts in those threads with the attachments. Cue sees only Kiko's own mailbox, not info@.
- `CuePipeline.gs`: command C11, **Review deals and follow-ups** (spec `specs/c11-pipeline-health.md` in the project files, approved by Kiko 21 Oct 07:34Z). The chat call recognises the ask ("how's the pipeline", "who do I need to chase", "kumusta yung deals"). Code reads the open deals from HubSpot (read-only token) and the newest email for each deal from Kiko's Gmail, flags them with fixed rules (Act today, Chase, Fix the data, On track), and one Claude call writes where each stands and the next step. Kiko can tick deals for follow-ups: one GPT call drafts a reply in each deal's thread, then Approve and send or Drafts only. Never writes to HubSpot or Canvas. Logged in the Pipeline tab.
- `CueAr.gs`: "Prepare ARs for <project>" (acknowledgement receipts). GPT picks the command and the project in the chat call Cue already makes; Canvas lists who was paid (`ar_list`), makes only the receipts Kiko ticks (`ar_make`, 15 per run) and emails supplier and talent receipts from AccountsPayables@ only when Kiko approves that too (`ar_email`). No other AI call; nothing from Kiko's Gmail.
- `CueCrmLog.gs`: client emails to Canvas Accounts › Activity (CRM funnel spec, part F5). Every hour from 08:00 to 21:00 Manila, the 5-minute resume reads Kiko's Emails waiting list through the bridge (`mail_waiting`, headers only) and logs each waiting **client** email with `crm_log` (kind Email, sender, subject, project), one row per thread per day. No AI call and no tap (Kiko 26 Oct 16:10Z). The Cue sheet's "CRM Email Log" tab lists every row logged or failed; a failed one is tried again the next hour.
- `CueAdmin.gs`: Cue Admin (Epic Cue #193, Kiko 29 Oct 2026). `?view=admin` shows the Settings sections as one full page in Canvas's look; this file serves its Triage rules section (list and Remove) and its Release notes section (read only). The chat's Settings button opens it in a new tab. It also serves Jobs › Log (Job Runs plus Canvas's sent_log, read only).
- `CueAdminCanvas.gs`: Canvas Admin's Run now and Send a notice moved to Cue Admin (Kiko 29 Oct 2026 03:43Z): Jobs › Chasers › Canvas chasers and Jobs › Send a notice read Canvas over the bridge (run_now_list, sn_board, sn_items, sn_prepare) and pass Kiko's press on once (run_now_send, sn_send); Send a test to me goes from Kiko's Gmail.
- `CueRfpSend.gs`: RFPs and RFP follow-ups Kiko pressed Send on in Canvas, sent from Kiko's own Gmail (Kiko 28 Oct 2026, "from me"). Every minute (its own trigger `cueRfpKick`; Settings > Scheduled tasks > RFPs from your Gmail has Run now and on/off) Cue reads Canvas's RFP Outbox through the bridge (`rfp_outbox`, read), sends each item from Kiko's Gmail (a draft, then send; a follow-up replies in the RFP's own thread) and reports it with `rfp_sent`, so the RFP Log row shows Sent with Kiko's Gmail thread, or Not sent. Each email is sent once: a report that fails is retried without sending again. Staff RFPs never come here; they open in the staff member's own Gmail.
- `CueMailAlerts.gs`: the email check behind Canvas's Emails waiting (bug fix 27 Oct 2026). Every 10 minutes the 5-minute resume reads Kiko's Inbox headers (Gmail, read only) and writes `canvas-email-alerts.json` in Kiko's Drive, shared view-only with info@: threads whose newest message is from outside BSE, within 14 days. It replaces the separate Canvas email check app's trigger, which stopped on 25 Oct. No AI call.
- `CueProjectLog.gs`: the project log behind the Projects section of Canvas's Team Cue panel (Kiko 27 Oct 2026 10:34Z). Each email thread the email check reads, each finished Ask Cue task about a Canvas project and each chaser sent goes into a queue (`CUE_PLOG_Q`); the 5-minute resume sends up to 50 lines per tick through the bridge (`project_log`). Canvas decides which project an email belongs to and drops the rest. No AI call.
- `CueIntakeCheck.gs`: door-only helpers for the cloud check `test/checks/intake-real.check.mjs` (backlog card intake-real-check, 29 Oct 2026). `cueIcPick_` lists the newest real inquiries Cue sorted (New mail's sort plus older Inbox triage lines, or one project named in `test/checks/intake-real.only.txt`), `cueIcStart_` starts intake on one as Start intake does, and `cueIcDeep_` runs phases 2 to 4 on a copy, so the check writes nothing to Canvas and sends nothing.
- `CueRelnotes.gs`: daily release notes (spec `specs/daily-release-notes.md`, Kiko approved 27 Oct 02:34Z). At 19:45 Manila (Scheduled tasks row "Daily release notes") Cue reads the Cue sheet's "Release Log" tab (columns Went live (UTC), App, Release, What it changes; the "Cue and Canvas deploys" thread adds one row for each release it ships, and Cue makes the tab if it is missing) and keeps the releases, Canvas and Cue, that went live in the 24 hours before 19:45 and were never announced. Nothing live: no thread. Otherwise one Claude call writes plain New and Fixed lines, and the card lets Kiko edit them and tap **Post at 8 PM** (after 8 PM, **Post now**) or **Skip today**. Canvas posts it once through the bridge write `ann_post` (staff only, from Kiko, not emailed). The Cue sheet's "Release Notes" tab lists every entry posted or skipped, so none is listed twice. Needs the Canvas bridge write `ann_post` (live since V283). Cloud check: `test/checks/1.27.57-release-notes.check.mjs` (made-up releases through `cueRnCheck`; a check's notes never post).
- `CueLookup.gs`: Transfer lookup and invoice line edit (spec `specs/transfer-lookup-invoice-edit.md`; Kiko 27 Oct 09:20Z). A transfer question is answered in code from BSE Scopes and Transfers, read only. "add REC-<number> to the <project> invoice" shows an Approve card, then writes the line once through Canvas `invoice_line` (bridge read `bi_list`).
- `CueHelp.gs`: Help answers (spec `specs/help-qa-bank.md`, phase 2; Kiko 27 Oct 02:34Z). "help: <question>", "faq: <question>" or "help crew|client|supplier: <question>" reads the Live rows of Canvas's "Help Q&A" tab through the bridge (`help_qa`, cached 10 minutes) and matches the question in code, with no AI call. The card shows the best answer, its Canvas page and up to two close matches, with Copy reply, Rephrase (one Claude Haiku call, Taglish, same facts) and Edit answer in bank. With no match, Add as Draft adds the question to the tab (`help_qa_add`, request id `cuehelp:<task>`) for Kiko to answer. Nothing is sent to anyone. The bridge actions are live in Canvas since V283.
- `CueEdit.gs`: Canvas edits through the generic bridge (spec `specs/generic-bridge.md`; Kiko 27 Oct 10:10Z). When the chat call sees a change to a Canvas record (`canvas_edit`), Cue reads the allow-list and each allowed tab's columns, makes one Claude call to pick the row and the new values, and shows an Approve card with old and new values. Approve writes once through Canvas `write_rows`. "allow cue to read|edit ... in <tab> in <book>, key <column>" adds an allow-list row after Approve (`allow_list_set`), with no AI call.
- `CueContactScan.gs`: "fill contact details from old emails" (spec `specs/crm-email-scanner.md`; Kiko's Yes 27 Oct 15:54Z). Canvas lists P0 Contacts rows with blank Position / Title, Phone or Company (`contact_gaps`); Cue reads only the signature lines of each person's newest emails in Kiko's Gmail, makes one Claude call, keeps only values found word for word in a signature line, and shows one Approve card. Approve sends one `contact_fill`; Canvas fills blank cells only, never a cell that was filled, undone or edited before (named on the card as "Left alone"), and logs each in CRM Auto Added (undoable). Tab "Contact scan" remembers who was checked.
- `CuePersonal.gs`: personal expenses, started when Kiko says "personal expense". GPT reads the proofs (Claude looks again only at unsure items), code checks Personal Expense 2 and BSE Scopes and Transfers (read-only; Transfers and Payment Request through Canvas `read_rows` when they are on Canvas's allow-list, else direct), and after Kiko approves it writes the rows, files the proofs in **Personal expense proofs** in Kiko's My Drive, and reads every row back. Never writes to Canvas.
- `CueCanvas.gs`: Open in Canvas (spec `specs/open-in-canvas.md`, Kiko OK 21 Oct 19:20Z). Builds Canvas links in the format Canvas's quick-command bar uses (`?page=…&project=…&tab=…&action=pay|newscope`, `qc` / `qcadd` as URL-safe base64 JSON, `qctask`, `q`), reads Kiko's Canvas commands in code ("open <project>", "request payment for …", "add scope … to …", "close task … in …", "price watch …", "open supplier …", "open finance"), and gives each card its Canvas page. The page shows Canvas in the viewer pane (a new tab on a phone). Bank details never go in a link. `CUE_CANVAS_URL` overrides the Canvas address.
- `CueTri.gs`: add a task, issue or risk to a Canvas project (spec `specs/cue-add-tasks.md`, Kiko go 24 Oct 06:50Z). "add task … to <project>, due …, for …" is read in code and shows a card. Approve adds the row once through the bridge's `add_tri_items`.
- `CueIntake.gs`: the pipeline, the prompts and schemas, edits, approve and reject, and the RFQ drafts.
- `CueVendor.gs`: supplier search (find, compare or assess suppliers). One Canvas read (supplier_lookup), GPT web search only when the Supplier DB is thin, Claude's comparison with Preferred first, and optional RFQs. Writes the Vendor runs and Prospects tabs in the Cue sheet; never Canvas.
- `CueFunnel.gs`: **Sales funnel and HubSpot tasks** (spec `specs/sales-funnel-tasks.md`, Kiko go 24 Oct 13:56Z). Code reads Canvas's Sales funnel counts (`crm_funnel`; since 1.27.68, as HubSpot sync is off) and Kiko's open HubSpot tasks, daily at 7:00 and on "show the funnel" or "my HubSpot tasks". No AI call. The thread shows deals per stage as bars (with how many are stuck) and the tasks with **Mark done**, which closes that one task in HubSpot and reads it back. Needs task read and write scopes on the HubSpot key. Gives two Today rows.
- `CueStatus.gs`: Friday status updates (Kiko 29 Oct 2026 12:57Z, spec `specs/status-reports.md` v2). Fridays 07:00 (Scheduled
  tasks row "Friday status updates") or "status updates" / "status of <event>": Canvas lists the active events (`client_status`
  ids_only), reruns each one's readiness checklist (`get_readiness`), then builds one client email each (`client_status` email).
  The card has To, Preview, Send (from Kiko's Gmail, one confirm) and Skip per email. No AI call.
- `CueToday.gs` + `Today.html`: the Today card (spec `specs/daily-digest.md`, Kiko go 24 Oct 06:44Z). `cueTodayFrom_` turns the day's scheduled-job runs (morning batch, bid check, HubSpot check, status report, pipeline review, ChatGPT tasks) into one row per thing that needs Kiko plus one "Done for you" line, each naming who did the work ("Done by ChatGPT · checked by Cue"). No AI call. `/exec?view=today` is a hidden frame for Canvas Home: after Canvas sends `cueHost` it posts `{canvasWs:'cue-today', day, count, rows, done}` and Canvas draws the card in its own look. In Cue's chat, a day's job lines fold into one Today line.
- `CueGmail.gs`, `CueText.gs`, `CueDates.gs`: shared helpers many features use (Gmail read, draft, reply and send; text and number clean-up; Philippine-time dates). Moved out of feature files unchanged (structure review phase 1, 28 Oct 2026).
- `CueCommands.gs`: the command list (structure review phase 2, 28 Oct 2026). Every task kind with its run, Approve and "stopped" line, and the ordered word checks and chat-call starts that `cueSendWith_` goes down. A new command is one line here.
- `CueJobs.gs`: the background job list `cueResume` runs every 5 minutes, and the Job Runs tab (structure review phase 3, 28 Oct 2026). Each job run writes one row (Started, Finished, Job, Result, Error, Count); rows older than 30 days are deleted once a day. Canvas Admin reads the tab; Cue has no jobs page of its own.
- `tools/map.mjs`: writes `FEATURE-MAP.md` from the code (`node tools/map.mjs`; `--check` only compares).
- `Index.html`: the graphite UI, in three panes: chat, threads and the viewer. There is no Widgets page; cards minimize to a bar above the chatbox. Since structure review phase 2 (28 Oct 2026) it holds the markup and puts its parts in place: `IndexStyle.html` (styles), `IndexChat.html` (state, server calls, panes, Canvas pane), `IndexViewer.html` (file viewer and toolbar), `IndexThreads.html` (thread list, files, composer and send, chat and thread rendering), `IndexPages.html` (morning batch, settings, schedules, usage, rules) and `IndexCards.html` (cards). `doGet` serves it as a template (`cueInclude_`); the script parts are pieces of one script, so their order matters. `test/page.js` joins the page the same way for tests.
- `extension/`: the Cue bubble, a Chrome extension (Manifest V3). Load it unpacked from `chrome://extensions`, then set your Cue `/exec` address on its Options page. Bubble 1.2.0 also snaps the Chrome tab into Cue's message box (📷 in Cue, Alt+Shift+S, or right-click "Cue: snap this page / an area"); `cue-drop.js` runs only in Cue's page frame and fills the box, it never sends.
- `test/cue.test.js`: local tests (`node test/cue.test.js`). The tests themselves are in `test/features/`, one file per feature, loaded in file-name order after `00-harness.js` (the mocks and the sandbox). Bridge calls are checked against the schema in `test/fixtures/ZapBridge.gs`, an exact copy of Canvas `src/ZapBridge.gs`; `test/fixtures/ZapBridge.version` names the Canvas version and md5. Test BC1 fails when Cue calls an action the copy lacks, and BC2 fails when the copy changes without its version note. Refresh both whenever a Canvas release changes the bridge.

## Setup (Kiko, in your personal Google account)

1. **Make the project.** Create a new Apps Script project named **Cue** in Kiko's own account. Copy in everything from `src/`: the `.gs` files, `Index.html` with its `Index*.html` parts, and `appsscript.json` (enable "Show appsscript.json" in Project Settings).
2. **Enter the Script Properties.** Kiko types these personally (Project Settings → Script Properties). Never paste them in chat.
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `ZAD_SECRET`: the same bridge secret Canvas uses.
   - `CUE_BRIDGE_URL`: the Client app's `/exec` address.
   - Optional:
     - `OPENAI_MODEL` (default `gpt-5-mini`; confirm the name in the OpenAI console)
     - `OPENAI_PRICE` (for example `0.25,2` to log GPT cost)
     - `CUE_CLAUDE_MODEL` (default `claude-sonnet-5-5`)
     - `CUE_CLAUDE_EFFORT` (default `medium`)
     - `CUE_RFQ_DAYS` (default 3)
     - `CUE_SIGNOFF` (default `Blank Space Events`)
     - `CUE_RFQ_NEVER` (addresses or domains never to chase, comma list; default none)
     - `CUE_HUBSPOT_TOKEN`: needed for pipeline reviews and HubSpot cleanup. One HubSpot **service key** named "Cue" with these scopes: deals read; contacts and companies read and write; notes and tasks write.
     - `CUE_PIPE_QUIET_DAYS` (default 7) and `CUE_PIPE_AWARD_DAYS` (default 3 working days once the CE is with the client): when a deal counts as quiet.
3. **Set spend limits** in the OpenAI and Claude consoles.
4. **Run `cueSetup`** once from the editor. It makes the Cue spreadsheet and the 5-minute resume trigger, and lists any missing keys. Then authorize the scopes it asks for:
   - Sheets
   - Drive (only files Cue makes)
   - external requests
   - triggers
   - Gmail compose (drafts, and sending a draft after Approve and send)
   - your email address
5. **Deploy.** Deploy → Web app, execute as **Me**, access **Only myself**.
6. **First test.** Run it with Kiko watching, on one real inquiry. Check the card, the AI calls and the seconds, then approve and confirm the project and lines in Canvas.

## HubSpot clean-up (command C12)

Type "clean up HubSpot" or tap the chip. Canvas reads HubSpot with its own key through the bridge (`hubspot_scan`, read only) and applies only the fixes ticked on the card (`hubspot_fix`, at most 50 record changes, each read back). Cue holds no HubSpot key for this. Claude checks the unsure look-alikes in one call; ChatGPT looks up missing websites only when asked. Fields Canvas owns are never edited in HubSpot: a Canvas contact's name is fixed in Client Desk. Every change goes to the HubSpot Cleanup tab. A Monday 06:00 scan (`cueHsWeekly`) only prepares the card.

## Canvas side

Cue talks to Canvas only through the signed bridge. That is in place: main **V183** and Client **V41** were deployed on 21 Oct 2026. The Canvas code itself lives in the CanvasWorkspace repo, not here.

## Not yet known (to confirm on the first live run)

- **Timing.** These are estimates, not measurements: about 20 to 60 s for most intakes, longer with web research or 20+ lines. The flag shows the real numbers.
- **GPT details.** Whether the configured GPT model supports `web_search` together with strict JSON output, and the exact model name.
- **UrlFetch timeout.** Whether it holds for a long Claude call. If it doesn't, lower `CUE_CLAUDE_EFFORT` to `low`.

## Deploying (after the first manual setup)

No more copy and paste. The **Deploy Cue** Action replaces every file in the Cue Apps Script project with `src/`, makes a new version and points the same `/exec` address at it. It runs the tests first and reads the files back afterwards. `mode=check` only shows what would change.

One-time setup:
1. Fill in `account` and `scriptId` in `deploy.json`.
2. Add a repo secret `DEPLOY_KEY` (any long random password; Settings → Secrets and variables → Actions).
3. Turn on the Apps Script API for that account at https://script.google.com/home/usersettings.
4. Run **Connect Google** once. It opens an issue with a sign-in link; sign in, then paste the address of the page that fails to load as a comment. The sign-in is stored only encrypted (`.deploy/clasprc.enc`).

Script Properties (the keys) are never touched by a deploy.
