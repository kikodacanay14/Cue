# Cue

**Cue 1.0** (first release, not yet deployed). Cue is its own app with its own version numbers; Canvas keeps its V-numbers.

Cue is Kiko's personal command center. Version 1.0 does project intake. It is an Apps Script web app in Kiko's own Google account, separate from company Canvas. This slice does one thing: a project intake that starts in Cue's chat, is approved in Cue, and gets recorded in Canvas.

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
- `CueSweepRfq.gs`: RFQ chasers, a kind in the morning batch. Finds Kiko's sent RFQs with no supplier reply after 3 working days and drafts a nudge in the original thread. Gmail read only; no AI call of its own; at most 2 nudges, then Kiko decides.
- `CueReady.gs`: readiness checks (spec `specs/project-readiness.md`, Kiko approved 21 Oct 07:32Z). "Is X ready?" in the chat: Canvas finds the project and returns its Checklist tab exactly as Canvas scores it (bridge read `get_readiness`, plus `list_project_files`); code flags overdue items, missing owners and blockers close to the event; Cue looks in Kiko's Gmail (subjects and snippets, 60 days) for proof Canvas has not recorded; one Claude call writes the summary, top risks, what closes each blocker and whether each email or file looks like proof. Canvas's counts are never changed. **Draft follow-ups** (one GPT call) drafts replies in the email threads for items Waiting on Others; they go out only on Approve and send. Nothing is written to Canvas. Needs the Canvas release that adds `get_readiness`.
- `CueStatus.gs`: status reports (spec `specs/status-reports.md`, Kiko approved 22 Oct 15:56Z). Mondays 07:00 (Scheduled tasks row "Monday status report"), or "status report" / "status of <project>" in the chat. Canvas returns every active project in one read (bridge read `status_digest`: For Production Start or later, event no more than 7 days ago); code flags late items, risks, money and cash, worst first; Cue reads Kiko's Gmail (7 days, subjects and snippets). Claude writes the top 3 and one line per project; GPT reads the emails (new tasks, issues and risks, client-safe highlights) and drafts one client update per changed project to its main contact. Code strips money, supplier names and internal risks from every update. Ticked items go to Canvas's TRI Tracker only on **Add ticked to Canvas** (bridge write `add_tri_items`, read back); updates go only on **Approve and send** (from the third Monday report on) or **Save to Gmail drafts**. Needs the Canvas release that adds both bridge actions.
- `CueRelay.gs`: AI relay (spec `specs/ai-relay.md`, Kiko 23 Oct 03:47Z). `doPost` takes `relay_post` / `relay_list` / `relay_read` with a sender key (Script Properties `CUE_RELAY_KEY_CHATGPT`, `_CLAUDE`, `_CUE`; Settings > AI relay makes them). claude.ai adds rows to the Relay tab instead. Notes pass on at once and show in an AI relay thread per topic (`CUE_RELAY_GATE=on` makes each wait for Kiko's Pass on). "tell Claude: ..." sends Kiko's own note. No AI call; writes only the Relay tab. Deploy Cue mode=deploy also makes or updates the "Cue relay" deployment (same code, manifest access ANYONE_ANONYMOUS, its own version) and prints its URL for Settings > AI relay. 1.31 adds `canvas_read` (allow-listed bridge reads, bank and signature fields stripped), `relay_task` (CE costs, expense, intake handed over with files; a one-off trigger `cueRelayKick` starts it), `relay_task_status`, `relay_task_reply` and `relay_task_confirm` (Kiko confirms in ChatGPT: consequential Action plus a one-time 10-minute code; `CUE_RELAY_WRITES=off` refuses it). Emails and RFQs never go through the relay.
- `CueChange.gs`: change requests, started when Canvas's duplicate check finds the project (or Kiko says it is a change). Lists the project's folder files through Canvas, searches Kiko's **sent** Gmail (gmail.readonly) for RFQ emails about the project, then makes reply drafts in those threads with the attachments. Cue sees only Kiko's own mailbox, not info@.
- `CuePipeline.gs`: command C11, **Review deals and follow-ups** (spec `specs/c11-pipeline-health.md` in the project files, approved by Kiko 21 Oct 07:34Z). The chat call recognises the ask ("how's the pipeline", "who do I need to chase", "kumusta yung deals"). Code reads the open deals from HubSpot (read-only token) and the newest email for each deal from Kiko's Gmail, flags them with fixed rules (Act today, Chase, Fix the data, On track), and one Claude call writes where each stands and the next step. Kiko can tick deals for follow-ups: one GPT call drafts a reply in each deal's thread, then Approve and send or Drafts only. Never writes to HubSpot or Canvas. Logged in the Pipeline tab.
- `CueAr.gs`: "Prepare ARs for <project>" (acknowledgement receipts). GPT picks the command and the project in the chat call Cue already makes; Canvas lists who was paid (`ar_list`), makes only the receipts Kiko ticks (`ar_make`, 15 per run) and emails supplier and talent receipts from AccountsPayables@ only when Kiko approves that too (`ar_email`). No other AI call; nothing from Kiko's Gmail.
- `CueCrmLog.gs`: client emails to Canvas Accounts › Activity (CRM funnel spec, part F5). Every hour from 08:00 to 21:00 Manila, the 5-minute resume reads Kiko's Emails waiting list through the bridge (`mail_waiting`, headers only) and logs each waiting **client** email with `crm_log` (kind Email, sender, subject, project), one row per thread per day. No AI call and no tap (Kiko 26 Oct 16:10Z). The Cue sheet's "CRM Email Log" tab lists every row logged or failed; a failed one is tried again the next hour.
- `CueHelp.gs`: Help answers (spec `specs/help-qa-bank.md`, phase 2; Kiko 27 Oct 02:34Z). "help: <question>", "faq: <question>" or "help crew|client|supplier: <question>" reads the Live rows of Canvas's "Help Q&A" tab through the bridge (`help_qa`, cached 10 minutes) and matches the question in code, with no AI call. The card shows the best answer, its Canvas page and up to two close matches, with Copy reply, Rephrase (one Claude Haiku call, Taglish, same facts) and Edit answer in bank. With no match, Add as Draft adds the question to the tab (`help_qa_add`, request id `cuehelp:<task>`) for Kiko to answer. Nothing is sent to anyone. Needs Canvas release V281 / Client V138.
- `CueMailAlerts.gs`: the email check behind Canvas's Emails waiting (bug fix 27 Oct 2026). Every 10 minutes the 5-minute resume reads Kiko's Inbox headers (Gmail, read only) and writes `canvas-email-alerts.json` in Kiko's Drive, shared view-only with info@: threads whose newest message is from outside BSE, within 14 days. It replaces the separate Canvas email check app's trigger, which stopped on 25 Oct. No AI call.
- `CueProjectLog.gs`: the project log behind the Projects section of Canvas's Team Cue panel (Kiko 27 Oct 2026 10:34Z). Each email thread the email check reads, each finished Ask Cue task about a Canvas project and each chaser sent goes into a queue (`CUE_PLOG_Q`); the 5-minute resume sends up to 50 lines per tick through the bridge (`project_log`). Canvas decides which project an email belongs to and drops the rest. No AI call.
- `CueLookup.gs`: Transfer lookup and invoice line edit (spec `specs/transfer-lookup-invoice-edit.md`; Kiko 27 Oct 09:20Z). A transfer question is answered in code from BSE Scopes and Transfers, read only. "add REC-<number> to the <project> invoice" shows an Approve card, then writes the line once through Canvas `invoice_line` (bridge read `bi_list`).
- `CueEdit.gs`: Canvas edits through the generic bridge (spec `specs/generic-bridge.md`; Kiko 27 Oct 10:10Z). When the chat call sees a change to a Canvas record (`canvas_edit`), Cue reads the allow-list and each allowed tab's columns, makes one Claude call to pick the row and the new values, and shows an Approve card with old and new values. Approve writes once through Canvas `write_rows`. "allow cue to read|edit ... in <tab> in <book>, key <column>" adds an allow-list row after Approve (`allow_list_set`), with no AI call.
- `CuePersonal.gs`: personal expenses, started when Kiko says "personal expense". GPT reads the proofs (Claude looks again only at unsure items), code checks Personal Expense 2 and BSE Scopes and Transfers (read-only; Transfers and Payment Request through Canvas `read_rows` when they are on Canvas's allow-list, else direct), and after Kiko approves it writes the rows, files the proofs in **Personal expense proofs** in Kiko's My Drive, and reads every row back. Never writes to Canvas.
- `CueCanvas.gs`: Open in Canvas (spec `specs/open-in-canvas.md`, Kiko OK 21 Oct 19:20Z). Builds Canvas links in the format Canvas's quick-command bar uses (`?page=…&project=…&tab=…&action=pay|newscope`, `qc` / `qcadd` as URL-safe base64 JSON, `qctask`, `q`), reads Kiko's Canvas commands in code ("open <project>", "request payment for …", "add scope … to …", "close task … in …", "price watch …", "open supplier …", "open finance"), and gives each card its Canvas page. The page shows Canvas in the viewer pane (a new tab on a phone). Bank details never go in a link. `CUE_CANVAS_URL` overrides the Canvas address.
- `CueIntake.gs`: the pipeline, the prompts and schemas, edits, approve and reject, and the RFQ drafts.
- `CueVendor.gs`: supplier search (find, compare or assess suppliers). One Canvas read (supplier_lookup), GPT web search only when the Supplier DB is thin, Claude's comparison with Preferred first, and optional RFQs. Writes the Vendor runs and Prospects tabs in the Cue sheet; never Canvas.
- `CueCheck.gs`, `CueCheckKey.gs`: check mode for the cloud check (spec `specs/cue-cloud-check.md`, Kiko ok 27 Oct 2026 08:28Z). Off in every normal build: `CueCheckKey.gs` holds four empty values and the check door refuses everything. Only the copy that `tools/check.mjs` pushes for one check run fills them (the SHA-256 of a one-run key, an end time 45 minutes away, the Canvas test project and the test email pattern). In that copy every server call is fenced: Canvas writes must name the test project, Gmail drafts and sends must go only to addresses matching the pattern, any other outgoing write stops the run, and the run's tasks and chat rows are tagged so the page, the 5-minute resume, AR reminders and the sweep never mix them with real work.
- `test/checks/`: the cloud check. `run.mjs` drives the real `src/Index.html` in a robot browser (Playwright, Chromium) against a check link and writes `report.html` (a screenshot per step), `results.json` and the run summary. `<version>-<feature>.check.mjs` is one feature's check list as steps (first: `1.27.33-crew-docs.check.mjs`). `config.json` names the one Canvas project a check may write to (now the past project Hiraya Rewards and Recognitions), which document Make is tried on (`doc`) and whether the run may email anyone (`send`, false on a project with real crew). `dry-run.mjs` runs a check script with no Google and no Canvas, against Cue's server code in the test sandbox: `node test/checks/dry-run.mjs` (needs Playwright with Chromium).
- `Index.html`: the graphite UI. Chat is page 1. Widgets is page 2, with Needs you, Working on (the GPT → Canvas → Claude + GPT → GPT hand-off), the speed budget and recently done.
- `extension/`: the Cue bubble, a Chrome extension (Manifest V3). Load it unpacked from `chrome://extensions`, then set your Cue `/exec` address on its Options page. Bubble 1.2.0 also snaps the Chrome tab into Cue's message box (📷 in Cue, Alt+Shift+S, or right-click "Cue: snap this page / an area"); `cue-drop.js` runs only in Cue's page frame and fills the box, it never sends.
- `test/cue.test.js`: local tests (`node test/cue.test.js`). Bridge calls are checked against the schema in `test/fixtures/ZapBridge.gs`, an exact copy of Canvas `src/ZapBridge.gs`; `test/fixtures/ZapBridge.version` names the Canvas version and md5. Test BC1 fails when Cue calls an action the copy lacks, and BC2 fails when the copy changes without its version note. Refresh both whenever a Canvas release changes the bridge.

## Setup (Kiko, in your personal Google account)

1. **Make the project.** Create a new Apps Script project named **Cue** in Kiko's own account. Copy in everything from `src/`: the `.gs` files, `Index.html` and `appsscript.json` (enable "Show appsscript.json" in Project Settings).
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

## Cloud check (instead of a PC check)

The **Check Cue** Action checks a feature in a robot browser, so a PC check no longer needs Kiko at his PC. Start it from Actions › Check Cue › Run workflow with `ref` (the branch or commit to check, for example a release branch) and `script` (a file name in `test/checks/` without `.check.mjs`). It runs the tests, opens the check link (`node tools/check.mjs open`), runs the script, shuts the link (`node tools/check.mjs close`, always, pass or fail) and uploads the report as the `cue-check` artifact.

- The check link is a separate deployment named "Cue check". It runs its own version of the checked code in check mode, open without Google sign-in but locked with a key made new for each run and gone when the run ends; the link also shuts by itself after 45 minutes. Live `/exec`, `/dev` and the triggers keep running exactly what they ran before: the tool puts the Apps Script head back and checks it.
- Writes reach only the Canvas test project in `test/checks/config.json`; emails go only to addresses matching its `mail` pattern. Anything else stops the run and is listed in the report.
- Each run uses one Apps Script version (projects hold 200), so delete old versions in the project history now and then.
- No setup: the check uses the past project Hiraya Rewards and Recognitions (Kiko 27 Oct 2026 09:16Z: no new test project). Its crew are real, so `send` is false: check mode refuses every Canvas send (crew_docs_send, ar_email, send_payment_chasers, send_doc_reminder) and the script finishes without sending. Make writes one real unsigned document there, which Canvas never emails because the event is past.
- A check script presses Send only when `send` is true, which is only for a project whose crew are all Kiko's own aliases.

