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
- `CueChange.gs`: change requests, started when Canvas's duplicate check finds the project (or Kiko says it is a change). Lists the project's folder files through Canvas, searches Kiko's **sent** Gmail (gmail.readonly) for RFQ emails about the project, then makes reply drafts in those threads with the attachments. Cue sees only Kiko's own mailbox, not info@.
- `CuePipeline.gs`: command C11, **Review deals and follow-ups** (spec `specs/c11-pipeline-health.md` in the project files, approved by Kiko 21 Oct 07:34Z). The chat call recognises the ask ("how's the pipeline", "who do I need to chase", "kumusta yung deals"). Code reads the open deals from HubSpot (read-only token) and the newest email for each deal from Kiko's Gmail, flags them with fixed rules (Act today, Chase, Fix the data, On track), and one Claude call writes where each stands and the next step. Kiko can tick deals for follow-ups: one GPT call drafts a reply in each deal's thread, then Approve and send or Drafts only. Never writes to HubSpot or Canvas. Logged in the Pipeline tab.
- `CueAr.gs`: "Prepare ARs for <project>" (acknowledgement receipts). GPT picks the command and the project in the chat call Cue already makes; Canvas lists who was paid (`ar_list`), makes only the receipts Kiko ticks (`ar_make`, 15 per run) and emails supplier and talent receipts from AccountsPayables@ only when Kiko approves that too (`ar_email`). No other AI call; nothing from Kiko's Gmail.
- `CuePersonal.gs`: personal expenses, started when Kiko says "personal expense". GPT reads the proofs (Claude looks again only at unsure items), code checks Personal Expense 2 and BSE Scopes and Transfers (read-only), and after Kiko approves it writes the rows, files the proofs in **Personal expense proofs** in Kiko's My Drive, and reads every row back. Never touches Canvas.
- `CueIntake.gs`: the pipeline, the prompts and schemas, edits, approve and reject, and the RFQ drafts.
- `CueVendor.gs`: supplier search (find, compare or assess suppliers). One Canvas read (supplier_lookup), GPT web search only when the Supplier DB is thin, Claude's comparison with Preferred first, and optional RFQs. Writes the Vendor runs and Prospects tabs in the Cue sheet; never Canvas.
- `Index.html`: the graphite UI. Chat is page 1. Widgets is page 2, with Needs you, Working on (the GPT → Canvas → Claude + GPT → GPT hand-off), the speed budget and recently done.
- `extension/`: the Cue bubble, a Chrome extension (Manifest V3). Load it unpacked from `chrome://extensions`, then set your Cue `/exec` address on its Options page. Bubble 1.2.0 also snaps the Chrome tab into Cue's message box (📷 in Cue, Alt+Shift+S, or right-click "Cue: snap this page / an area"); `cue-drop.js` runs only in Cue's page frame and fills the box, it never sends.
- `test/cue.test.js`: 42 local tests (`node test/cue.test.js`). Bridge calls are checked against the schema in `test/fixtures/ZapBridge.gs`, a copy of the Canvas bridge as of main V186 plus `get_readiness` (CanvasWorkspace branch claude/project-thread-fd2fwb). Refresh that copy whenever a Canvas release changes the bridge.

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
     - `CUE_HUBSPOT_TOKEN`: needed for pipeline reviews. A HubSpot **private app** token with read scopes only: `crm.objects.deals.read`, `crm.objects.contacts.read` (HubSpot → Settings → Integrations → Private Apps). Cue never writes to HubSpot.
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
