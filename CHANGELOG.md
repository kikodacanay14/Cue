# Changelog

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
