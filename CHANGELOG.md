# Changelog

## Unreleased (chasing sweep)

The chasing sweep engine and task basics (backlog task 1; spec `canvas-integration/specs/sweep-engine.md`, approved by Kiko 21 Oct 07:31Z).

- **Morning batch.** At 07:00 Philippine time, `cueSweep` builds one batch of follow-ups, grouped by kind. Each line can be ticked, edited, skipped for today, or stopped. **Approve and send** makes the drafts at once and sends them at 09:00 PH time; if Kiko approves after 09:00, they go out straight away. Before 09:00 the send can be cancelled, and the emails stay in Gmail Drafts. **Drafts only** sends nothing. Kinds marked `sendAllowed: false` are always drafts. A kind with a `send` hook (payments, sent from info@ with Kiko on CC through Canvas, Kiko 08:09Z) is sent by that hook at 09:00 instead of Kiko's Gmail. A day with nothing to chase gets a single chat line and no card. An older batch that was never approved is closed when the next one is built, so its lines come back.
- **Who does what.** Code finds, filters and sends. Canvas is read once with `get_project_board`, and only when a kind needs it. ChatGPT drafts every line in one call, or two when the batch is big. If ChatGPT fails, each kind's template is used, so the batch never depends on ChatGPT. Claude is not in the daily run. The budget is 3 AI calls or fewer.
- **Chase log tab.** It keeps when each line was last chased, how many times, when it's next due, whether it's muted, and a note. The engine applies each kind's `every` and `max` from this tab. When a line reaches `max`, it shows once under "Chased the max times, no reply. Your call" and is then left alone (Kiko 07:31Z). Caps are 15 lines per kind and 40 per batch; the rest wait for tomorrow.
- **Kind hook for tasks 2 to 6 and inbox triage:** `cueKind_({ kind, label, find(ctx), draftBrief, template, every, max, sendAllowed, send?, act?, posted?, chase? })`. Kinds can be paused with the Script Property `CUE_CHASE_OFF`. The only kind built in is **Your tasks due**, which lists Cue tasks that are due today or overdue. It has no email and no AI.
- **Task basics.** Every task has a due date, a priority (High, Normal or Low) and a reminder. Kiko can set them on the bar at the top of the thread, or by saying so in chat; that uses the same chat call, with no extra AI call. Needs you sorts by priority, then due date. A reminder posts in the thread and the main chat and puts the task in Needs you. Reminders that fall due in quiet hours (21:00 to 07:00) wait until 07:00. **Close** works on any task that isn't running. **Archive** hides a closed task, and **See archived** brings it back.
- **Chaser rules card** (Kiko 08:12Z; spec `specs/chaser-rules.md`, approved 08:15Z). In Widgets, under Chaser rules, there is one row per chaser (RFQ, CE award, payment, accreditation, FSA/AR) with on/off, first chase after, then every, and stop after. A General section sets the build time, send time, quiet hours and caps. The defaults are the ones each chaser's spec agreed. Values are checked, kept in a new **Rules** tab (with the time of each change and the old value), noted in the chat, and used from the next batch. A broken value typed straight into the tab falls back to its default, and the batch says so. Working-day rules skip weekends, and moving the build time moves the trigger. Kinds read their numbers with `ctx.rule(kind)`; the kind names are `rfq`, `award`, `payment`, `accreditation` and `signature`. Code only, no AI.
- **No new Google scopes.** The 07:00 trigger is installed the next time Cue opens (`CUE_TRIGGERS_V=2`), so a deploy needs no setup step.
- Tests: S1 to S13, S5b and R1 to R6; 58 of 58 pass.
## Unreleased (RFQ chasers)

RFQ chasers, a kind in the morning batch (backlog task 2; spec `canvas-integration/specs/rfq-chasers.md`, approved by Kiko 21 Oct 07:49Z). Built on the chasing sweep engine.

- **Who gets a nudge.** A supplier who got an RFQ from Kiko's Gmail and hasn't replied in time. The timing comes from Kiko's Chaser rules card: by default 3 working days (Mon to Fri, PH time), then every 3, up to 2 nudges; when the Canvas event is within 7 days, it's 1 working day and then every 1. A follow-up Kiko sends himself restarts the wait. Cue checks the thread and any new email from that address. It skips a thread when a draft is already waiting, when the project is lost, cancelled or past, when the recipients are BSE only, or when the address is in `CUE_RFQ_NEVER`. Threads come from an RFQ-words search of Kiko's sent mail (not plain "quotation", so client quotations are never chased), plus every RFQ Cue sent itself, whatever its subject.
- **Nudges** are replies in the original RFQ thread (In-Reply-To the last message), with no attachments, and ask for the quote within 2 working days. ChatGPT drafts them in the engine's one combined call; if that fails, a template is used. RFQ chasers make no AI call of their own, and Claude isn't used. After 2 nudges Cue stops and hands the supplier to Kiko.
- **Never info@** (Kiko 07:45Z): the old `CUE_DRAFTS_IN=canvas` switch is removed, so RFQ drafts are always made in Kiko's own Gmail. Cue no longer calls `make_rfq_drafts`.
- **No new scopes and no Canvas writes.** It uses Gmail read (already granted) and the engine's one `get_project_board` read.
- Tests: Q1 to Q5 added. C8 now checks that the old switch is ignored, and C16b is removed.

## Cue 1.8.2 (not deployed yet; best with Canvas V186)

- Budget (Kiko 07:19Z): the 3-minute budget counts Cue's own time only (the run to the card plus the work after Kiko approves), not the time a card waits for him. Cards show "Cue worked N s".
- Project folder honesty: Canvas V186 says when a project has no Drive folder yet (usually no event date). Cue then says the files went to Canvas Files for that project (shown in Canvas's Files tab) instead of claiming the project folder. Before V186, Cue keeps the old wording.

## Cue 1.8.1 (not deployed yet)

- Reopen (Kiko 07:15Z): Recently done cards have a Reopen button instead of a reply box. A reopened task waits in Needs you ("Tell Cue what to do next") with a reply box and a Close again button, and its thread opens. Reopening runs, writes and sends nothing. When a new run joins the thread, the reopened one goes back to how it finished.

## Cue 1.8 (deployed as Version 18, with Canvas main V185 / Client V43)

- Files go in the project folder (Kiko 06:45Z): after Kiko approves, every file he attached is saved in the Canvas project folder through the new bridge action save_project_file (photos to Designs & Visuals; other files to Brief & Planning for a new project, Client Documents for a change). The card lists them with links. A failure is a note and is retried on the next approve; Canvas never makes a second copy.
- Reply box on every widget card (Kiko 06:48Z), with Cue's latest line in that thread above it. It posts into the task's thread; Enter sends; typed text survives refreshes.
- Threads hold everything (Kiko 06:50Z): the request and its files, the conversation, and the full card for every run, also after it is done. Finished requotes are one line per supplier with sent / in Drafts, and expand in place to the whole email with an Open in Gmail link. Links open in a new tab.
- The progress tracker sits at the top of the thread (Kiko 06:51Z).
- Cue's messages point to the thread instead of Widgets.
- Cue answers in the main chat (Kiko 06:53Z): a task started there gets "On it. I started a thread for this" under Kiko's message, with the thread's reply count, title and status; a message filed into an existing thread gets "Answered in the <project> thread".
- Summary (Kiko 06:55Z): when a task finishes, is rejected, or something is sent, Cue posts one line in the main chat and in the thread saying what happened (sent, in Drafts, files saved, still open). Built from the record, no AI call.
- Task rules (Kiko 06:57Z): a new message about a task from the last 7 days reopens that task's thread instead of starting a new one. Cue guesses from the project or client name in the message (no AI call), and Canvas's project match confirms it or moves the run into the right thread. The main chat says "This is about BEKO Booth, so I reopened its thread." A reopened thread keeps its name while the new run is read.

## Cue 1.7 (deployed as Version 17)

- Answers go in the thread (Kiko 06:29Z, "like your own UX"): when Kiko writes in the main chat about a task that already has a thread, GPT (same single chat call) picks the task. Kiko's line stays in the main chat with "Answered in the <project> thread" and an Open thread row; his message and Cue's answer go in that thread. A redo started this way joins the same thread.

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
