# Changelog

## Cue 1.10 (batch release rel/cue-batch; not deployed)

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

Chasing sweep task 3 (spec `canvas-integration/specs/ce-award-chasers.md`, approved by Kiko 21 Oct 08:11Z). New file `src/CueSweepAward.gs`, a sweep kind.

- **What it finds.** Projects in **For Client Awarding** on the Canvas board. For each, Cue searches Kiko's Sent Gmail for the CE email (CEs only go from Kiko's own Gmail, Kiko 08:10Z) and reads that thread's headers.
- **When.** First chaser 3 business days after "waiting since" (from `awaiting.since` in the next Canvas release, or the CE email date until then), then every 5 business days, at most 3. Chasers Kiko sent by hand in the thread count, and so does a chaser saved with Drafts only.
- **Flags with no draft.** The client replied: "have a look". Chased 3 times: "call the client or mark Not Awarded". Event within 7 days or past: urgent. No CE email found: chase by hand.
- **Who does what.** Canvas: the board read the sweep already makes. Code: Gmail search and timing. ChatGPT: the sweep's one combined draft call, with no call of its own. The CE number and total show on the card line but are kept out of the facts given to ChatGPT. Client chasers only go out when Kiko approves.
- The file name sorts after `CueSweep.gs` on purpose, because Apps Script runs files in order and `cueKind_` must exist first.
- Tests: 9 new (A1 to A9), 61 of 61 pass. Other tests run with the award kind off (`CUE_CHASE_OFF=award`).

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
