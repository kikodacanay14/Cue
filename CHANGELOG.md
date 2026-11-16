# Changelog

## Cue 1.28.74: agent names show the new role names (not deployed)

Asked: Kiko, 16 Nov 2026 13:13Z ("lets change ECII to Procurement Specialist and ECI to Event Specialist"); Cue and dashboard labels
approved "aproved 9 and 10". Slot cue-1.28.74, card role-names-cue-labels. Built on main after 1.28.73.

- Display only. `src/CueAgentDrafts.gs` `cueAgdLabel_` and `src/IndexChat.html` `agdLabel` turn ECII into Procurement Specialist and
  ECI into Event Specialist (whole words). The name Canvas stores ("ECII agent") stays the thread key and is still what
  `agent_message` sends, so threads, draft_status and replies keep working. Canvas data, n8n and secrets are unchanged.
- Thread titles, draft and update cards, the lines Cue writes in a thread, "Saved for ...", the @ list and the thread box show the new
  name. The @ list inserts the new name; a tag with either name reaches the same agent. Older main-chat rows that carry the old name
  draw the new tag.
- Tests: ROLE1 to ROLE3 added; AGU1, AGU5, AGR1 and TAG2 now expect the new name; 846/846 pass.

## Cue 1.28.73: agent updates with requirement rows open a panel on the left (not deployed)

Asked: Kiko, 16 Nov 2026 11:58:14Z ("maybe something like a card then can be clicked opens that opens a window on the left"). He
removed Status, Handed to and Kind at 12:19:11Z, approved mockup v2 at 12:23:52Z (https://claude.ai/artifact/5m4yWBitssjLnRPEG2PncG)
and said "ok" at 12:25:28Z to: panel on the left, the agent sets Needs you per row, view only. Slot cue-1.28.73, card
agent-update-rows-panel. Built on live 1.28.72 (Version 251).

- `src/CueAgentDrafts.gs`: an update's handover keeps an optional `rows` list (at most 100): req_id, name, sourcing (In House or
  Outsourced), spec_by (AS or MM), dimensions, needs_kiko (true only when sent as true), open_items (at most 20). Other fields are dropped.
- `src/IndexCards.html`, `src/IndexChat.html`, `src/IndexStyle.html`: an update with rows is one short card ("AS agent · Pandamart
  Likha · 11 requirements · 5 need you") with Open requirements. The panel slides in from the left over the chat: All / Needs you,
  columns #, Requirement, Sourcing, Specs by, Dimensions ("MM to add" until MM fills it), Open items, Images (later); rows that need
  Kiko first; Reply and Mark read in its footer; ✕, the shade or Esc closes it. Updates without rows look as before.
- Needs Canvas first: `agent_update` in ZapBridge takes no `rows` yet, so no update carries rows until that Canvas change (Kiko's
  separate go) ships and Cue refreshes `test/fixtures/ZapBridge.gs`.
- Tests: AUR1 to AUR3 added; 843/843 pass.

## Cue 1.28.72: the FSA reminder starts 3 days after the FSA goes out (LIVE as Version 251, 16 Nov 2026 03:58Z, rollback 250)

Asked: Kiko, 16 Nov 2026 02:50:02Z ("FSA (the initial notification) / FSA Reminder - Automatic: Start - 3 days after initial,
(when does the chaser start)"). Claude showed that the signature chaser started the day after the event ended; Kiko said "yes"
at 03:44:20Z to starting it from the day the FSA was sent. Built on live 1.28.71 (Version 250), slot cue-1.28.72, card
fsa-reminder-start. No Canvas change: Canvas already gives each FSA's Generated date in `list_unsigned_docs`.

- `src/CueSweepSignature.gs`: an unsigned FSA is chased from 3 days after its Generated date (the day Canvas made and emailed it),
  then every 2 days, at most 3, as before. An FSA with no Generated date keeps the old start (the day after the event). ARs are
  unchanged. Before the event, the line says "FSA sent <date>. Event ends <date>." instead of "Event ended".
- The Chaser rules card's "First after" for FSA / AR signatures still sets the AR start; the FSA start is fixed at 3 days.
- Tests: G1 to G5 keep their dates (fixture FSAs made 12 Nov); G6 added; 840/840 pass. Rule CUE-058, CanvasWorkspace ADR-0185.
- Kiko said "ship" on 16 Nov 2026 at 03:57:37Z. Deploy Cue run 43801202211 shipped main 3977f36 as Version 251.

## Cue 1.28.71: tag an agent with @ in the main chat (LIVE as Version 250, 15 Nov 2026 12:46Z, rollback 249)

Asked: Kiko, 15 Nov 2026 08:30:07Z ("is it possible for me to type in the new Cue and tag the agent name like @ Account Specialist and
Cue sends the message to the Account Specialist agent"); scope and mockup approved on the card 09:24:50Z ("Approve, one agent per
message"); "build" 11:26:04Z, on /dev only (going live needs a separate yes). Rule CUE-057, CanvasWorkspace ADR for this decision.
Built on live 1.28.70 (Version 249), slot cue-1.28.71, card cue-agent-tag. No Canvas change: it uses `agent_message` (Canvas V540).

- `src/Cue.gs`, `src/CueAgentDrafts.gs`: a main-chat message that starts with "@" and an agent's name goes to that agent only, the
  same way as a line typed in its thread (`cueAgdTag_`, `cueAgdAgents_`). The main chat keeps it on rows marked "@<thread>", which
  Cue's assistant never reads. Unknown names send nothing; files are refused; Try again answers in the main chat too.
- `src/Index.html`, `src/IndexThreads.html`, `src/IndexStyle.html`: "@" opens the agent list above the box (arrows, Enter or tap to
  pick, Esc to close); a name that is no agent keeps the words in the box with a red note; the main chat shows the agent as a tag
  with "Saved for <agent> · it reads it on its next run · Open thread". The box placeholder mentions @.
- Codex review on PR #390: a tagged message now skips the batch, expense, upload and learn paths on the page, and the page gets
  every agent from the server (not only the 20 latest requests).
- Tests TAG1 to TAG5 added; 839/839 pass.
- Kiko said "ship @ tag" on 15 Nov 2026 at 12:46:07Z. Deploy Cue run 43715537330 shipped main 4538019 as Version 250.

## Cue 1.28.70: agent messages are saved once, and Try again resends the right one (LIVE as Version 249, 14 Nov 2026 17:52Z, rollback 248)

Asked: no new ask. These fix six findings of the Codex review on Cue PR #386 (14 Nov 2026 17:07Z), which arrived after 1.28.69 had
shipped. All are within Kiko's approved design for agent threads (14 Nov 2026 card 15:36:53Z, mockup 16:46:11Z; CUE-056). Built on
live 1.28.69 (Version 248), slot cue-1.28.70, card agent-kiko-replies. No Canvas change.

- `src/CueAgentDrafts.gs`, `src/Cue.gs`, `src/IndexThreads.html`: each message has one id, made once by the page and kept on the box
  when a send fails or Canvas answers "Not saved", so a retry at any later time is saved once in Canvas (1.28.69 used a 10-minute
  time window).
- Try again under "Not saved" resends that line's own message (`cueAgdRetry`), never Kiko's latest line in the thread.
- A Reply in the main chat on an agent's bubble no longer shows a false error after it was saved (the result now ends the send).
- A second reply on an update keeps a reply sent with 1.28.68, and uses Canvas's own reply list when it sends one.
- A card left on Sending by a run that died settles to Canvas's status once Canvas shows the reply.
- `docs/business-rules.md`: CUE-056 records the agent-thread rule. Tests AGR4 to AGR6 added, AGR1 to AGR3 and RB4 updated; 834/834 pass.
- Two more Codex findings on PR #388 fixed before merge: a "Not saved" answer keeps the id too, and a saved Try again frees it.
  Deploy Cue run 43623362296.

## Cue 1.28.69: Kiko's messages in an agent's thread reach the agent (LIVE as Version 248, 14 Nov 2026 17:21Z, rollback 247)

Asked: Kiko, 14 Nov 2026 08:44:34Z ("How do we go about agents cant read replies"), card 15:36:53Z "No, all goes to the agent"
(everything typed in an agent's thread goes to that agent; Cue never acts on it), mockup approved on the card at 16:46:11Z
("Approve, build it"). CanvasWorkspace ADR-0183 and rule R-AGD11. Built on live 1.28.68 (Version 247), slot cue-1.28.69, card
agent-kiko-replies. Needs Canvas V540 (live 14 Nov 2026 17:01Z) for the bridge action `agent_message`; the fixture is from V541 (live 17:12Z). Deploy Cue run 43620528551.

- `src/Cue.gs` and `src/CueAgentDrafts.gs`: a message typed in an agent's thread no longer goes to Cue's assistant. It is saved
  on Canvas for that agent (`agent_message`, one request id per message so a retry never saves twice) and the thread shows
  "Saved for <agent> · it reads it on its next run", or "Not saved: <why>." with Try again. Files are not sent to agents.
- `src/IndexCards.html`: an update card takes as many replies as Kiko sends and lists them under "Your replies".
- `src/IndexThreads.html`, `src/Index.html`, `src/IndexStyle.html`: the box in an agent's thread says "Message <agent>" with the
  note "Messages here go to <agent> only. Cue does not act on them. Ask Cue in the main chat."
- Bridge fixture refreshed from Canvas. Tests AGR1 to AGR3 and AGU5 updated; 831/831 pass.

## Cue 1.28.68: agents' handover updates in Cue, with Mark read and Reply (LIVE as Version 247, 13 Nov 2026 11:39Z, rollback 246)

Asked: Kiko, 13 Nov 2026 11:06:33Z ("can Cue also support general updates not just drafts"), "Updates plus replies" on the
project-chat card, spec 11:10:27Z (agent and project, handover reference, summary, gaps, next owner and action, AS acknowledgment
link, unique update key; "failed handovers should appear as Blocked, never Delivered"), card 11:15:52Z "Yes, no link means
Blocked" (CanvasWorkspace ADR-0180). Built on live 1.28.67 (Version 246), slot cue-1.28.68, card agent-handover-updates. Needs
Canvas V537 for the bridge action `agent_update` and the read and reply decisions.

- `src/CueAgentDrafts.gs`: unread handover updates from Canvas get a card in the agent's thread and a chat line ("X posted a
  handover update: REF · Delivered/Blocked"). Anything not exactly Delivered shows Blocked. `?agd=DRF-xxxx` opens the update.
- `src/IndexCards.html`: the update card shows Delivered or Blocked, Unread or Read, the facts, the AS link, Mark read and a Reply
  box (one reply).
- Bridge fixture refreshed from Canvas. Tests AGU1 to AGU5; 828/828 pass.

## Cue 1.28.67: agents' drafts wait for Kiko in Cue, one thread per agent (LIVE as Version 246, 13 Nov 2026 09:42Z, rollback 245)

Asked: Kiko, 13 Nov 2026 08:13:49Z ("they return a draft to me and then i approve"), 08:19:47Z (Edit then Send, Rewrite with
Cue, Send back to agent), 08:34:57Z (approved the two card screens; "can it show in Cue as a separate thread from each agent?"),
"Build it" on the spec at 08:45:56Z (CanvasWorkspace ADR-0177, docs/specs/agent-drafts.md). Built on live 1.28.66 (Version 245),
slot cue-1.28.67, card agent-email-drafts. Needs Canvas V535 (live 09:08Z) for the bridge actions `agent_drafts` and
`agent_draft_decide`.

- New `src/CueAgentDrafts.gs`: every 15 minutes (job "Agent drafts") and when Kiko opens Cue, Cue reads Canvas's open and recent
  agent drafts (read) and adds a card for each new waiting one, in one thread per agent named after the agent. No AI call.
- The email card: Send (after an optional Edit), Rewrite with Cue (Kiko's note, one AI call, nothing sent), Send back to agent
  (his note goes to the agent) and Reject. The requirements card: each requirement editable, Qty and Days, Save to Canvas; no
  Execution column, since Canvas's requirement lines have no such field.
- Kiko's tap goes to Canvas once (`agent_draft_decide`). Canvas re-checks the item is still due, sends through its own sender and
  records the result; Cue only shows it (Sent, Saved, Not sent, Failed with the reason, Sent back, Rejected). An RFP or
  accreditation chaser shows Sending until Kiko's Gmail sends it, then Sent with an Open in Gmail button.
- A refusal (a number in the text, Canvas busy) keeps the card waiting with the reason. A tap whose run died is offered again
  after 5 minutes; Canvas never sends a draft twice.
- test/fixtures/ZapBridge.gs refreshed from Canvas V535. Tests: 98-agent-drafts.js (AGD1 to AGD10); 823 pass.

## Cue 1.28.66: live clean-up: label names, payments due tomorrow, RFQ price leak, no RFQ to a kind of business (LIVE as Version 245, 13 Nov 2026 01:18Z, rollback 244)

Asked: Kiko chose "clean-up first" for the live Cue release order (CDT-Q8, 11 Nov 2026); the Account Manager set the scope
(1.28.43, 1.28.44, 1.28.46 and 1.28.49) in the release plan https://claude.ai/artifact/68BtA2ATTfVnsYtxWF59Xb. Release branch
cut from live Version 244 (5f84416), slot cue-1.28.66. Brand v2 (1.28.45) is left out: it was backed out of main (#378).

- 1.28.43: labels use the standard names and the crit pill (`tag crit` replaces `tag flag`); the live "Urgent" wording stays.
- 1.28.44: the morning report lists payments due tomorrow (`pay_day_due` from the Canvas bridge, already live in Canvas).
- 1.28.46: RFQ drafts leave out a price or rate written in a spec, the inquiry or a drawing (CUE-048, R2); the intake-real
  check tests R1 to R3 on real inquiries. It only reports; no block was added.
- 1.28.49: an RFQ goes only to a named supplier, never to a kind of business, and the card says when web research finds no
  suppliers (CUE-049, approved by Kiko 10 Nov 2026 04:16Z).

Tests: 813/813 (`node test/cue.test.js`; live 5f84416 runs 799).

Shipped 13 Nov 2026 from f62d612, which adds the version line (CUE_VERSION_ said Cue 1.28.51). Deploy Cue run 43343802855. QA CONDITIONAL PASS 01:16Z; Tech Lead approved under Rest Mode (Decisions row 234). PC66-01 to 03 are checked on the first live intake, PC66-04 on the Mon 16 Nov 8 AM update.

## Main only: back out Cue 1.28.45 brand v2.0 (not a release, not deployed)

Asked by the Cue Dev Team release plan (Account Manager, 11 Nov 2026, release L1 clean-up) after the UX Lead answered CDT-Q1 on 11 Nov 2026 15:34 UTC: back out the unshipped brand v2.0 change (DM Sans, Archivo Black, lavender ground, v2.0 band colours) and adopt DS-01 v1.0.0 later as its own scoped change with mockups Kiko approves. Brand v2.0 never went live; live Cue 1.28.65 (Version 244) still wears the Quicksand and Steagal look.

- Reverts #345 (commit 7b283c0) on main: fonts, ground colour, thread band colours, chaser email look, the extension bubble font, and the Brand lock and mockup-review skill text return to their pre-1.28.45 state. The later web-guidelines rules (tabular digits, reduced motion) and the label variant names stay.
- src/IndexStyle.html now matches the live release branch (claude/eloquent-heisenberg-t7ivt9 at 5f84416) byte for byte except the label variant names, which belong to the separate unshipped 1.28.43 label change.
- CUE_VERSION_ is left as it was on main; the version is stamped when a release is cut.

Test count: see the PR.

## Cue 1.28.65: the Claude roles' daily job runs (not deployed)

Found live on 11 Nov 2026 14:18Z, on the first daily run after 1.28.64: the Canvas PO row on Team Daily read "Did not run: Claude (Team daily): HTTP 400 invalid_request_error: output_config.format.schema: For 'array' type, property 'maxItems' is not supported".

- The daily job's answer schema no longer sets maxItems on the requests list; the code still keeps only the first 2 requests (src/CueInboxTeam.gs). The ChatGPT roles were not affected.

Test count: 826 passed (D3 new).

## Cue 1.28.64: the AI team runs without Kiko: daily role jobs, the Account Manager decides last, a BSE AI Team spreadsheet; the Inbox page is removed (not deployed)

Kiko, 11 Nov 2026: "the goal is for things to run without me", "now are you gonna do what i want?".

- Kiko, 11 Nov 2026: "do not include me in any step", "okay lets do that", "do it in a new spreadsheet". Every Confirm and access request goes to the Tech Lead, then the Account Manager, whose answer can only be Approve or Reject (final). Daily jobs (src/CueInboxTeam.gs): after 08:00 Manila each role reads a small piece of real data (Canvas board, failed Cue jobs, decisions), writes a note on Team Daily and may ask other roles up to 2 things. The team's tabs (Team Requests, Team Daily, For Kiko) live in a new spreadsheet "BSE AI Team" that Cue makes in Kiko's Drive; Team Requests rows carry the answer. Rule CUE-054.
- The Inbox page, its ?view=inbox route and the "Inbox ↗" header button are removed (Kiko, 11 Nov 2026: "remove inbox already!!!", "it doesnt service its purpose"). The role chats, routing and sheet tabs stay; cueResume keeps project chats in step with Canvas (src/Inbox.html deleted; src/Cue.gs, src/Index.html, src/IndexPages.html).
- New tab Team Requests in the Cue sheet. A Claude chat or session with Kiko's Google Sheets connector appends one row (Request ID, Chat, Kind, Tool, Message, From). Every 5 minutes cueResume sends each new row exactly as the Inbox page would (same checks, same 3-minute pause, same role-chat routing), marks it Sent with the Message ID, or Refused with the reason. At most 5 rows per run (src/CueInboxAgents.gs, src/Cue.gs).
- cueInboxSend_ splits into the owner check and cueInboxSendCore_, which the intake also uses; a message from an agent shows "agent: <name>" as its sender (src/CueInbox.gs).
- No new web door: Cue's web app stays open to Kiko's Google account only.

- Codex review fixes before the first deploy: each request is claimed one at a time (State Sending, written under the lock) right before it is sent, so overlapping runs never send one twice and a run that dies strands only the row in flight; a chat name matching more than one chat is refused with the Chat IDs, and Chat accepts a Chat ID; rule CUE-052 recorded in docs/business-rules.md.

- For Kiko tab (Kiko: "add another tab and those are all the things that require Kiko"): every 5 minutes Cue lists each Confirm or access request the role chats did not settle; agents may add their own rows; Kiko types Approve, Reject or a reply in Your answer and Cue records it (cueForKikoSync_, rule CUE-053).

- Codex review fixes on the For Kiko tab: only a whole "Approve" or "Reject" counts as a decision; the message is re-read under the lock right before the answer is recorded, so a decision made on the Inbox page meanwhile is kept (the page's Approve and Reject now take the same lock); a paused agent Question goes straight back to New.

- More Codex fixes: "Reject" is accepted (not only "Rejected"); the sync writes only the State and Note cells, so an answer Kiko types meanwhile is kept; the whole For Kiko sync runs under the lock, so no item is added twice.

- Closed tab (Kiko, 11 Nov 2026: "add another tab - automatically moves items that are Closed to that tab"): every 5 minutes Cue moves finished rows from Team Requests (Sent, once the answer is in, or Refused) and For Kiko (Done or Answered) to a Closed tab in BSE AI Team, keeping ID, answer, note and Message ID. A decision that arrives after sending is copied onto the row before it moves. Team Requests waits while a row is Sending (cueTeamClose_, src/CueInboxAgents.gs; rule CUE-055).

- Codex review fixes: cueResume makes the seven role chats once (they were made only by the removed page); daily jobs are claimed under the lock before their AI call; the Cue PO and QA jobs read all of the last 24 hours of Job Runs; cueSetup no longer makes the team tabs in the Cue sheet; For Kiko keeps the full request text and treats an answer of 0 as an answer.

Test count: 825 passed (A1 to A12, K1 to K7, D1, D2, CL1 to CL6 new; R5, R6 rewritten; page tests T13, T24, P7, R14 to R17 removed with the page).

## Cue 1.28.63: a hidden Cue tab stops refreshing (live as Version 242, 11 Nov 2026 13:25Z, rollback 241)

Kiko, 11 Nov 2026: "i keep getting an error that there are too many scripts running for this uesr", then "A" to pausing refreshes in tabs he is not looking at.

- The Cue page refreshes every 20 seconds (2 while a task works), and each refresh is one Apps Script run. Google allows about 30 at once per account, across Cue and Canvas. A hidden tab now schedules no refresh; showing it refreshes at once (src/IndexThreads.html). Work Cue does in the background is unchanged (cueResume every 5 minutes).

Test count: 805 passed (R18 new).

## Cue 1.28.62: the 3-minute pause holds across two tabs; rule CUE-051 recorded (live as Version 241, 11 Nov 2026 13:17Z, rollback 240)

Codex review on Cue PR #372 (two findings, both confirmed).

- The pause check and the new message row are one locked step (cueLocked_), so two tabs sending at the same moment cannot both pass the pause. The lock is released before any AI call (src/CueInbox.gs).
- docs/business-rules.md gains CUE-051 (Send at once, 3-minute pause per chat), which supersedes D2.

Test count: T26 new.

## Cue 1.28.61: Send sends a Question at once, then a 3-minute pause per chat (live as Version 241 with 1.28.62, 11 Nov 2026 13:17Z, rollback 240)

Kiko, 11 Nov 2026: "maybe lets not do a countdown... let the user press send", then on the choice of A (2 minutes after Send), B (at once) or C (30 seconds): "lets do B but lets pause so that theres not constant mesasging may 3 minutes before it can send again". Replaces the 2-minute countdown (D2).

- Send on a Question sends it at once. Then that chat takes no new Question for 3 minutes; the Send button reads "Next Question in m:ss" and is greyed out. The server refuses an early one with the seconds left (src/CueInbox.gs, src/Inbox.html).
- The pause is per chat. Confirm and Request access are not paused.
- The countdown line and its Cancel button are removed from the page. The queue functions and the every-minute sweep stay, so any Question queued before this release still sends.

- The every-minute inbox trigger is removed again (trigger version 8 deletes it on live): Kiko hit Google's "There are too many scripts running simultaneously for this Google user account" limit right after 1.28.60 turned it on. Nothing waits to send any more; the 5-minute cueResume runs the inbox sweep for anything still queued (src/Cue.gs).
- The Inbox page makes one server call at a time when it loads (the list, then the decisions).

Test count: 803 passed (T22, T23, T24 rewritten, T25 new, R9 steps past the pause; trigger lists in tests 02 and 32 updated).

## Cue 1.28.60: the Question countdown sends again (bug fix) (live as Version 240 with 1.28.59, 11 Nov 2026 12:52Z, rollback 239)

Kiko, 11 Nov 2026: "the countdown stopped...". Cause: 1.28.53 added the every-minute inbox sweep to cueTriggers_ but did not raise CUE_TRIGGERS_NOW_, so live Cue (already on trigger version 6) never installed it, and a Question whose 2-minute countdown ended stayed Queued.

- CUE_TRIGGERS_NOW_ goes from 6 to 7. The next cueResume run (every 5 minutes) or opening Cue installs cueInboxSweep; its first run sends every Question already past its countdown (src/Cue.gs).

Test count: 801 passed (T23 new; BD9 expects version 7).

## Cue 1.28.59: Add a chat no longer offers claude.ai (live as Version 240, 11 Nov 2026 12:52Z, rollback 239)

Kiko, 11 Nov 2026: "can you remove that option so iit wont be confusing". A claude.ai chat cannot be reached from Cue, so its messages never get an answer.

- The Add a chat form offers Claude API (first) and ChatGPT API only; the read-token note is replaced by one line saying both answer inside Cue. Chats already set up keep working (src/Inbox.html).

Test count: 800 passed (R17 new).

## Cue 1.28.58: filter for the Inbox chat list (live as Version 239, 11 Nov 2026)

Kiko, 11 Nov 2026: "how come eveb project chats are showing here", then "maybe have a filter?".

- The Chats list on the Inbox page has Show (All, Roles, Projects, Other) and Find (by chat or project name). The Show choice is remembered in this browser only. A filter that matches nothing says so (src/Inbox.html).

Test count: 799 passed (R16 new).

## Cue 1.28.57: Inbox link in Cue's header (live as Version 238, 11 Nov 2026 12:36Z, rollback 237)

Kiko, 11 Nov 2026: "where do i see it", then "A" to adding an Inbox link to Cue's menu.

- Cue's header shows "Inbox ↗" next to the settings button. It opens the team inbox (?view=inbox) in a new tab, the same way the avatar opens Cue Admin (src/Index.html, src/IndexPages.html).

Test count: 798 passed (R15 new).

## Cue 1.28.56: team inbox fixes from the Codex review of 1.28.55 (live as Version 237, 11 Nov 2026 12:30Z, rollback 236)

Codex review on Cue PR #366 (three findings, checked against the code and confirmed). Fixes to the design Kiko approved on 11 Nov 2026; no new rule.

- Each role chat is told its own name, so Cue PO, Charter PO, Canvas PO and Chase PO know which product they own. Before, the four sent identical prompts.
- A decision Kiko makes while a role chat is still answering is kept; the late role answer no longer overwrites it.
- The chat list counts Contested messages in Waiting.

Test count: 797 passed (R12 to R14 new).

## Cue 1.28.55: role chats decide Confirms and Google Drive requests in the team inbox (live as Version 236, 11 Nov 2026 12:25Z, rollback 235)

Kiko, 11 Nov 2026 evening: the roles are chats ("they are chats as well. Tech Lead is BSE Apps & Systems", "Account Manager is ChatGPT Account Manager chat", PO and QA chats "Cue PO, Charter PO, Canvas PO, Chase PO, QA"); Tech Lead approves "google drive. then let me approve others"; "yes" to the routing (Tech Lead, then Account Manager on Escalate, then Kiko); "A" to running the Claude roles inside Cue on the Claude API, because a claude.ai chat cannot be reached from Cue. Decisions D3 to D5 in CanvasWorkspace docs/specs/team-inbox-design.md section 14.

- Seven role chats are made on first open of the Inbox page (src/CueInboxRoles.gs): BSE Apps & Systems (Tech Lead), Cue PO, Charter PO, Canvas PO, Chase PO and QA on the Claude API, and ChatGPT Account Manager on the ChatGPT API. Each answers with its written role instructions (CUE_INBOX_ROLE_TEXT_), which Kiko approves before this release goes live.
- A Confirm goes to the Tech Lead: Approve or Reject is final and recorded with who decided and why. Escalate sends it to the Account Manager; a second Escalate marks it Contested and it waits for Kiko. A failed call leaves it Waiting with the reason; Kiko can still decide.
- Request access now names its tool. Google Drive goes to the Tech Lead (its Escalate makes it Contested); any other tool waits for Kiko with no AI call.
- Questions to a Claude API chat are answered by one Claude call with the chat's last six answers as context, from Send or the 2-minute countdown.
- Nothing runs on a decision (scope Q3 B). No Canvas call. At most two AI calls per Confirm.
- New columns: Inbox Chats Role; Inbox Messages Tool, Decided by, Reason. The page shows role tags, the Tool picker, who decided and why, Contested in red, and which message the Approve and Reject buttons apply to.

Test count: 794 passed (R1 to R11 new in test/features/96-inbox-roles.js; P5, P6 and T14 updated).

## Cue 1.28.54: project chats, Request access and the decisions log in the team inbox (live as Version 235, 11 Nov 2026 12:11Z, rollback 234)

Kiko, 11 Nov 2026: "Project Chats" (19:33 Manila, CanvasWorkspace docs/specs/team-inbox-design.md section 15); D4 "Tech Lead should be able to approve request access as well" then "A"; D6 "feel free to show me decisions made so i can review when available" (section 14). Asked again 11 Nov 2026 evening: "continue doing the Team Inbox i need it asap".

- Project chats: each open Canvas project (board phase Initiation, Planning, Execution or Closure) gets its own ChatGPT API chat, made from the Canvas project board through the existing read-only bridge action `get_project_board`. No new Canvas action, no Canvas write and no Canvas release. A project that is Complete, On Hold, Cancelled or Not Awarded makes no chat, and its chat is retired (messages stay). The label follows the project's name. The read runs when the Inbox page opens (at most every 10 minutes) or on Refresh projects; a failed read changes nothing and the page says so (src/CueInboxProjects.gs).
- Request access is a third message kind. It is saved New, calls no AI, and Kiko approves or rejects it like a Confirm. Nothing runs on either. The Tech Lead routing in D3, D4 and D5 waits for the team roster and team sign-in (S7, held).
- Decisions table on the Inbox page: every Approve and Reject, newest first, read only, with time, chat, kind, decision, who and the start of the message (cueInboxDecisions_). Inbox Decisions gains Decided by and Kind; Inbox Chats gains Project ID.
- The page no longer scrolls sideways at phone width (checked at 375 and 1280).
- Built on main after 1.28.53 (live Version 234).

Test count: 783 passed (P1 to P7 new in test/features/95-inbox-projects.js; T8 and T14 updated).

## Cue 1.28.53: inbox countdown, Cancel, Questions sent by Cue (not deployed)

Kiko, 11 Nov 2026 (decisions D1 to D6 in CanvasWorkspace docs/specs/team-inbox-design.md section 14; "build it" and "go" in chat, 19:31 Manila). The usage rule line in CLAUDE.md was removed (Kiko: "the 30 USD ... not applicable anymore").

- A Question is queued when its text is filled in. It sends 2 minutes later. Cancel stops it. Editing restarts the countdown. Send stays for Confirm only (src/CueInbox.gs cueInboxQueue_, cueInboxCancel_, cueInboxSweep_; src/Inbox.html).
- New time trigger cueInboxSweep, every minute, installed by cueTriggers_ (src/Cue.gs). Two existing tests now expect it in the trigger list (test 02, test 32).
- New sheet tab Inbox Queue (Message ID, Send at, State).
- Not in this release: project-based chats (need a Canvas bridge action and a Canvas release), Tech Lead and Account Manager routing (need the team roster and team sign-in), request-access kind, decisions log page.

Test count: 776 passed (T15 to T22 new in test/features/94-inbox-countdown.js).

## Cue 1.28.52: team inbox (not deployed)

Kiko, 11 Nov 2026 (design approved in CanvasWorkspace docs/specs/team-inbox-design.md, section 12; scope answers a, b, a, a; screens approved 17:29 Manila). Requested "continue until its built".

- New Inbox page (?view=inbox, src/Inbox.html): every chat in one list, the messages of the chosen chat, Question or Confirm to send, Approve or Reject on a Confirm.
- ChatGPT API chats: a Question is answered by one OpenAI Responses call (src/CueInbox.gs, cueInboxAsk_), the answer stored as the reply; retry is one call (cueAiAll_). Replies continue the chat's thread through previous_response_id.
- claude.ai chats: a Question is saved and waits. The claude.ai pull endpoint is NOT built (held until Kiko approves its access, design section 6). Test T12 checks it is absent.
- Confirm messages only record Approve or Reject (Inbox Decisions tab). Nothing runs (scope Q3 B).
- New sheet tabs: Inbox Chats, Inbox Messages, Inbox Decisions. Messages over 4,000 characters are refused, not cut. Open messages older than 7 days show Expired.
- No Canvas bridge call and no Canvas write (test T11). Every function is owner only (test T10).
- Tests: test/features/93-team-inbox.js (T1 to T14). Full suite: node test/cue.test.js, 768/768 passed.
- Not done in this release: S7 Google sign-in (held), claude.ai pull endpoint (held), brand check run in a browser on the live Apps Script page (gap: the page is only checked as a file in the repo; see the PR body).
- Feature Board card "team-inbox" still to be created by Kiko (the board is public and cannot be written from here).

## Cue 1.28.51: a chat line for each new Canvas bug report (not deployed)

Kiko, 7 Nov 2026 11:47Z asked for a Report a bug function in Canvas; 11:59Z "3. can be thru Cue" (Kiko hears about each report
through Cue); "build" 13:11Z; "Deploy" 10 Nov 2026 04:08Z. Canvas side live as main V523 (10 Nov 2026 05:53:55Z). Release branch
= live 1.28.50 (claude/project-thread-c8aunt-rel12850) plus this change only; built and tested as 1.28.49 in Cue PR #350, which
never shipped.

- New background job "Service Desk reports" (src/CueServiceDesk.gs, every 15 minutes): reads Canvas's read-only bridge action
  `service_desk_new` and posts one Cue chat line per new report: who sent it, the page, the project, the first 300 characters,
  whether a picture came with it, and an Open in Service Desk button. Check versions skip it.
- `CUE_CHECK_READS_` lists `service_desk_new`; `test/fixtures/ZapBridge.gs` refreshed from live Canvas V523.
- Tests SD1 to SD3 (test/features/89-service-desk.js).

## Cue 1.28.50: fixed-width digits, reduced motion and the Urgent tag (not deployed)

Kiko, 8 Nov 2026 06:31Z, "fix them", after the live web-guidelines check of Cue on KKD; 10 Nov 2026 04:07Z he picked
"Ship what's built now". Release branch = live 1.28.47 (claude/project-thread-h0rk83-rel12847) plus this change only.

- Tables and tags use fixed-width digits (`font-variant-numeric: tabular-nums`) so amounts and counts line up.
- Motion stops when the system asks for reduced motion (`prefers-reduced-motion: reduce`).
- The urgent tag on Morning batch lines reads "Urgent", matching the Canvas pill casing.
- Tests: UR9 added, A6d updated. 724/724 pass on the release branch.

## Cue 1.28.47: Message on FB from Canvas sends a paper again on Messenger (not deployed)

Kiko, 7 Nov 2026 10:55Z to 10:59Z (Canvas Resources › FSA and AR as status plus a ⋯ menu with "Message on FB"; mock-up approved
10:59:58Z, "build" 15:23Z). Canvas side: CanvasWorkspace `src/DocMenu.gs` and `zbMsgrDue_` (msgr_due now lists `now_at`), live as Canvas V511.
Release branch claude/project-thread-h0rk83-rel12847 = live 1.28.42 (16bd3cb) plus this change only; 1.28.43 to 1.28.46 stay on
main, not deployed, so they are not shipped here.

- `cueMsgrRun_`: a paper Canvas lists with `now_at` (staff tapped Message on FB) goes out on the next Messenger tick even when it
  went on Messenger before. The 24-hour window rule is unchanged: outside it, the paper is skipped as before.
- The msgr_mark for such a send has its own request id (`msgr:<doc>:<id>:<now_at>`), so the bridge runs it again and Canvas clears
  the ask.
- Tests: `test/features/91-msgr-now.js` (MN1 to MN3). 735 tests pass.

## Cue 1.28.42: Messenger papers show page 1 with a View and sign button; payment notices get a View details button (live as Version 223, 6 Nov 2026 08:57:59Z, rollback 222)

Kiko, 6 Nov 2026 08:27Z, after their own FSA landed as a long link: "Can it show an image instead of a link? Or the FSA
viewer?" Kiko saw the mockup (https://claude.ai/artifact/GUJFRMhFhL2HvjPZ8nuNcB) and picked "Picture of page 1 + button",
which came with its fallback: when Cue can't make the picture, it sends the button card so the paper still goes out. Then,
08:33Z: "Can we do that kind of button all the time?"

- Each unsigned FSA or AR on Messenger is now a short line ("Ana, your FSA for ... is ready to sign. The link works for 30
  days. It's also in your email."), then a picture of page 1 with a "View and sign FSA" (or AR) button that opens the paper's
  own sign link. The picture comes from Canvas (new bridge read msgr_doc_image, Canvas V489) and is uploaded to Meta once
  per send.
- No picture (Canvas says no, Canvas is busy, the type is wrong, or Meta refuses the upload or the picture card): one card
  with the paper's name, the same line and the same button. The paper is marked sent once either way.
- Payment notices sent as a normal reply: a notice that ends with a link now goes as the words plus a "View details" button;
  one without a link stays plain text. Utility-template sends are unchanged.
- Any Messenger button whose target is an https link opens that page; other buttons stay taps (postbacks) as before.
- Removed the unused cueMsgrText_ (the old one-line text with the link in it).
- test/fixtures/ZapBridge.gs refreshed from Canvas (msgr_doc_image). The version string also moves past 1.28.41, which
  shipped without bumping it.

Tests: 720/720 (`node test/cue.test.js`); new MS7b to MS7e and PM7, MS2 to MS4 and PM1 updated.

## Cue 1.28.41: Chasers group tabs stay on the page (live as Version 222, 6 Nov 2026 05:09Z, rollback 221)

Kiko, 6 Nov 2026 04:44Z, with a screenshot: tapping a tab under Admin, Automation Settings, Chasers opened a blank window at the
Apps Script sandbox address (userCodeAppPanel?createOAuthDialog=true#chm-suppliers). Built on live 1.28.40 (Version 221). No Canvas
release needed: Canvas Admin shows this Cue page in a frame.

- Cause: the Clients, Suppliers, Crew and All chasers tabs were plain #chm-... links, and the Cue page sets <base target="_top">, so
  each tap sent the whole window to the frame's own sandbox address instead of scrolling.
- Fix: the tabs carry data-chm-jump; the Chasers click handler stops the link and scrolls to that group in place.
- Checked the other in-page links in Cue and Canvas (#-links in IndexCards, IndexPages, Canvas.html, BusinessInfo.html): each
  already stops the link or sets target="_self". Only the Chasers tabs were broken.
- Tests: AG-JUMP added; 715/715 pass. A Playwright check of a framed page with <base target="_top"> reproduced the blank-window
  jump with the old link and showed the fixed tab scrolling in place.

## Cue 1.28.40: crew linked on Messenger get their papers (last-message time fixed) (live as Version 221, 6 Nov 2026 04:34Z, rollback 220)

Kiko, 6 Nov 2026 03:30Z, with a screenshot of their own BSE chat: linked through "I'm crew" and the code at 00:28 Manila, yet their
waiting King's Day FSA never came on Messenger. 03:31Z: "Please check if this would happen to others too". Built on live 1.28.39
(Version 220). No Canvas release needed.

- Cause: the code link and staff Link wrote the Messenger ID in Canvas but never "Last Messenger message". Cue sends papers only
  inside Meta's 24-hour window from that time, so every crew member linked that way was skipped, and Canvas sent their payment
  notices by SMS. On 6 Nov all 10 linked crew had no time, with about 13 FSAs waiting among 9 of them.
- The code link now saves the time of the code they typed. Staff Link saves the time of the person's own last message, not Cue's
  "you're linked" message (Messenger People tab too).
- When Canvas has no time, Cue uses its Messenger People time. If Meta takes the message, Cue copies that time to Canvas once. If Meta
  says it is outside its window, the document is skipped (not a failure) and not tried again until the person messages again.
- Tests: `test/features/88-msgr-last.js` (ML1 to ML5). 714 of 714 pass.

## Cue 1.28.39: King's Day crew who messaged before tapping "I'm crew" go on Canvas's Link list (live as Version 220, 6 Nov 2026 02:45Z, rollback 219)

Kiko, 6 Nov 2026 02:04Z, with screenshots of the King's Day crew Messenger lines: "these people messaged this what i want you to
rtestore"; 02:05Z "i cant find whjere to approve or link them"; 02:05Z picked "Add to Canvas list, you tap Link" (nobody is messaged).
Needs Canvas V483 (bridge action `crew_wait`). Built on live 1.28.38 (Version 219).

- Canvas's Link list (Freelancers page, the project's Communication Config) only showed people who tapped "I'm crew" and then typed
  their details. Of the 11 King's Day crew who wrote on 6 Nov, 9 never tapped, so there was nothing to link.
- Once, from the background resume, Cue sends each such person's saved first message to Canvas's `crew_wait`. Canvas lists them
  ("To link" with Link ready, or "No match" to pick the person) and sends no code. People who name no live event are not listed.
  Cue posts one line in the main chat with the names. Nothing is sent on Messenger. A refusal (Canvas V483 not live yet) is tried
  again on the next resume; when every call has gone through it never runs again (`CUE_CREW_RESTORE_DONE`).
- `test/fixtures/ZapBridge.gs` refreshed from Canvas V483. Tests: `test/features/87-crew-restore.js` (CRW1, CRW2). 709 of 709 pass.

## Cue 1.28.38: Admin › Auto-Send shows each journey and the messages sent at each step (LIVE Version 219, 6 Nov 2026 01:57Z, rollback 218)

Kiko, 5 Nov 2026 16:55Z: "Auto-Send - should contain all the communications that are automatically sent either mail, sms, fb - should
show the customer journey and show communication per stage". Mockup https://claude.ai/artifact/2bL1ZBzGqZgV3Ct9iFSMHq; Kiko "yes"
6 Nov 2026 01:28Z. Built on 1.28.37 (live Version 218, CRM #337 head 0ba4f7a).

- Cue Admin › Auto-Send (also shown in Canvas Admin › Automation Setting › Auto-Send) now has four journeys: Clients, Crew,
  Suppliers and Team, each with a count. A journey shows its steps in order (the Templates codes, for example R1 to R8) and, per step,
  each message that goes out with no tap: what it is, when it goes, the channels (Email, Text, Messenger, App notice), who sends it,
  and a Template button that opens Templates on that message.
- Counts: Clients 0 (client emails always wait for a tap), Crew 8, Suppliers 1, Team 4. The mockup showed Team 3; Status changed and
  Supplier awarded are two templates (T3, T4), so they are two rows.
- Crew papers and payment texts show Messenger, because Cue sends them there when the person is linked (1.28.36), with SMS as backup.
- Removed: the old Auto-send cards with Canvas's built-in wording and the "Off for every kind of email" note. The words are in
  Templates, which reads the BSE Message Templates doc.
- Read only. No AI call, no server call. Tests: 707 pass (4 new: `test/features/86-auto-send.js`; AD7 updated).
## Cue 1.28.37: bid-lead resends stop in time, so a busy Canvas can never cut a run short (BUG FIX, LIVE Version 218, 6 Nov 2026 01:56Z, rollback Version 217)

Codex review on PR #336 (6 Nov 2026 01:26Z), after 1.28.35 went live as Version 216. Built on live 1.28.36 (Version 217, main e0a241d).

- With Canvas busy for its full 20-second lock wait on every call, 20 leads over 3 tries could run past Apps Script's 6-minute limit, and
  the run would end before saving which leads were still open. `cueBridgeWaves_` now starts no new wave after 150 seconds; the leads not
  sent stay open and the next bid check sends them.
- The one-time recovery of the three old bid checks starts no new old run after 2 minutes. A resume at least 10 minutes later sends the
  rest, and when nothing is left it marks itself done (`CUE_BIDS_LEAD_BACKLOG_DONE`).
- Rule written up as CUE-046 in `docs/business-rules.md`.
- Tests: LR8 and LR9 new in `test/features/86-bid-lead-retry.js` (LR8 fails on 1.28.35). 703 of 703 pass.

## Cue 1.28.36: payment notices by Messenger, SMS backup; staff-link message sent once (LIVE Version 217, 6 Nov 2026 01:26Z, rollback 216)

Kiko, 6 Nov 2026 00:49Z: "Can you switch all payments related notifications to facebook messenger instead rather than sms". At 01:00Z
Kiko chose "Yes, SMS backup" on the decision card (rule R-PMN-1). Ships with the Canvas release of the same change (CanvasWorkspace
branch `claude/project-thread-uzsang`, `src/PayMessenger.gs`). Built on 1.28.35 (`claude/project-thread-tqdh8x`, 5948a17).

- Every Messenger tick (Job Runs "Messenger sign links", every 15 minutes, only with `MSGR_PAGE_TOKEN` set) Cue first collects the payment
  texts Canvas held for people linked on Messenger (bridge `msgr_pay_due`), sends each on Messenger and reports it back
  (`msgr_pay_mark`). A message Meta refuses is reported with Meta's reason, and Canvas texts it by SMS at once.
- With the Script Property `MSGR_PAY_TEMPLATE` set to an approved Meta utility template (one body variable), the text goes as a utility
  message, which Meta delivers outside the 24-hour window. Without it the text goes as a normal reply, which Meta accepts only within 24
  hours of the person's last message.
- A message Meta took whose report did not reach Canvas is remembered, and only the report is retried: nobody gets it twice.
- Fix (Codex review of 1.28.30): when Meta accepted the "linked" or "not linked" message after a staff Link or Not mine but `msgr_told`
  failed, the next tick sent it again and added a second Messenger People row and chat. Cue now remembers the told person
  (`CUE_MSGR_TOLD_<psid>:<status>`) and retries only `msgr_told`, with the same request id.
- No AI call. `test/fixtures/ZapBridge.gs` gains `msgr_pay_due` and `msgr_pay_mark`. Tests: 693 pass (8 new: `test/features/85-pay-messenger.js`, MS20b).

## Cue 1.28.35: bid leads that Canvas was too busy to save are sent again, and the 15 lost leads are recovered (BUG FIX, LIVE Version 216, 6 Nov 2026 01:23Z, rollback Version 215)

Coordinator, 6 Nov 2026 00:55Z: Cue's bid-lead scans lost crm_lead saves to "Another save is in progress" (ledger 4 Nov 23:01Z and 5 Nov
22:51Z). Kiko, 01:07Z: "See why is it so slow. Recover those coz i cant ask them to do it again!!@!", and at 01:07Z: "We cant produce
poor codes like this! What if those are clients lost?" Built on live Cue 1.28.34 (Version 215, branch claude/project-thread-sg8h1y, 16ee7a3).

What happened: Cue sent every new bid lead to Canvas at once (13 on 5 and 6 Nov). Canvas saves one thing at a time and each request waits
at most 20 s for its turn, so the later ones failed. Checked against the ledger and the CRM Deals tab: 15 leads never reached the CRM
(2 from the 30 Oct check, when the CRM Deals tab was being created, 6 from 5 Nov, 7 from 6 Nov). The 2 ledger rows stuck at Claimed
(5 Nov :1 and :2) did save their deals (D-MW2Q19MWVA4, D-MW2Q1BTCZ5S); only their outcome was not written. No client contact was lost:
the leads are public PhilGEPS and CITEM notices, and every one is still in Cue's stored run.

- Bridge writes of a claimed plan now go 3 at a time (`cueBridgeWaves_`, CueBridge.gs), and a busy answer ("Another save is in
  progress", "busy, retry later", "in progress", no answer) is sent again with the same command_id after 5 s, up to 3 tries. Canvas
  reruns a Rejected or never-claimed command and replays a finished one, and crmLead_ returns the deal a request_id already made, so a
  repeat never makes a second lead. Bid leads and the hourly client email log both use it.
- A lead still not saved stays on its run (`bids.leads.open`, with the task in `bids.leads.task`). The next bid check sends it as a
  Canvas recovery task (`<task>-recovery-1`, `recovers: <task>`), which supersedes the old plan, so its stuck Claimed rows can never
  write again. One earlier run per check, at most 3 times per run. The card says how many leads were added.
- Once, on the first background run after this ships, the 30 Oct, 5 Nov and 6 Nov checks are recovered under their ledger tasks
  (`bidlead-mvu5wz5e`, `bidlead-mw2q0m92`, `bidlead-mw453v1z`). Every lead of each run is sent again; the ones already in the CRM come
  back as the same deal and are not counted. Each run's thread gets one line ("Added to Canvas CRM: N leads ..."). A dry run on the real
  stored runs and ledger adds exactly 15 deals (2, 6, 7) and no duplicate.
- Tests: `test/features/86-bid-lead-retry.js` (LR1 to LR7). 693 of 693 pass.
## Cue 1.28.34: Chasers page keeps unsaved timing, and Final reminder opens where you tap it (BUG FIX, LIVE as Version 215, 6 Nov 2026 01:16Z; rollback Version 214)

Who found it: Codex review on PR #333, 6 Nov 2026 01:10Z, after 1.28.33 went live. Both faults are in the merged Chasers page
Kiko approved on 5 Nov ("approved" 17:19Z); this release ships under the same deploy yes (6 Nov 2026 01:00Z "Yea").

- Timing typed or an On box changed and not yet saved is no longer wiped when you open a chaser to read its template, or
  when the send-now list finishes loading. Save rules still sends only what changed.
- Final reminder sits under Suppliers and under Crew. Tapping it under Crew now opens the send-now list under Crew, not
  under Suppliers.
- Checked in a browser against stub data: before the fix the typed values went back (3, on, 9) and the list opened under
  Suppliers; after it they stay (9, off, 10) and the list opens under Crew.
- Tests: AG7 new in `test/features/85-admin-groups.js`. 686 of 686 pass.

## Cue 1.28.33: For Approval moves into Cue Admin; Chasers and Chaser rules are one page (LIVE as Version 214, 6 Nov 2026 01:07Z; rollback Version 213)

Built as 1.28.23 on 5 Nov; rebuilt on live 1.28.32 (branch claude/project-thread-lda4e2, cd77399) on 6 Nov 2026 after Kiko's deploy yes ("Yea", 01:00Z). A first 1.28.33 deploy on 1.28.30 (01:03Z) was replaced a minute later by the 1.28.32 deploy, so this one carries both.

Kiko, 5 Nov 2026 16:40Z, "Reorganize Admin Page": "AI Usage and Cost to Admin > System Config, Connections to API Keys" and "The For
Approval move the to Cue". On the decision card at 16:43Z he picked "Show Canvas's list in Cue" over moving it through the bridge.
Ships with the Canvas release of the same change (CanvasWorkspace PR on branch `claude/project-thread-sg8h1y`).

- Cue Admin has a new first group, Approvals › For Approval. It shows Canvas's own For Approval page in a frame
  (`?open=approvals&bare=1` on `CUE_CANVAS_URL`), so Canvas still checks Kiko's sign-in and does every Approve and Reject. Cue reads and
  writes nothing for it; `cueSettings` only adds the address (`canvas_approvals_url`, empty when `CUE_CANVAS_URL` is not a Canvas address).
- `?view=admin&sec=<section>&bare=1` opens one Cue Admin section alone, with no title bar or section list. Canvas Admin uses it for
  System Config › AI Usage and Cost (`sec=usage`), API Keys › Connections (`sec=conn`), and Automation Setting › Chasers
  (`jobchasers`), Auto-Send (`auto`) and Templates (`templates`) (Kiko 16:55Z). Those three stay in Cue Admin too. Only a section that exists can be opened.
- The System group (Connections, AI usage and cost) is hidden from Cue Admin's own list because it now shows in Canvas Admin. The sections
  and their code are unchanged.
- Chasers and Chaser rules are one page, Jobs › Chasers (Kiko 17:06Z "Can we merge Chasers and Chaser Rules? Group them first based
  on target receiver"; mockup approved 17:19Z "approved"). Every chaser, Cue's and Canvas's, is grouped under Clients, Suppliers or Crew,
  with its timing (first after, then every, stop after, on) on its row and the settings for all chasers, with Save rules, at the bottom.
  A Cue chaser opens to its template; a Canvas chaser opens to its send-now list. Final reminder goes to suppliers and crew, so it is
  listed under both. The timing boxes are the same ones Chaser rules had and save the same way; no chaser, rule or send changes. The
  Chaser rules item is gone from the list, and an old `sec=chasers` link opens Chasers.
- A section opened alone for Canvas hides its own title, because Canvas shows the title above the frame (brand check, 5 Nov).
- Tests: `test/features/85-admin-groups.js` (AG1 to AG6); AD4 and UG5 updated for the new list. 685 of 685 pass.

## Cue 1.28.32: one Messenger person is one line in the main chat (BUG FIX, not deployed)

Kiko asked on 5 Nov 2026 at 13:07Z: "Also why am i still getting 1 notif per message? I raised this yesterday", then at 13:08Z
"why do i get 1 notif per messatge", with screenshots of the main chat showing a new line for each Messenger step from the same
person. Built on 1.28.30 (Version 211); shipped stacked on 1.28.31.

- The first "Messenger: new message from someone not linked as crew" line becomes the pointer to the person's chat when they tap
  I'm crew or Client or inquiry, so the main chat shows that one line with the chat's row (replies, Needs you) under it, updated in
  place. The tap line now shows only inside the chat.
- The later steps post in the person's chat, which turns Needs you, instead of as new main-chat lines: "sent their details", "has no
  mobile or email on file" and "typed 3 wrong codes".
- Nothing changes in how anything looks, and there is no AI call. Tests: 679 with 1.28.31 (MS21 is new; MS10j, MS10l and MS17 to MS19 now check the person's chat).

## Cue 1.28.31: Messenger chats no longer show as "Project intake" (not deployed)

Who asked and when: Kiko, 5 Nov 2026 13:08Z, "why are these in intake?", with screenshots of Messenger crew chats titled
"Project intake" and showing "Project intake stopped" with Try again and Reject.

What changed: the page had no entry for Messenger chats (kind `msgr`), so it fell back to the intake's name and its
"stopped" card. A Messenger chat is now named by its own line ("Messenger · name · Crew, not linked yet") in the thread list
and Waiting on you, and shows no card, only the conversation. Nothing ever ran intake on these chats: Try again only answered
"Only a request that stopped before Canvas can be tried again here." The finished-task summary line names them the same way.
The existing chats are fixed by the same change, since they already carry kind `msgr`. Bug fix.

Tests: 678 of 678 (new MS23).

## Cue 1.28.30: Messenger crew are matched and linked by code; taps are answered at once (LIVE as Version 211, 5 Nov 2026 12:46Z; rollback Version 210)

Who asked and when: Kiko, 5 Nov 2026. 07:42Z: "is it possible for a logic to be applied to match the messenger's name to the project
if it's really there? And then if it's there, then it's automatically linked"; 09:10Z "A" (match, then a code); 09:47Z the Link in
Communication Config and on the Freelancers page; 11:49Z "Ok deploy" on crew-match-flow.png. 11:53Z: "right after I click I'm crew,
automatically there's a response that we don't have to wait for a minute or two"; 12:00Z "Yes, ship it" to the relay answering taps.

What changed:
- After I'm crew, the crew member's details go to Canvas (new bridge action crew_match). Canvas looks for one person on the team of a
  live project whose name shares a word with what they wrote.
- Found, with a mobile or email on file: Canvas sends a 6-digit code (SMS, else the crew email). Messenger says "Salamat po! Nakita ka
  namin sa team ng <event>. Nag-send kami ng 6-digit code sa mobile mo na nagtatapos sa <last 2 digits>. I-type mo lang dito ang code
  para ma-connect ka." ("sa email mo" when it went by email). Cue never sees the number or address, only the last 2 digits.
- The right code (crew_code_check) links their Messenger on their Freelancers row. They get "Hi <first>! Naka-connect ka na sa Blank
  Space Events dito sa Messenger. ..." and become linked crew in Messenger People. Wrong codes get "Mali po ang code. May 2 tries ka
  pa." / "May 1 try ka pa."; the 3rd gets "Hindi pa namin ma-connect ang Messenger mo. Babalikan ka ng team namin dito." and the main
  chat gets "<name> typed 3 wrong codes on Messenger. Nothing was linked."
- Found, but no mobile and no email: "Salamat po! Kailangan lang namin i-confirm ang details mo. Babalikan ka ng team namin dito."
  and one main-chat line pointing to Link in Canvas (Communication Config or the Freelancers page).
- Not sure (no one, or two people): the 1.28.29 reply and main-chat line, as before. Their next details are matched again quietly.
- Staff Link or Not mine in Canvas: the next sign-link pass (msgr_due, every 15 minutes) tells the person once, with the linked
  message or the "Hindi pa namin ma-connect" reply, then tells Canvas (msgr_told).
- Instant taps: the relay (relay/messenger-worker.js) answers I'm crew and Client or inquiry itself, in about a second, with Cue's
  exact words. Cue sends the relay the Page token and the list of linked crew (POST /sync) when either changes; Cue does not answer
  a tap the relay already answered. Everything else still waits for the 1-minute collection. The relay must be redeployed
  (npx wrangler deploy in relay/).
- Canvas down or not yet updated: crew get the 1.28.29 reply, as before.
- test/fixtures/ZapBridge.gs refreshed from CanvasWorkspace src/ZapBridge.gs (crew_match, crew_code_check, msgr_told).

Tests: MS16 to MS22 new, MS11 updated; relay 10/10. 677/677 pass.

## Cue 1.28.29: a crew member's Messenger details get one reply (LIVE as Version 210, 5 Nov 2026 09:51Z; rollback Version 209)

Who asked and when: Kiko, 5 Nov 2026 07:22Z: "There was no response in my message earlier when it asked me for the event name
and my name. So there." He tapped I'm crew, sent "Kiko Dacanay / Kings Day" at 14:33 PH and "Hello?" at 15:22, and got nothing
back; both reached his Cue chat, but nothing showed in the main chat.

What changed:
- After a crew member (not linked yet) sends their first message after tapping I'm crew, Messenger replies once: "Salamat po!
  Natanggap na namin ang details mo. Babalikan ka ng team namin dito sa Messenger as soon as possible." (wording sent to Kiko for
  his yes).
- The same message puts one line in the main chat: "<name> (crew, not linked yet) sent their details on Messenger: ...".
- Later messages stay quiet. Once the team answers from the person's Cue chat, the next details get the reply again.
- Tests: MS10l new; MS10j and MS10k updated. 670/670.

## Cue 1.28.28: the Messenger "I'm crew" reply drops the email note (LIVE as Version 209, 5 Nov 2026 06:20Z; rollback Version 208)

Who asked and when: Kiko, 5 Nov 2026 05:49Z: "Also remove the note about the email".

What changed: the reply to "I'm crew" is now "Welcome to the crew po. Reply ka lang dito with your full name and event, and our team will help you." The sentences about the Messenger link in the email are removed; the rest is Kiko's approved wording. It stays until the crew registration form ships.

Tests: MS10d checks the exact text.

## Cue 1.28.27: "start over" typed in Messenger resets the person (BUG FIX, LIVE as Version 208, 5 Nov 2026 05:26Z; rollback Version 207)

Who asked and when: Kiko, 5 Nov 2026 05:21Z, sent a screenshot of his phone: he typed "Start over daw" in Messenger and got no reply, because 1.28.26 only reads "start over" in the Cue chat.

What changed: a person not linked as crew who types a message containing "start over" in Messenger is made new again (triage state and Ask Cue mark dropped), and that same message gets the greeting with the two buttons. Linked crew are not affected.

Tests: MS10k new.

## Cue 1.28.26: "start over" in a Messenger triage chat (BUG FIX, LIVE as Version 207, 5 Nov 2026 05:19Z; rollback Version 206)

Who asked and when: Kiko, 5 Nov 2026, testing Version 206 from his own Facebook account. 05:05Z "Nothing happens......", 05:15Z "I didnt see those. What are you saying?".

What changed:
- Cause: at 12:38 PH his account tapped "I'm crew", so Cue treated him as crew, not linked, and waited for a person to answer in the chat "Messenger · Kiko Dacanay · Crew, not linked yet". His later messages arrived there with no auto-reply. Deleting the chat on his phone does not reset this, and Facebook shows the welcome screen only to accounts that never messaged the Page.
- Typing "start over" in a Messenger triage chat in Cue now makes that person new again: their triage state and Ask Cue mark are dropped, and the chat closes. Their next message gets the greeting and buttons as a first-timer. It does not apply to linked crew, and "start over" is never sent to the person.

Tests: MS10j new. 668/668 pass.

## Cue 1.28.25: Messenger welcome screen is the triage, buttons that stay, a menu, and typed messages get the buttons again (LIVE as Version 206, 5 Nov 2026 05:03Z; rollback Version 205)

Who asked and when: Kiko, 5 Nov 2026 04:51Z, testing 1.28.23 (Version 204): "Its not responding...".

What changed:
- Cause: after the greeting, a person who typed instead of tapping I'm crew or Client or inquiry got no answer. Cue stored the message quietly, and Messenger hides the buttons once a new message is sent, so the person was stuck.
- Now each typed message before a tap gets the same approved greeting with the two buttons again. Cue's Ask Cue line stays one per person.

- Welcome screen (Kiko 04:51Z "I have seen pages where just by visiting the page you already get a message. Cant we do thst?", 04:54Z "Why not the greeting is the triage?", 04:56Z "Yes"): Cue sets the Page's Messenger profile once (CUE_MSGR_PROFILE_V_ = 1). Before anyone types, the chat shows the approved greeting with "I'm crew" and "Client or inquiry" as tap options (ice breakers). A Get Started button and a menu by the typing box with the same two options are set too. Cue also subscribes the app to postbacks, so taps reach the relay. If Meta refuses, Ask Cue gets one line and Cue retries hourly. A Page cannot message people who only visit the Page without opening the chat.
- Buttons that stay (Kiko 04:54Z "There are no buttons showing"): Cue's greeting now carries its two buttons as a button template, which stays on the message, instead of quick replies, which vanished once the person typed. Taps arrive as postbacks. Typing the button words ("I'm crew", "Client or inquiry") counts as the tap.

Tests: MS10 and MS10b updated; MS10h (welcome screen, menu, postback taps) and MS10i (refused welcome screen, hourly retry, one line) new. 667/667 pass.

## Cue 1.28.24: a Messenger stranger who types instead of tapping gets the buttons again (BUG FIX, LIVE as Version 205, 5 Nov 2026 04:57Z; rollback Version 204)

Who asked and when: Kiko, 5 Nov 2026 04:51Z, testing 1.28.23 (Version 204): "Its not responding...".

What changed:
- Cause: after the greeting, a person who typed instead of tapping I'm crew or Client or inquiry got no answer. Cue stored the message quietly, and Messenger hides the buttons once a new message is sent, so the person was stuck.
- Now each typed message before a tap gets the same approved greeting with the two buttons again. Cue's Ask Cue line stays one per person.

Tests: MS10 updated (three typed messages, three greetings, one Ask Cue line). 665/665 pass.

## Cue 1.28.23: Messenger replies within a minute, one Ask Cue line per person, a refused greeting is tried again (BUG FIX, LIVE as Version 204, 5 Nov 2026 04:45Z; rollback Version 203)

Who asked and when: Kiko, 5 Nov 2026, testing 1.28.21 from his phone. 04:29Z: "i messged nothing happens". 04:30Z: "5 minuites is not good" and "when someone messages the triage isnt auitomatic?".

What changed:
- Cue collected Messenger messages from the relay only in the 5-minute run (cueResume), so a reply could take up to 5 minutes. The pull now also runs from the existing 1-minute trigger (cueRfpKick), so the triage reply goes out within about a minute. No new trigger is added. A short lease (script property CUE_MSGR_PULL_RUN) stops the 1-minute and 5-minute runs from collecting the same messages twice. The 1-minute run writes a Job Runs row ("Messenger inbox") only when it handled a message or failed.
- Bug: when Facebook refused the greeting, Cue still saved the person as "asked", so it went quiet for them from then on. Now a refused greeting saves nothing; the Ask Cue line shows Facebook's error, and the person's next message tries the greeting again.
- Bug (Kiko 04:33Z: "its still sending 1 notif per message"): the triage did not read the "already noted" mark that 1.28.19.1 set (script property MSGR_TOLD_<psid>), so someone noted before the triage shipped got a second Ask Cue line. The triage now uses the same mark: one Ask Cue line per person in total, including across greeting retries.

Tests: MS10e (refused greeting retries), MS10f (1-minute collection, lease, quiet minutes leave no row), MS10g (one line per person across versions and retries). 664/664 pass.

## Cue 1.28.22: Friday status emails keep a copy in Canvas (LIVE as Version 203, 5 Nov 2026 04:31Z; rollback Version 202)

Kiko, 4 Nov 2026 16:22Z, on the Canvas Projects page menus: "Reports > Weekly Reports - to see copies of it". Approved 16:28Z ("yup")
with assumption A14: Cue saves a copy of each Friday email to Canvas through the bridge when it is sent; earlier emails are not
back-filled.

- `src/CueStatus.gs` `cueStCopy_`: after Gmail sends a Friday status email, Cue sends Canvas the copy (subject, To, time, HTML and text,
  keyed by the Gmail message id) through the new bridge action `status_copy`. Canvas shows it under Reports › Weekly Reports. The email
  has already gone, so a failed copy never blocks or undoes it: the sent line says the copy was not saved, and says nothing while live
  Canvas does not have `status_copy` yet (it ships with Canvas PR #498).
- `test/fixtures/ZapBridge.gs`: the `status_copy` schema added from CanvasWorkspace PR #498.
- Tests: ST2b in `test/features/63-friday-status.js`. 662/662 pass on the build with 1.28.21.
- Kiko said "yes" on 5 Nov 2026 03:54Z (deploy with the Canvas V452 menus release). Built on live Cue 1.28.21 (Version 201). It first went live by mistake as Version 202 on 5 Nov 2026 04:29Z, built on V200, which left out the 1.28.21 Messenger triage until this rebuild.

## Cue 1.28.21: Messenger triage is the first reply (BUG FIX, LIVE as Version 201, 5 Nov 2026 04:26Z; rollback Version 200)

Who asked and when: Kiko. The triage was approved on 4 Nov 2026 at 14:59Z ("lets triage coz if its a customer inquiry... i want it"). He chose two buttons and warm wording at 15:14Z, and gave the exact words at 15:50Z. On 5 Nov 2026 at 04:09Z, after testing on his phone, he wrote: "any initial message should provide triage already".

What changed:
- Anyone not linked as crew who messages the Page now gets, as the first reply, "Hi! Thank you for reaching out to Blank Space Events. Para ma-assist ka namin agad, pili ka lang po sa baba." with two tap buttons: I'm crew, and Client or inquiry. This replaces "This chat is for our crew".
- **Client or inquiry:**
  - Cue asks "Happy to help po. Ano pong maitutulong namin? Share mo lang kung para saan ang message mo."
  - Their next message gets Kiko's thanks, with his email and mobile.
  - The person gets one Cue chat, "Messenger · <name> · Client or inquiry", set to Needs you. Kiko reads everything they send there and can answer by typing (inside Meta's 24-hour window).
- **I'm crew:**
  - A crew reply points to the Messenger link in their email, until the registration form ships.
  - The person gets one Cue chat, "Messenger · <name> · Crew, not linked yet".
- **No tap:** one Ask Cue line with their first words, as in 1.28.19.1. Their later untapped messages stay in the Page inbox.

Not in this release: the INQ-0042 number and Team Cue placement, which need Canvas (plan T1b), and the crew registration form (plan T3).

Tests: 661 of 661 pass (MS10 updated; MS10b, MS10c and MS10d new).

## Cue 1.28.20: GitHub Actions cost on the AI usage and cost page, Messenger button errors shown (LIVE as Version 200, 5 Nov 2026 03:46Z; rollback Version 199)

Kiko, 4 Nov 2026 13:05Z, after adding a card and an Actions budget on GitHub: "can you add in the page where we compute possible AI
usage and cost". At 13:10Z: "im upgrading to pro github".

- Settings › AI usage and cost gets a GitHub Actions card under the month's AI card, in the same layout: used so far, included each
  month (US$18, about 3,000 Linux minutes on GitHub Pro), plan fee (US$4), budget cap (US$10), billed so far above the included part,
  and the likely month end at the same daily rate, with the day the cap runs out when it falls inside the month.
- Cue cannot read GitHub's bill, so the five figures are typed in under Prices used (editable) and saved with the AI prices
  (script property `CUE_AI_PRICES`, key `gh`). Defaults are what Kiko saw on 4 Nov 2026 (US$15.81 used). Figures from an earlier
  month are flagged instead of projected. No AI call, no new access.
- Included US$18 is from docs.github.com ("GitHub Actions billing", read 4 Nov 2026). The US$4 Pro fee is not on github.com/pricing,
  so it is unverified and editable.
- Settings › Connections (PR #320): Connect Facebook, Finish, Make key and Save no longer swallow a server error. Each failure
  posts its message to the chat through `alertErr`, as other Cue buttons do. Kiko, 4 Nov 2026 14:35Z: "i pressed finish but nothing
  happens". Display only, no rule change.
- Kiko said "ship" for both on 5 Nov 2026 03:42Z.
- Built on live Cue 1.28.19.1 (Version 199).
- Tests: 658 (4 new, `test/features/32-usage-github.js`).

## Cue 1.28.19.1: a Messenger stranger no longer floods Ask Cue (BUG FIX, LIVE as Version 199, 4 Nov 2026 15:09Z; rollback Version 198)

Who asked and when: Kiko, 4 Nov 2026 14:58Z, "i feel this is gonna cause me some flooding....", and 14:59Z, "lets triage coz if its a customer inquiry... i want it".

What changed:
- Before, every message from someone not linked as crew posted "Messenger: a message from someone who is not linked as crew" in Ask Cue, and the "This chat is for our crew" reply went back on every message.
- Now each such person gets the reply once and leaves one Ask Cue line, which shows their first words so a customer inquiry is not missed. Their later messages stay in the Page inbox only.
- Built on live Cue 1.28.19 (Version 198). The three-button triage (crew, event inquiry, client) comes later with the crew Messenger build.

Tests: 654 of 654 pass (MS10 rewritten).

## Cue 1.28.19: Connect Facebook sets up Messenger with no pastes (LIVE as Version 198, 4 Nov 2026 03:25Z; rollback Version 197)

Kiko, 4 Nov 2026 02:31Z, while driving: "I can't do that. If there's a way for you to do it instead, please do so." He picked "Yes,
build it" on the card "Build a Connect Facebook button so you never paste keys?" at 02:35Z. The two pastes left for Messenger (Cue's
relay key into the relay, Facebook's Page token into Cue) are secrets, so this removes them instead of moving them by hand.

- Settings › Connections › Messenger: new row "Facebook" with **Connect Facebook** and **Finish**. Connect opens Facebook sign-in for the
  app Spaces MNL in a new tab; after Kiko signs in as a Page admin, Finish saves a new relay key and the Page token. Neither is shown.
  The old key and token fields stay as they were.
- `src/CueMessenger.gs`: `cueMsgrConnect` keeps a random proof and sends only its SHA-256 as the sign-in state; `cueMsgrFinish`
  collects the key and token from the relay once with the proof. Owner only; both are on the check's never-call list.
- `relay/`: new routes `/connect`, `/oauth` (swaps Facebook's code for the Page token with the app secret the relay already holds;
  only a Page admin's sign-in changes anything) and `/claim` (once, by proof, within 10 minutes). The key it makes is kept in KV and
  opens `/events` and `/ack` like the CUE_KEY secret. New vars APP_ID, PAGE_ID, LOGIN_CONFIG_ID in `wrangler.toml`.
- Meta setup (no secret): add `https://bse-messenger-relay.kikodacanay14-17a.workers.dev/oauth` to the app's valid OAuth redirect URIs.
- Tests: relay 8/8 (+4), MS15 (new). Full suite 653/653.

## Cue 1.28.18: the daily bid check stops storing every PhilGEPS notice (BUG FIX, LIVE as Version 197, 4 Nov 2026 01:22Z; rollback Version 196)

Kiko asked on 2 Nov 2026 at 07:29Z, in the thread "Find and fix what's broken in Cue": "find the problem, and fix it". Cue 1.28.13
gave a run 450,000 characters, but the 4 Nov 06:35 daily bid check still stopped with "This run grew too large to store". The cause:
when Cue's own read of the old PhilGEPS lists finishes, it puts every open notice of the categories it read into the run, and the run
was saved with that list before the screen (`cueBidsCheck_`) cut it down.

- `src/CueBids.gs`: when the PhilGEPS read finishes, the screen runs straight after it in the same run, so that list is never saved.
  If the run is cut off between the two, the 5-minute resume starts from the saved PhilGEPS state and rebuilds the list.
- Tests: 653 (1 new, TL4: 3,000 open PhilGEPS notices go to the screen without being stored; it fails without the fix).

## Cue 1.28.17: Cue Admin › Templates, every message from the BSE Message Templates doc (LIVE as Version 196, 4 Nov 2026 00:45Z; rollback Version 195)

Kiko asked on 1 Nov 2026, in the CRM chat: "why is the template not being referenced in the admin? we want it there so we can be sure
that its actually being used. we want it there so that if we want to edit them we can easily do so", and described the page: "Filter
who receives it and theres a list of communications on the right. once clicked on the type of comms - theres a template viewer on the
right that allows editing. would also show there inbox that sends it and files attached to the email". He approved the spec and the
page ("yeah i made it") the same day (CanvasWorkspace `docs/specs/message-templates-from-doc.md`, PR #391). On 3 Nov 2026 he asked for a
build of each piece for his approval ("make a new build for each one i will approve").

- `src/CueMsgTemplates.gs` (new): `cueAdminTemplates` reads every template from the doc through Canvas (bridge read
  `message_templates`, Canvas rel-v415) and joins it with what the doc does not hold, exactly as Kiko's approved mockup lists it: the
  journey step, who sends it, the sending inbox and CC, the attachments and the status. The six team drafts carry Kiko's T codes (T1 to
  T6) and show as not in the doc yet. A template with a send in Canvas's Template Sends log shows In use, with Last sent. When Canvas or
  the doc cannot be read the page lists nothing and says why; Cue keeps no copy of any wording.
- `cueAdminTemplatePreview` shows Canvas's own render of the template (bridge read `message_render`, draft mode) with the doc's banner;
  `cueAdminTemplateTest` (Send me a test) sends that render from Kiko's Gmail to Kiko only, subject "[Test] ...", banner inline. A test is
  not logged as a send.
- `src/Index.html`, `src/IndexPages.html`, `src/IndexStyle.html`: Cue Admin › Rules › Templates, the three columns of the mockup
  (filters by who receives it, channel and status; the list by journey step; the viewer) in Cue Admin's existing look.
- Edit re-reads the template from the doc, then opens the editor in the viewer: the subject, the message (paragraphs split by a blank line; a line `[Words](link)` is a button)
  and the template's fill-ins to insert. Save to doc (`cueAdminTemplateSave`) sends Canvas one claimed write, `message_template_save`,
  which rewrites only that template's Subject, message and button paragraphs in the doc and reads them back; a read-back that differs is
  shown as an error. Kiko chose this on 3 Nov 2026 ("Give info@ Editor on the doc"). The sending inbox, CC and attachments are shown, not
  edited (Canvas does not take them). Open in doc stays for anything else.
- After the /dev check on 3 Nov 2026 (a no-change Save of C6 came back Uncertain from Canvas and had in fact rewritten the button as
  plain text; fixed on the Canvas side), a save Canvas cannot confirm no longer shows "Not saved": the page says the doc was written
  but not confirmed, closes the editor and reloads the list (MT7).
- `src/CueCheck.gs`: the four page calls are never run by a cloud check; `message_templates` and `message_render` are reads.
- `test/fixtures/ZapBridge.gs` is Canvas `claude/project-thread-ynsrk8` @ 4e375a4 (the Canvas templates release, not live yet), which
  adds the four template actions.
  `test/fixtures/message-templates.json` is Canvas's `message_templates` answer for the real doc (48 templates).

Business rule CUE-042 (with open decisions CUE-D22 and CUE-D23) is in `docs/business-rules.md`.

Tests: 637 (7 new in test/features/84-templates-page.js, MT1 to MT7; AD4 lists the new section).
## Cue 1.28.16: each 2 PM chaser is logged in its project's Team Cue thread (LIVE as Version 195, 3 Nov 2026 23:45Z; rollback Version 194)

Kiko answered "2" on 3 Nov 2026 23:40Z in the chasers thread, picking the option where Cue logs each 2 PM chaser to its project's
Team Cue thread automatically, with no tap from him. Each chaser due at 2 PM that has a Canvas project now also gets one line in
that project's thread in Team Cue (bridge project_log, kind Chaser, from "2 PM chasers"). Chasers with no Canvas project stay in
Cue's chasers thread only, and a line changes no Canvas record. Built on 1.28.15.

## Cue 1.28.15: threads read like a chat, Fold inside the card, no accreditation chasers for clients (LIVE as Version 195, 3 Nov 2026 23:45Z; rollback Version 194)

Kiko approved three proposals on 3 Nov 2026 at 14:59Z ("yes yes tes"), each with a mockup. Built on 1.28.12 (cbe4363), so
everything live stays as it is.

- Chat format in threads (Kiko 30 Oct 10:14Z: "why is that responses from Cue in threads are not in a chat format box and format?
  Actions i guess is okay if not in chat format but make it 2 fonts smaller"; mockup https://claude.ai/artifact/QVzi9sAaU1Mc6bjinwSGvS).
  In a thread, Cue's replies sit in white bubbles on the left with a small "Cue" label; Kiko's stay lavender on the right. A status
  or action line (one that starts with Registering, Starting, On it, Ready for you, Rejected, Closed, Saved, Sent and the like, the
  list is `ACT_RE` in IndexThreads.html) stays out of the bubbles at 12px on one line, with the full text on hover. A Learned note is
  its own pale yellow box (#FFF8D9) with a dashed BSE orange border (#F06A25), a Learned tag, "Applies from your next message." and
  Keep and Undo at the bottom right. The main chat is unchanged.
- Cards in the conversation (Kiko 30 Oct 10:15Z: "how come Cards dont get move as well in the conversation"; comment on the mockup:
  "if rejected or done already. the card shouldnt stick anymore"). Each task's card now sits where it was posted (when it asked for
  Kiko, else when the task started) and scrolls with the chat, instead of always sitting at the bottom. The page gets each task's
  `card_at` for this (`cueView_` in Cue.gs).
- Fold inside the card (Kiko 30 Oct 09:55Z: "how do i fold this", 09:58Z: "i dont see thath"; mockup
  https://claude.ai/artifact/5QSkffP7by1EcPjF82n9mR). The chevron above the card is replaced by a Fold button in each card's upper
  right. Folded, the cards become one bar above the reply box; tapping the bar opens them again; each thread keeps its own fold.
- Accreditation chasers leave out clients (Kiko 30 Oct 10:52Z: "whats wrong is that this is a client. we are the supplier"). The
  morning batch skips any accreditation row whose name is a client in Canvas Accounts (Client Desk), asked through the existing
  read-only bridge action `client_check`, one call per row in parallel (`cueAccrClients_` in CueSweepAccr.gs). Client accreditations
  such as infor.com keep their own Accreditation thread. When Canvas cannot say, the row stays in, as before. No Canvas change.
- Chasers card copy (PC check 3 Nov 2026: the header said "each email goes only when you press Send" while the footer said
  Approve and send sends the ticked ones at 9:00). The header now names only the ways that card really sends: a picked 2 PM line
  goes when Kiko presses its Send, and other ticked emails go only after he taps Approve and send (which still confirms each
  recipient by name and sends at 9:00, or right away after 9:00). The Cue Admin line for the 1 PM chaser job says the same. No
  change to what is sent or when.
- Shops and booking sites (PC check 3 Nov 2026: Booking.com and Shell were chased; Kiko 3 Nov 23:37Z "yes" to Cue skipping
  shops and booking sites like these on its own). They are awarded payees in Canvas (hotel nights, fuel, toll RFID) that are never
  accredited, so the morning batch leaves out names with Booking.com, Shell or Autosweep (`CUE_ACCR_SHOPS_` in CueSweepAccr.gs).
  Only the names seen so far are listed; Stop chasing still covers any other.
- No AI call added. Tests: 644 (5 new, `test/features/84-thread-chat.js`).

## Cue 1.28.14: Cue messages act like an assistant (LIVE as Version 195, 3 Nov 2026 23:45Z; rollback Version 194)

Kiko asked on 3 Nov 2026 at 14:30Z: "if you can work on queue having some context, like knowing where the message comes from, why it
was sent to me, or why it was sent, and why is the message like that, and have a like a proposed response to it, not just blank sent
this. It's like it's a notification. It's not an assistant." He approved the before/after mockup at 14:57Z ("yes"). At 23:36Z he
refined it: "it doesn't have to say that as a verbatim, but if there is context, if it understands what the message is about, then
he would know, or it would know, if that needs to be added there." So there is no fixed "Why you" label: a reason shows only when the
email read understands one worth adding. Spec and mockup: project files `canvas-integration/specs/cue-assistant-messages/`. Built on
1.28.12 (Version 194, cbe4363).

- New email: the main-chat post and the email's chat can end with one plain sentence on why it needs Kiko (only when the read finds
  one worth adding; code never makes one up) and, when the sender expects an answer, "Proposed reply:" with a ready reply in Kiko's
  voice. Both come from the one email read that already runs (Claude Haiku, two more fields in its answer, max tokens 800 to 1400),
  so there is no extra AI call. The reply never promises a price, date or document that is not in the emails; it leaves a blank such
  as [time] for Kiko instead. Kiko's 10:15Z context lines (what they sent, what it is for, what they expect, what to do next) stay.
- Use this reply and Skip buttons sit under a proposed reply, in the email's chat and under its post in the main chat. Use this reply
  puts the reply on the usual email card as written (no GPT drafting call); Kiko edits it and taps Send or Save to Drafts there, so
  nothing is sent from the button. Skip closes the email's chat and makes nothing. Typing "draft a reply saying ...", "start intake"
  or "done" still works. The approved mockup shows buttons, which replaces the 2 Nov "no options in Ask Cue chat" choice for this
  message only.
- Scheduled ChatGPT jobs with new findings (for example "Tuesday payment records review") now add ChatGPT's two-sentence summary and
  "My suggestion:" naming the finding to start with: the one due soonest, else the first high-confidence one, else the first, with
  its next action. Built by code from the run, no AI call. A run with nothing new keeps its one line.
- One line emails (FYI types) are unchanged: their line is already the sort's own summary.
- The page shows "My suggestion:" and "Proposed reply:" at the start of a line in bold, as labels, never as buttons.
- Not changed: the status lines ("1 new email ...", "Sorted ...", "Started ...", "working on it"); the duplicates work owns them.
- Tests: `test/features/84-assistant-messages.js` (AM1, AM1b, AM2 to AM6); ML4 updated. 639 of 639 pass.
- Needs the PC check on /dev (it changes new-mail intake): open a new client email's post, tap Use this reply, check the card, then
  close it without sending.

## Cue 1.28.13: the daily bid check fits in storage again (LIVE as Version 195, 3 Nov 2026 23:45Z; rollback Version 194)

Kiko asked on 2 Nov 2026 at 07:29Z, in the thread "Find and fix what's broken in Cue": "find the problem, and fix it". The 3 Nov
06:34 daily bid check stopped at 07:05 with "The bid check stopped: This request is too large to store (210412 characters)". A run's
saved state was split over 4 cells of 45,000 characters (180,000 in all). The 1 Nov fix only closed an oversized run once instead of
every 10 minutes, so the check still failed whenever it found many notices (310,994 characters on 1 Nov).

- `src/Cue.gs`: `CUE_CELLS_` goes from 4 to 10 (450,000 characters), and the Requests tab gains the headers Data 5 to Data 10. The
  Requests tab already has 26 columns, so nothing has to be set up. Every reader uses `CUE_CELLS_`, so old rows read as before.
- Tests: 631 (1 new, TL3: a 310,000-character run is stored and read back whole; TL1 now overfills 450,000).

## Cue 1.28.12: no repeated messages (BUG FIX, LIVE as Version 194, 3 Nov 2026 15:02Z; rollback Version 193)

Kiko said on 3 Nov 2026 that the three things that annoy him most in Cue are "The redundant messages. You see the message in the
thread, you see the message in the main chat, and then after a while, you see it again", with about 40 repeats in 60 morning
messages; earlier that day: "Goal is not to make it confusing. Remove the duplicates, Do not Flood details that are not necessary."
The Chat tab for 1 to 3 Nov showed three sources of word-for-word repeats. Built on 1.28.10 (branch claude/project-thread-st4gw7),
so 1.28.6 (new mail only in the main chat) and 1.28.9 (job reports in their own threads) are kept.

- One run at a time: on 3 Nov at 19:00 two runs of one "Daily personal spending" passed the sheet lease seconds apart, so every line
  posted twice and ChatGPT was paid twice. The lease now also sits in a Script Property, checked inside the same lock, and is let go
  when the run ends (`cueRunLeased_` in Cue.gs).
- No word-for-word repeat: a Cue line that is exactly the newest line already in the same place (same thread, same pointer or the
  main chat, within a day) is not posted again (`cueChatRepeat_` in Cue.gs). Seen live: "The bid check stopped" every 10 minutes,
  two identical one-line DMARC emails. A line from Kiko in between makes the next Cue line new; Kiko's own lines always post.
- Nothing changes in how anything looks. No AI call. Tests: 626 (2 new, `test/features/83-no-repeat.js`).

## Cue 1.28.11: New PhilGEPS read by code, Cowork removed, bid range up to ₱1,000,000 (LIVE as Version 192, 3 Nov 2026 14:51Z; rollback Version 191)

Kiko on 3 Nov 2026 at 14:36Z, in the Canvas project: "We removed co-work because it uses a lot of usage and then we just used script
or code. And then it was able to download it." The code reader is Cue PR #284 (merged to main on 1 Nov 2026, never live), rebuilt
on 1.28.10. The bid rules are Kiko's answers in that thread on 1 Nov 2026 ("raise it to 1M"; Pampanga "1. Yes"; CALABARZON and
Region IV-A "2. Yes"; Quezon province "3. No"; "QC or Quezon City is ok"), kept with his 29 Oct floor ("you can lower it to 50k").

- `src/CueBidsPg.gs` (new): Cue's own code reads New PhilGEPS's public bulletin board (`/Indexes/index`, the latest 100 open notices),
  each matching notice's page, its activity schedule and its document list, with plain HTTP. No AI call, no browser, no sign-in.
  The constant is `CUE_NPG_` because the old PhilGEPS reader (`CueBidsPhilgeps.gs`) already uses `CUE_PG_`.
- `src/CueJobs.gs`: new job "New PhilGEPS read", hourly from 7 AM to 7 PM Manila, because the board shows only the latest 100.
- `src/CueBids.gs`: New PhilGEPS is no longer sent to ChatGPT; the 06:30 check takes the waiting notices from the code reader and
  opens their files with the same document step as every other source. ABC ₱50,000 to ₱1,000,000. Area: Pampanga, CALABARZON and
  Region IV-A in; Quezon province out (Quezon City and "QC" stay in).
- `src/CueSchedule.gs`, `src/CueAdmin.gs`: the "New PhilGEPS (Cowork)" 10:30 row and its run are removed; a saved row leaves the
  Schedule tab once (seed v15). The Cowork task on KKD is no longer read. The Cowork helper code in `CueBids.gs` is left in place
  but nothing calls it any more.
- Tests: `test/features/83-philgeps-code.js` (PGS1 to PGS6), BD1 and SC4 updated, harness answers philgeps.gov.ph; 630 tests pass.
  FEATURE-MAP.md refreshed with `node tools/map.mjs`.

## Cue 1.28.10: the whole old PhilGEPS Description on bid cards (BUG FIX, LIVE as Version 192, 3 Nov 2026 14:51Z; rollback Version 191)

Kiko asked on 30 Oct 2026 at 10:49Z, in the Cue project: "for Philgeps Legacy bid opportunities make sure to read the Desciption
because it has so much more details about the post". Cue has read that field (`lblAbstractText` under the page's "Description" label)
since 1.27.85, but the card ran it into one line and cut it at 600 characters, so a list of inclusions became a wall of text. Kiko saw
the before and after mockup (`canvas-integration/mockups/philgeps-description-card.png`) and said yes on 3 Nov 2026 at 10:16Z.

- `src/CueBids.gs` (`cueBidsCopyFrom_`): "Summary of requirements" on an old PhilGEPS notice is now the whole Description with its own line
  breaks, up to 2,000 characters.
- `src/CueBidsPhilgeps.gs` (`cueBidsPgDetails_`): a Description over 2,000 characters ends with "…"; the full text stays in Cue's PDF copy.
- `src/IndexCards.html` (bid card `kv`): a summary with line breaks shows line by line, left aligned. One-line summaries keep the
  justified look. Nothing else on the card changes.
- No new AI call, no new fetch, no Canvas change. Notices already copied get the full text from their saved record at the next check.
- Tests: `test/features/82-philgeps-description.js` (2 tests), BO4 updated for the kept line breaks; 619 tests pass.

## Cue 1.28.9: scheduled job reports in their own threads (LIVE as Version 192, 3 Nov 2026 14:51Z; rollback Version 191)

Kiko asked on 3 Nov 2026 06:40Z: "Scheduled Jobs should have their own thread and they are not supposed to be sent as an
update to me every step"; 10:13Z picked "Own thread in Team Cue"; 10:15Z "ok" on the mockup
canvas-integration/mockups/job-threads/job-threads-before-after.png. The 8 AM and 2 PM updates now sit in their own threads and
the main chat gets one short line that opens each ("8 AM update is ready.", "2 PM chasers: 4 for your OK"). The 2 PM funnel
follow-ups get their own thread (Ask Cue, per the CRM/Funnel rule), apart from the chasers. A reply of "1, 3" works in the main chat or in the chasers thread. Built on live Version 191 (1.28.5). Tests: 615/615 (new K82).

## Cue 1.28.8: the chat and an open thread stay at the newest line (bug fix, LIVE as Version 192, 3 Nov 2026 14:51Z; rollback Version 191)

Kiko asked on 3 Nov 2026 06:29Z: "its so hard coz i have to scroll all the way... please change that", and on 10:14Z, when the
newest line was moved to the top: "at top?\"???????? should be at the boottom!!". So the newest line stays at the bottom, and the
fix is that Cue lands there.

- Cause: Cue scrolled to the end once per render, then judged "not at the bottom" from the page as it was. When cards, pictures or
  the Canvas slide-in grew the page after that scroll, the view stayed partway up and every later render left it there.
- Fix (`pinBottom` in `src/IndexThreads.html`, `goThread` in `src/IndexChat.html`): the chat and an open thread remember whether they
  are pinned to the end. Kiko scrolling up unpins; scrolling back to the end pins again; while pinned, any change of size or content
  scrolls to the end. A link to a spot in a thread still jumps to that spot. The Threads list is never pinned.
- Checked in a browser render: with 600 px of late content, the old code left the chat 612 px from the end and a thread 514 px;
  the new code leaves both at 0, and a chat Kiko scrolled up stays where he left it.
- Tests: `test/features/82-chat-stays-at-bottom.js` (SB1, SB2). The newest-on-top change (1.28.7 on rel1286) is dropped.

## Cue 1.28.7: each new email's post in the main chat gives its context (LIVE as Version 192, 3 Nov 2026 14:51Z; rollback Version 191)

Kiko asked on 3 Nov 2026 at 10:15Z, in the Cue project: "when you post on the left give some context. like what did they send, what
time, what is it for, what do they expect, what needs to be done after?" Built on 1.28.6 (new mail in the main chat only).

- `src/CueMailChat.gs` (`cueMcLeft_`): the main chat's post for an email that has its own chat now reads: "New email: name <address> ·
  type · day, time" (Manila), the subject, "What they sent", "What it is for", "What they expect" and "What to do next". A later email
  in the same conversation posts the same way, starting "New in this conversation".
- The same one Claude Haiku read per email gives the three new parts (`sent`, `purpose`, `expect` in its answer), so there is no extra AI
  call. When the read fails, the post still gives the sender, time, subject and what the email says, and leaves out the rest.
- The email's own chat still starts with Cue's full read. Emails whose type is set to One line keep their one line.
- Tests: `test/features/81-mail-left-only.js` ML4 and ML5; ACC7 and ACC9 updated for the new post. 619 tests pass.

## Cue 1.28.6: new mail shows only in the main chat (LIVE as Version 192, 3 Nov 2026 14:51Z; rollback Version 191)

Kiko asked on 3 Nov 2026 at 06:30Z, in the Cue project: "the new mails are redundant. only make them appear on the left. if i ask it
to do an action that is the only time it will show in the threadss". His screenshot (Version 190) showed each new email both as a line
in the main chat and as a row under "Waiting on you" in the Threads list.

- `src/IndexThreads.html` (`listShows`): an email's own chat (kind `mail`) and a new-kind-of-email question (kind `mailtype`) no longer
  show in the Threads list or in the ☰ Threads count (`needThreadsN`). They stay in the main chat on the left, and their line there still opens
  the chat.
- A mail chat joins the Threads list once Kiko writes in it (anything except a plain "done") or another task joins it, such as the
  reply draft or an intake. A "done" alone closes the chat without listing it.
- Page only: no server change, no AI call, no Canvas change. New mail sorting, types and the daily New mail list are unchanged.
- Tests: `test/features/81-mail-left-only.js` (3 tests); 616 tests pass. FEATURE-MAP.md refreshed with `node tools/map.mjs`.

## Cue 1.28.5: the 2 PM update stops flooding (BUG FIX, LIVE as Version 191, 3 Nov 2026 10:17Z; rollback Version 190)

Kiko asked on 3 Nov 2026 06:39Z why chasers still showed in his updates, and at 06:40Z: "Goal is not to make it confusing. Remove the
duplicates, Do not Flood details that are not necessary." The screenshots were the 2 PM update. Chasers that cannot be emailed (no
address on file, client already replied, chased 3 times) were listed one by one under the Funnel heading. Now the 2 PM update shows one
count line per chaser type under "Not emailed: need you in Canvas", and the details stay in the chaser batch's own thread. A chaser listed
twice (same type, person and project) is numbered once, and chased-the-max lines become one count line. Built on live Version 190
(1.28.4).

## Cue 1.28.4: Messenger for crew: sign links, link-ups, crew chats and the relay (live as Version 190, 2 Nov 2026 06:20Z; rollback 189)

Kiko asked on 2 Nov 2026 for crew papers on Messenger (m.me) and said "you built the spec you code it", then "you do it" for the
deploy. Built on the live line (1.28.3, Version 189); the same feature is on main as 1.27.90 (Cue PR #289), where the relay
posts to Cue instead. Spec and plan: CanvasWorkspace `handoffs/messenger-crew-papers-spec.md`,
`docs/superpowers/plans/2026-11-02-messenger-crew-papers.md`.

- Sign links: every 15 minutes (Job Runs "Messenger sign links") unsigned FSA and AR links of linked crew go on Messenger once,
  inside Meta's 24-hour window (Canvas `msgr_due`, `msgr_mark`). A send Meta accepted is remembered before Canvas is told.
- Receiving: Meta's messages wait in the Messenger relay (`relay/`, a Cloudflare Worker that checks Meta's signature); every
  5 minutes (Job Runs "Messenger inbox") Cue collects them with its key. Cue's /exec stays Google sign-in only. A sealed m.me
  link saves the link-up in Canvas (`fl_social_save`, with Facebook name and gender) and opens a Cue chat "Messenger · <name>";
  Kiko answers by typing there (sent inside the window; otherwise Cue says Messenger is closed). Strangers get a polite reply.
- Settings › Connections › Messenger: relay key (Make key / New key), relay address, and a password box for the Page token.
- Inert until the relay address and Page token are saved. No AI call. Tests: 613 (15 new, `test/features/80-messenger.js`).
## Cue 1.28.3: Ask Cue changes: old threads clear themselves, email types and one chat per email, Canvas edits after approve (not deployed)

Kiko asked on 2 Nov 2026, in the cloud chat "Ask Cue changes": carry unanswered items into today's thread so old threads can be
archived; one chat per new email with Cue's read of it, a type for every email and a Triage list of what to do per type; and Cue
allowed to change Contacts, Clients, Projects, Suppliers and Freelancers fields. Spec, approved 2 Nov 2026: CanvasWorkspace
`docs/specs/ask-cue-changes-spec.md`. Built on Cue main as 1.27.84 to 1.27.89 (PRs #287, #288, #290 to #293) and restacked here on
1.28.2. Kiko 2 Nov 2026: "approve".

- Old daily threads: open lines from every older New mail thread move into today's; the day's first Bid check archives older days'
  Bid check threads that still wait (their open notices already show as still open in today's); an older Morning batch is archived
  as well as closed.
- Email types (Client, Supplier, Freelancer, Personal, Government, Bank, Bills and dues, Platform notices, Newsletters and promos,
  Other): typed by sender in code, otherwise by the existing New mail sort, which then remembers the sender. Cue Admin › Triage sets
  Own chat, One line or Ignore per type; a new kind of email asks once in its own short chat.
- Own chat emails each open a chat (one Haiku call for Cue's read). Kiko answers by typing: "done", "start intake", "draft a reply
  saying ...". A later email in the same Gmail conversation joins its chat. The daily New mail thread is no longer shown.
- One line emails each get a line in Ask Cue. These lines and the email-chat pointers post in the main chat even when the 8 AM update
  is on, because Kiko asked on 2 Nov for each email to appear in the main chat.
- Emails with a Canvas Project ID now pass the junk and mute filters and get one line pointing to Team Cue (still unread). Threads
  Canvas already files under a project stay out of Ask Cue, as before.
- Marking emails read is in the code but switched off: it needs the Gmail scope gmail.modify, which is not added, so triggers keep
  their current authorization. The line notes the missing permission instead.
- Canvas edits: approve questions take a typed "approve" or "not" (no buttons); Kiko's lock list is checked in Cue; supplier bank
  edits carry "Confirm by calling the supplier on a number you already have."; every saved edit goes to the Canvas edits tab, with
  Undo in Cue Admin › Edit log; a known contact's signature that differs from P0 Contacts becomes an edit question in its chat.
- The Canvas part (Team Cue filing by Project ID for every sender, info@ mark-read, Canvas-side locks, allow-list rows) is handed to
  Canvas Integration (CanvasWorkspace `handoffs/ask-cue-changes-for-canvas-integration.md`).
- Cloud check: `test/checks/1.27.88-ask-cue.check.mjs` (read only). Tests: 598.

## Cue 1.28.2: a run too large to store stops instead of repeating (not deployed)

Reported by Kiko on 1 Nov 2026 (screenshot on /dev): "The bid check stopped: This request is too large to store (310994
characters)" posted every 10 minutes for Saturday's bid check.

- A run whose saved data outgrew its 4 cells could not even save that it failed, so the 5-minute job picked it up again and
  posted the same line each time. Cue now saves a slim copy closed as Failed ("This run grew too large to store and was closed.
  Nothing was sent or written. Run it again."), once.
- The bid card's "Opportunities closing" list keeps the 30 soonest deadlines, like New and Updated already were capped, so a bid
  check stays storable.
- Tests: test/features/79-too-large.js (TL1, TL2). 586 of 586 pass.

## Cue 1.28.1: the new PhilGEPS check moves to 10:00 (not deployed)

Asked by Kiko on 1 Nov 2026: "login times out. you know what we can move the job at 10a, so that i am already awake and can login".

- Cowork's "New PhilGEPS check" on KKD runs weekdays at 10:00 (Kiko changes its time in Cowork; docs/cowork-philgeps-task.md
  says 10:00).
- New Schedule row "New PhilGEPS (Cowork)", weekdays 10:30: reads today's Cowork rows only (no ChatGPT search, no other site),
  screens them like every bid, and posts new ones in the main chat as the New opportunities card. If Cowork did not run (no RUN
  row), one main-chat line says so. Nothing is posted when Cowork ran and found nothing new.
- The 6:30 bid check no longer reads the Cowork tab, and the 8 AM update no longer warns about Cowork.
- Tests: CW1 to CW3 rewritten for the 10:30 run; SC4 and NH2 updated. 584 of 584 pass.

## Cue 1.28.0: the bid check opens the agency sites itself (not deployed)

Asked by Kiko on 1 Nov 2026, on the proposal to open the other bid sites in code instead of leaving them to ChatGPT's web search:
"Yes, thats why we listed them down"; then on /dev: "it has more details now but not about the other bid sites".

- Cue fetches the listing pages of CITEM, TPB, NPDC, PCC and City of Manila itself (code, no AI), turns each into text with every
  link kept, and gives that text to the same 3 bid search calls, so ChatGPT reads each site's real current list and opens the
  notices on it instead of stopping at the landing page. Still 3 AI calls.
- A site that does not open is named in the search ("Cue could not open it (HTTP 503)") and left to web search. The run keeps
  which sites were read.
- UNGM, ADB and GIZ (search forms) and EU (blocked) stay on web search; the new PhilGEPS comes from Cowork.
- Script Property CUE_BID_PAGES=off turns it off.
- Tests: BP1 in test/features/78-cowork-philgeps.js. 584 of 584 pass.

## Cue 1.27.99: Cowork downloads the new PhilGEPS bid documents (not deployed)

Asked by Kiko on 1 Nov 2026: "did you tell it to download all the files downloadable from the bid".

- The Cowork task text (docs/cowork-philgeps-task.md) now downloads every free bid document of each kept notice into Google Drive,
  folder "PhilGEPS bid documents", one subfolder per reference number, never paying for one, and lists the Drive links in
  Documents. It checks service, location and the ₱50,000 to ₱700,000 budget on the notice page first and downloads nothing for a
  notice that fails (Kiko: "check the filters first ... if not within our range then dont download at all"). It does not read
  the documents, to keep usage low; Cue reads them only when Kiko asks about that bid.
- Cue's bid check shows those Drive links on the New opportunities card as saved by Cowork. Cue does not fetch them: it can open
  only files it made itself.
- Tests: CW3 in test/features/78-cowork-philgeps.js. 583 of 583 pass.

## Cue 1.27.98: new PhilGEPS through Claude Cowork on KKD (not deployed)

Asked by Kiko on 1 Nov 2026: "cant you use Clause Cowork. I wil leave it on. so that its on when you run. if its not, let me know",
then "cowork. yes".

- The new PhilGEPS site needs a sign-in, so Cue cannot read it. A Claude Cowork scheduled task on KKD (weekdays 6:00 AM, Kiko's
  signed-in Chrome, read only) writes each event notice it finds into the bid sheet tab "Cowork PhilGEPS findings", plus one RUN
  row each time it runs. The task text is in docs/cowork-philgeps-task.md; Kiko pastes it into Cowork once.
- Cue's 6:30 bid check takes that tab's rows for today as New PhilGEPS notices, through the same screen as every other source
  (events only, budget and area). They show in the New opportunities card.
- When today has no RUN row, the 8 AM update says "New PhilGEPS was not checked today: Cowork on KKD did not run. Is KKD on and
  Claude open?". Script Property CUE_COWORK_PHILGEPS=off turns the check and the warning off.
- Tests: test/features/78-cowork-philgeps.js (CW1, CW2). 582 of 582 pass.

## Cue 1.27.97: the 2 PM funnel adds the 3 checks kept from the pipeline review (not deployed)

Asked by Kiko on 1 Nov 2026: "add the 3 missing", on the proposal to keep from the removed pipeline review only what the chasers
do not already cover, as lines in the 2 PM update's Funnel section.

- Waiting on your reply: an open deal (Inquiry or CE sent in Canvas) whose newest email with its contact came from them, 1 working
  day or more ago. Read from Kiko's Gmail, read only; system mail (no-reply, notifications, login codes) is skipped.
- Event soon, not won yet: the event is today or within 14 days.
- Fix in Canvas: the event date passed with the deal still open, or the deal has no amount, no event date or no contact.
- Code only: no AI call, nothing written or sent. Checks the 40 open deals with the nearest event dates.
- Tests: FN6 in test/features/54-sales-funnel.js. 580 of 580 pass.

## Cue 1.27.96: HubSpot removed; bids are event work only; schedule texts updated (not deployed)

Asked by Kiko on 1 Nov 2026: "its still mentioning Hubspot. Can we make sure that we remove it from the process", then "Delete
the Hubspot code"; on bids: "how come the bid opportunities are procurement of stuff?", "add events management, lights and
sounds", "no they are on top of what you use now"; on the Scheduled tasks card: "how come theres still this".

- HubSpot is gone from Cue. Deleted: the Monday HubSpot clean-up, the pipeline review (and its "pipeline" chat command and
  follow-up drafts), the HubSpot tasks list and Mark done in the sales funnel, the "Add to HubSpot" action on ChatGPT findings,
  the HubSpot lookup, the CUE_HUBSPOT_TOKEN setup line and HubSpot wording in chat, cards, Cue Admin, Teach and Workflow. No
  code calls HubSpot. The sales funnel reads Canvas only. The two HubSpot rows leave Scheduled tasks once. Old saved runs of
  these kinds close quietly and show as "Removed task". Canvas still has its own HubSpot code (out of scope).
- Bids: the bid check keeps the same kinds of work as before plus events management and lights and sounds. A notice that buys
  goods ("Supply and delivery of", "Procurement of", "Purchase of", "Printing of") with no event or kept kind of work in its
  title is left out, in ChatGPT's screen and again in code.
- Scheduled tasks: the "Morning sweep" row is renamed "Chasers (for the 2 PM update)" in the saved list. Its description and
  rule now say 1:00 PM, the 2 PM update and Send on each card. The 8 AM update, Bid check, Friday status (5 PM) and Sales
  funnel (1:15 PM, for the 2 PM update) descriptions match the new schedule.
- Tests: deleted 06-pipeline-review.js and 12-hubspot-cleanup.js; added 77-no-hubspot.js (NH1 to NH4) and KW4; kept the
  non-HubSpot funnel and sweep tests. 579 of 579 pass.

## Cue 1.27.95: the 8 AM update reads the Shared Task Tracker and the project timelines (not deployed)

Asked by Kiko on 1 Nov 2026: "it should also reference the project timeline of any ongoing project". On the proposal: "1. add.
anything assigned to internal that i need to nudge / 2. They should / 3. yes / 4. Yes / 5. yes".

- Today's focus now also reads the Shared Task Tracker (Tasks tab) and, through Canvas's existing client_status read, the Project
  timeline and open TRI tasks of every ongoing project (the same list as the Friday status updates). No AI call; no Canvas release.
  - Critical today: Tracker rows due today, timeline rows ending today, and TRI tasks assigned to Kiko due today.
  - Overdue: Tracker rows past their due date, late timeline rows, and Kiko's late TRI tasks, each with how many days late.
  - Assigned to you: Tracker rows In Progress with no due date.
  - Nudge your team (new): open TRI tasks assigned to someone else that are late or due today or tomorrow, with the name.
  - Blocked, waiting on someone: Tracker rows marked Blocked.
  - Key milestones in the next 3 days (new): timeline rows marked as key milestones.
  - Personal (new): Personal-category Tracker rows, in their own group. Not Started rows with no date are left out.
- Yesterday's summary adds Completed (Tracker rows marked Complete yesterday, or since Friday on a Monday) and Moved (Tracker rows
  whose due date changed since the last 8 AM update; this starts the day after the first run).
- Each group shows 8 lines at most, then "and N more". If the Tracker or Canvas cannot be read, the update still goes out and
  says what it could not read.
- Kiko's own TRI tasks are found by name: Script Property CUE_ME_NAMES (default "Kiko").
- Tests: test/features/76-k0-tracker-timeline.js (KW1 to KW3). 585 of 585 pass.

## Cue 1.27.94: Reply on chat bubbles; New opportunities card under the 8 AM update (not deployed)

Asked by Kiko on 1 Nov 2026: "i want to keep it very much like a chat conversation but each chat has a bubble right? so i'm
thinking a reply in the chat bubble function"; "New Opportunities / Bids need to be a card. Coz they need to show more details,
links inside it and buttons the rest can be message format"; "we can remove Decide Later. If we just scroll pass through it that
means we dont want to decide yet"; the card subtitle "dont add this anymore"; "okay to build" on mockup cue-8am-bids-card.png.

- Reply: a Cue bubble in the main chat that names a task shows ↩ on hover (a long press on a phone). Tapping it puts a "Replying
  to <message>" strip above the chat box (× or Esc cancels). Kiko's sent line shows the quoted message above his words.
- A reply to an 8 AM or 2 PM update answers that update, even on a later day ("1, 3" drafts those chasers). A reply to any other
  task's bubble goes into that task's thread, and the quoted line stays in the main chat.
- The 8 AM update's New opportunities section now reads "N new bids, in the card below". Right under it, the New opportunities
  card lists each new bid: title, source and status labels (Scoped or For clarification), Agency, Budget (ABC), Closes,
  Reference, What it needs (or Missing), document links, then View opportunity, Ask the agency (to clarify), Decline and Start
  intake. Bids are no longer numbered for a typed reply.
- Decide later is gone from every bid card. A bid Kiko scrolls past stays undecided until it closes.
- New clients in the 8 AM update (Kiko 1 Nov: "B - until i decline or add"): "add 2" adds that person to Canvas, "no 3" drops
  that person for good, and anyone Cue listed but you did not name goes back on the list for the next 8 AM update.
- Tests: test/features/75-reply-bids-card.js (RB1 to RB5); BV5 updated. 582 of 582 pass.

## Cue 1.27.93: 8 AM and 2 PM weekday updates; chasers drafted for your OK, tailored, sent one by one (not deployed)

Asked by Kiko on 1 Nov 2026: "8AM Yesterday's Summary, Today's focus, New Opportunities, New Clients / 2PM Funnel, Chasers / 5PM
…"; weekends "no. we rest"; on "send 1, 3": "what i actually meant is to draft it and show it to me for approval"; "In Cue";
templates "would probably still need to be adjusted based no the client and situation"; "go with both". Spec section 10.

- 8 AM update (weekdays): Yesterday's summary (Friday's on a Monday), Today's focus (critical today, assigned, needs your OK,
  overdue), New opportunities (bids; reply "start 1"), New clients (contacts; reply "add 2"). No chasers in the morning.
- 2 PM update (new Schedule row "2 PM update", weekdays 14:00): the funnel's follow-ups and every chaser due, numbered. Reply
  "1, 3" or "all": Cue drafts those (nothing is sent), tailors only their middle sentences to the client's latest email in one AI
  call (greeting, ask frame, "Thanks!" and sign-off stay the template; a draft that changes them is dropped), and shows each as a
  card in the chasers thread with Edit, Tell Cue (one AI call per instruction, same check), Skip and Send. Each email goes only on
  its own Send (approve = send, per message); payment, signature and accreditation chasers send through their own path.
- Schedule: weekdays only for the bid check (06:30), 8 AM update, chasers (13:00, now their own time, no longer tied to Chaser
  rules' build hour), sales funnel (13:15), 2 PM update and release notes (19:45). Friday client status updates move to Fri 17:00
  and post their own line (the Friday 5 PM message). The other 5 PM reports get their own specs.
- Tests: 577 (K1, K2, K5 rewritten, K6 new; schedule tests updated for weekdays and the new times).

## Cue 1.27.92: chasers in Kiko's templates and the designed email, C2 and C3, holidays, Emails waiting off (not deployed)

Asked by Kiko on 31 Oct 2026 ("yes sorry start part 2"). Part 2 of the spec cue-message-redesign-spec.md. Kiko's answers the same
day: C2 stops after 2 follow-ups "as the templates say"; payment chasers "can be from AccountsPayables"; "Full design, in the same
thread". Built on 1.27.91 (PR #270).

- Kiko's revised templates (Google Doc "BSE Message Templates") replace the AI drafts for C6 CE award (follow-up and urgent),
  S2 RFQ and RFP, S1 accreditation follow-up, C7 payment and C2. Cue fills only the blanks, so these chasers make no AI call. New
  file `CueTemplates.gs`.
- Designed email: each one goes as text plus HTML with the audience banner (cyan for clients, orange for suppliers), "Thanks!" and
  the sign-off, as a reply in the original thread. An email Kiko edits goes as plain text, exactly as he typed it. The banner is a solid
  colour band with the wordmark. The designed banner image (diamond and orbit pattern) comes with the Canvas release (part 3).
- C2 They went quiet (was "Inquiry chasers"): first follow-up, then the final follow-up, 3 business days apart, at most 2, from
  Kiko's Gmail once he names it in the 8 AM update (before, drafts only). Win-back drafts are removed.
- C3 Replies waiting on you (was "Inbox"): ChatGPT writes only the middle (the direct answer and the next step). The greeting,
  "Great to hear from you!", the closing line and the sign-off are fixed. The "Thanks for your email. I'll get back to you" holding
  reply is gone; if ChatGPT can't draft, the line stays in the 8 AM update with no draft.
- One S2 chaser: Canvas's Send RFP emails ("Quotation request | …", "RFP") are found by the same RFQ search.
- Business days skip Philippine holidays (the fixed national ones for the rest of 2026 and 2027; Script Property CUE_HOLIDAYS adds
  the proclaimed ones, such as Holy Week and National Heroes Day).
- Emails waiting (J11) is dropped: Canvas's card gets `on:false` and no threads. The 10-minute inbox read stays, because it feeds the
  project logs.
- Chaser labels carry their message-map IDs (C2, C6, C7, S1, S2, R5/R6). Rules › Chaser rules lists C2; Jobs › Chasers shows C2 and
  C3 with their templates.
- Moved to part 3 (each needs a Canvas change): parking a contact after C2 (no stage-move bridge action), C4 accreditation status
  (Cue has no per-company P4 data), C7 from AccountsPayables@, S1 from info@, turning off Canvas's own Team Cue RFP chaser, the crew
  chasers, and the banner image. C3's 2-business-day wait and client-only filter come with the Trackers (part 4).
- One "Threads" (Kiko 1 Nov 2026, screenshot: "two words here that says Threads. remove the 2nd", and 7 on the button vs 6 in the
  list): the pane header no longer repeats "Threads" and its count; the ☰ Threads badge counts threads waiting on Kiko (as the
  list's Waiting on you does), not tasks, so a thread with two waiting tasks counts once.
- Tests: 576 (6 new in test/features/74-chaser-templates.js; payment, RFQ, award, accreditation, funnel, admin, brand voice and
  mail alert tests updated to the new wording). FEATURE-MAP.md regenerated.

## Cue 1.27.91: the 8 AM update, quiet jobs, new morning times, background switches (not deployed)

Asked by Kiko on 31 Oct 2026 in the cloud chat ("right now i wanna fix the messages being sent by Cue to me. i get overwhelmed").
Spec cue-message-redesign-spec.md approved ("yes", with rules R1 to R4); mockup approved ("ok", after "if we can break it down
further with the levels i gave earlier"). This is part 1 of 4. Built on top of PR #269 (Canvas look), on the live line.

- 8 AM update (new Schedule row "8 AM update", daily 08:00, `CueMorning.gs`): one message in the main chat in Kiko's levels:
  Critical today (task and scheduled reminders with a time), Yesterday's summary (project threads worked on, chasers sent, bids
  found, contacts added, releases), Today's work (assigned to you, needs your review or approval, time to follow up, blocked), and a
  numbered For your OK list (the morning batch's chasers, new contacts, new bids, Friday client updates). No AI call. Empty levels
  are left out (R1). If the 07:00 batch is still drafting at 8:00 it waits and goes out as soon as the batch is ready (by 10:00).
- Kiko replies in words: "send all", "send 1, 3", "add 4", "start 6", "no 2" (in the main chat or the update's thread). Chasers
  he names go out at once from the batch (no 9:00 wait); the ones he does not name are skipped today and come back on their next
  day. "add" adds the named contacts to Canvas, "start" starts a bid's intake, "send"/"no" sends or skips a Friday update. Cue
  answers in one line ("Done: 3 chasers sent, 1 contact sent to Canvas.").
- Quiet jobs (R2): while the 8 AM update is on, the morning batch, bid check, sales funnel, Friday status, New mail and the
  approved-send line post nothing to the main chat (their threads keep their lines). A failure still says so. The new contacts card
  is made once a day inside the update's thread instead of in the main chat. Turning the 8 AM update off in Cue Admin brings the
  old posts back.
- New morning times (applied once to the existing rows): bid check 06:30, sales funnel 06:45, Friday status Fri 06:45, so all are
  ready for 08:00. The ChatGPT daily plan row is turned off once (the 8 AM update replaces it, decision D4).
- Cue Admin › Jobs › Scheduled tasks: new rows with On switches for the background jobs that had none (New mail, New contacts from
  Gmail, Client accreditation mail, CRM work); a Silent label on the jobs that keep out of the chat; their descriptions say the
  results are in the 8 AM update; no Change time button on background rows.
- Not in this part (spec parts 2 to 4): chaser rules and templates, sender changes, the Canvas release for supplier and crew
  emails, the Shared Task Tracker and TRI Tracker (personal tasks), proposed stage moves, and the one-ping urgent email (K2).
- Tests: 570 (5 new in test/features/73-morning-update.js; BD5, BD9, SC2, SC4, SC8, ST7 updated for the new times and quiet
  posts). FEATURE-MAP.md regenerated.

## Cue: Canvas look without magenta, lists, sent times, thread colours, bigger logo (not deployed)

Asked by Kiko on 31 Oct 2026 in the cloud chat "Test". Mockups C2 and D2 approved ("perfect"), and the thread colours approved ("A").
Built on the live release (1.27.90, branch claude/project-thread-y5l4x9-rel12790), not on main, which is behind live.

- No magenta: the "needs you" colour is now Canvas violet #23006F (Threads count, needs-you marks). The logo keeps its gradient.
- Sent time: every message in the chat and in threads shows its time under its box, outside it, on the left for Cue and on the
  right for Kiko ("1:39 PM" today, "Oct 30, 4:12 PM" before).
- Lists: lines starting with "1." / "1)" / "-" show as real numbered or bulleted lists, with indented sub-points; a reply that
  runs "1) … 2) …" in one paragraph is split into a list. The chat prompt now asks Claude to put each option on its own line.
- Thread colours: a thread's header band and its row's side stripe are cyan (#559FEF) for project updates, orange (#CD5023) for
  CRM and funnel, and violet (#23006F) for the rest. CRM wins when a thread is both. HubSpot is not counted as CRM (being removed).
- Logo bigger: 30px to 40px standalone, 22px to 32px inside Canvas. "Threads ›" before an open thread's name is gone.
- Reply line (Kiko 31 Oct: "If you have any questions or clarifications, feel free to hit reply."): the accreditation chaser's
  fallback uses it. test/fixtures/ZapBridge.gs is refreshed from Canvas V364 (PR #377: email wording only, no bridge call changes).
- "Close older runs" (Kiko 31 Oct, screenshot of the chat full of "Closed with "Close older runs"" lines): one main-chat line,
  "Closed N older runs. Nothing was written or sent.", instead of one line in every closed thread (each surfaced in the main chat
  with an "Earlier task" row). The old copies already in the chat are hidden. Test C40 updated.
- Tests: 565 of 565 pass.

## Cue 1.27.90: Ask Cue works again (BUG FIX, LIVE as Version 185, 30 Oct 2026 09:48Z; rollback Version 184)

Kiko, 30 Oct 2026 09:36Z: "Ask Cue is not working"; 09:38Z: "nothing. it doesnt do anything". Built as Cue PR #265 (branch
claude/project-thread-hmigp5 @ fa8fc34), numbered by the deploys thread.

- 1.27.89 added a second page function named todayHtml (the Today's tasks card) in IndexThreads.html. It replaced the chat's own
  todayHtml(day, th), so the Ask Cue chat threw an error while drawing and did nothing. The card function is now todayTasksHtml.
- New test AK1 fails if two page functions share a name.
- Tests: 565 pass.

## Cue 1.27.89: card overhaul phase 2, where cards go (LIVE as Version 184, 30 Oct 2026 09:06Z; rollback Version 183)

Kiko approved the card review page (https://claude.ai/artifact/TswYWLj6nLSsq3vLfhXrf1) on 30 Oct 2026 at 07:59Z. At 08:50Z: "usage is
running low make sure that we deploy the new cards". Built as Cue PR #264 (branch claude/project-thread-xwyfm7 @ b08ab46), numbered by
the deploys thread.

- Four scheduled jobs are turned off once each, through schedule seed v10 and the CUE_SCHED_OFF_ONCE property. They stay in Settings
  and can be turned back on: the Monday HubSpot check (Kiko 07:45Z "dont include"), the Thursday funnel records review and the Monday
  sales funnel review (duplicates of the Sales funnel card), and the Unscheduled check (the Today's tasks card replaces it).
- A Today's tasks counts card sits at the top of the Morning thread, and the task lines leave the Morning batch card. The counts come
  from Canvas's cueRows today field (Canvas V358 card overhaul). Until Canvas ships, the card shows only the Personal row.
- New mail buttons match the review, and a drafted reply shows "Reply ready" with Send reply.
- Tests: 564, all passing.

## Cue 1.27.88: card overhaul phase 1, the look (live as Version 183, 30 Oct 2026 08:33Z, rollback Version 180)

Kiko approved the card review page (v40) on 30 Oct 2026 at 07:59Z by tapping "Yes, build it" in the thread "Redesign all Cue cards to
brand and UI rules". Phase 1 changes the look only: brand fonts (Quicksand for the interface, Steagal for display text), purple main
buttons and table headers, matching Canvas PR #354. Routing (phase 2) and card flows (phase 3) come later as separate builds.

- `src/Index.html` loads Quicksand in place of DM Sans and Archivo Black. `src/IndexStyle.html` sets the brand fonts and colours.
- Built as Cue PR #264 (branch claude/project-thread-xwyfm7), stacked on 1.27.87. Numbered by the deploys thread.
- Tests: 561, all passing.

## Cue 1.27.87: Kiko's UI rules on every card and table (live as Version 183, 30 Oct 2026 08:33Z, rollback Version 180)

Kiko, 30 Oct 2026 06:12Z: "add to UI rules. Tables: Headers are always aligned Center. Columns with Financial values are alignes
Center. All rows are aligned in the middle. Table headers have darker colors on in bold or a size bigger than the values. Overall:
Headers are either in bold, darker colors or a size bigger than the value. Value should be lighter, never in bold, a size smaller than
the header. Buttons - aligned bottom right. Labels - should never look like buttons. Icons with Labels - always aligned middle".
Builds on the dark field names in the bid card release (1.27.85).

- Table headers are dark, bold and 14px; table values are regular weight and 13px, and bold inside a value cell is turned off.
- The field-name column of a facts table is dark, bold and 14px, like a header.
- Section headers (Needs you, Today and the like) and folding section titles are dark, bold, 14px and in sentence case, a size above
  the 13px card text. Field names on cards (`.fk`) are 14px over their 13px regular values. Bid card field lines keep the style Kiko picked at
  06:15Z (accent name in its own column, 600, same size as the value).
- Card buttons sit at the bottom right of the card, and dialog buttons too.
- Tags (New, Preferred, For verification) have square corners, a 600 weight and an arrow cursor, so they no longer look like the round
  pill buttons.
- Buttons lay out their icon and words on one centred line, and icons beside tags, field names, section headers and Settings items
  sit in the middle of the line.
- Style only: the UI-RULES block at the end of `src/IndexStyle.html`. No data, server, bridge or email change.

Tests: 561, all passing. UR1 to UR5 are new (`test/features/70-ui-rules.js`).

## Cue 1.27.86: project emails stay in Team Cue (live as Version 183, 30 Oct 2026 08:33Z, rollback Version 180; built as 1.27.85, renumbered by the deploys thread)

Kiko, 30 Oct 2026 05:50Z, in the thread "Cut Ask Cue thread overload": "emails is retained depending if its a project email or not -
project emails stay in Team Cue others are in Ask Cue". Before this, New mail and the Morning batch dropped a project's email only
when its subject or first line named the project's ID. An email Canvas files under a project by its sender still showed in Ask Cue
as well as in the project's thread in Team Cue.

- New mail and the Morning batch's inbox lines now also leave out any of Kiko's inbox threads that Canvas's Emails waiting list (bridge
  read `mail_waiting`) files under a project. Canvas is read once per run, and only when there is new mail. When Canvas cannot be
  read, nothing more is dropped.
- A New mail line that the sort later finds under a project is marked done with the words "A project email: it is in the project's
  thread in Team Cue." It is never deleted.
- info@ mail is unchanged.
- `cueMailProjectThreads_` in `src/CueTriage.gs`, used by `cueTriageFind_` and `cueNmFilter_`. There is no new bridge action, no AI
  call and no email.
- The Canvas half, which hides the no-project Emails waiting row from Kiko's Team Cue, ships separately.

Tests: 552, all passing. NM5 is updated, and SJ5 is new.
## Cue 1.27.85: tidier bid cards with Cue's copy of each notice (live as Version 183, 30 Oct 2026 08:33Z, rollback Version 180)

Kiko, 30 Oct 2026 05:52Z, on the bid card: "make the buttons smaller. its almost half of the card already. make labels not look like
buttons. dont we have a standard look for labels and buttons? Summary of requirements: What about audio and visual? what actions are
requested from us? add more details - if theres a document attach it to the card". At 05:53Z: "yes in saving a copy of the notice".

- Every button on a bid card is the small standard button (Brand.html `.btn.sm`: 30px high, 12px text). Cue's style sheet gains `.btn.sm`.
- The source on each notice ("PhilGEPS (old site)") is the standard label (`.tag`), no longer a filled purple chip that looked like a button.
- Cue saves a copy of each old PhilGEPS notice page as a PDF in the notice's Drive folder, once, and links it on the card as
  "Notice: Cue's copy (PDF)". It opens even when PhilGEPS fails in Chrome. A site error is tried again at the next run.
- The same page fills the card: Summary of requirements is now the agency's own description, in place of the category and procurement
  mode. Category (the site's category and mode) and Delivery period show on the card. Solicitation number, document requests so far and
  the contact person show under View details.
- What the old site does not give: the bid documents themselves (the RFQ form, TOR) sit behind PhilGEPS's paid Order step, so Cue does not
  fetch them. Read in Kiko's Chrome on 30 Oct: none of three notice pages had a free file link.
- Tests: 554 (test/features/69-bid-view-opportunity.js: BO2 to BO4). The test harness's blob gains `getAs` for the PDF.

Added the same day, before it shipped (darker field names and section headers):

Kiko, 30 Oct 2026 06:06Z: "why is the Header always lighter than the text? Make headers darker. and text not in bold. or make headers a
size bigger that the text".

- On cards, the name in each "Name: value" line (Organization, Bid end date, Budget, Summary of requirements and the rest) is now dark
  and bold (`.fk`), where it was light grey. The value is regular weight (`.card .small` 400, was 500).
- Section headers (`.label`, such as "NEW: FOR CLARIFICATION") use the text colour, where they were light grey.
- Same size as before: Kiko gave darker headers first and a bigger size as the other choice.
- Tests: 555 with this on 1.27.85 (BD6 and BO4 now check the two-column markup) (BO5 in test/features/69-bid-view-opportunity.js).
- Kiko, 06:15Z: "Summary of requirements value - aligned Justify". The Summary of requirements value on bid cards is justified.
- Kiko, 06:15Z, with a picture of Canvas's "Account  Manulife Philippines": "follow this for header and value". Each field line on a bid
  card is now two columns: the name in the accent colour (600 weight, no colon) and the value, regular, beside it (`.kv` in IndexStyle.html).
- Kiko, 06:17Z: "use spacing in between lines. they are too tight". Field lines get line-height 1.6 and 10px between rows.
- Kiko, 06:21Z: "on load View Details > exepands View Details becomes View Opportunity". On load a bid card shows View details only. Tapping
  it opens the details, and the button turns into View opportunity in the same place. A notice without its own page keeps View details / Hide details.

## Cue 1.27.84: View opportunity on bid cards (live as Version 180, 30 Oct 2026 05:49Z, rollback Version 179)

Kiko, 30 Oct 2026 05:37Z, on a PhilGEPS bid card ("Procurement of Office Supplies", Amang Rodriguez Memorial Medical Center,
13318074): "this should have a view opportunity which opens the bid itself from the main website". At 05:38Z: "all links when clicked
lead to a The page isnt working".

- Every bid card (Scoped, For clarification, Closing) gets a **View opportunity** button right after View details. It opens the
  bid's own page in a new tab. Old PhilGEPS site notices open by reference number
  (`SplashBidNoticeAbstractUI.aspx?refID=<ref>`, a public page). Bulletin Board notices open `philgeps.gov.ph/tenders/viewBidNotice/<ref>`,
  which needs Kiko's PhilGEPS sign-in. Other sources open the notice link the scan found.
- Official notice under View details stays as it was.
- Why links showed "This page isn't working": a read-only check in Kiko's Chrome on KKD (30 Oct) found the notice link itself works
  when opened fresh, and the same link loads fine without cookies. After a few visits the old PhilGEPS site's session cookie goes bad
  and the site loops redirects (ERR_TOO_MANY_REDIRECTS), so every link to it fails in that browser until the cookie clears.
- Tests: 551 (new test/features/69-bid-view-opportunity.js).

## Cue 1.27.83: a tidier Ask Cue list (live as Version 179, 30 Oct 2026 05:42Z, rollback Version 173; built as 1.27.78, renumbered by the deploys thread)

Kiko, 30 Oct 2026 03:24Z, on the Ask Cue thread list: "i felt overwhelmed by this. coz there's so many... then i realized that
some of these are duplicates as well. can we remove the duplicates? and can you a schedule on when the jobs would run". The
schedule page (https://claude.ai/artifact/VZ3edagU6YpS8V4fsR9WdM) showed that no job runs twice. The list grows for two
reasons: older runs of the same job stay open, and several jobs cover one subject. Kiko picked "Yes, both changes" on the
card "Clean up Ask Cue as shown in the After picture?" at 03:55Z.

- Older runs close. When a scheduled job starts today's run, its own runs from earlier Manila days that still wait (Needs you or
  Failed) close, with one line in their thread: "Closed: today's run of this job replaced it. Nothing was sent or changed." This
  covers the ChatGPT tasks, the bid check, the Monday HubSpot check, the pipeline review, the Friday status updates and the
  release notes. The morning batch and the sales funnel already did this. An approved run or a phased intake never closes. This
  replaces the 24 Oct choice that these jobs wait for the "Close older runs" tap; the button stays.
- One thread per subject per day. The thread is named "Morning · Fri 30 Oct", "Sales · Fri 30 Oct" or "Friday events · Fri 30 Oct".
  Morning holds the morning batch, Plan today's tasks and the unscheduled check's question. Sales holds the sales funnel, Prospect
  follow-ups, the pipeline review and the Thursday funnel records review. Friday events holds the Friday status updates and Friday
  production readiness. The first job to run starts the thread, and the others join it, so every card still shows. A run Kiko
  starts by typing keeps its own thread. The Monday sales funnel review posts lines in the chat, not a thread, so it is unchanged.
- New file `src/CueSubjects.gs`; `cueSchedRun_` calls it after a scheduled task starts. No AI call, no Canvas call, no email.

Tests: 529, all passing (new SJ1 to SJ4 in `test/features/66-ask-cue-subjects.js`; FEATURE-MAP.md regenerated).

## Cue 1.27.82: Claude answers Ask Cue chat and looks things up first (live as Version 179, 30 Oct 2026 05:42Z, rollback Version 173; built as 1.27.81, renumbered by the deploys thread after the award chaser build took 1.27.81)

Kiko said on 30 Oct 2026 at 03:45Z: "it feels like Cue needs to be taught of the basics while its trying to learn complex processes...
so Cue seems dumb", then "cant i just chat with Claude as Cue?" and at 03:50Z "if Cue is dumb as a rock and i cant put Claude there
so i can chat with someone smart - then there's no use for Cue". At 03:53Z he picked "Claude inside Ask Cue" on the decision card
(comparison page https://claude.ai/artifact/EMcGXUqKNTjP9oe7ckm98i).

- Why Cue felt dumb: every chat message was one GPT call that had to fill a long form (which of about 15 jobs, and its fields) with
  no way to look anything up first. Wrong guesses were patched with word rules after each PC test.
- Now Claude (Sonnet 5.5, low effort) answers every Ask Cue chat message (`CueAgent.gs`, called from `cueTalk_` in `Cue.gs`). Before
  it answers it may look things up with read-only tools, the Cue basics: `find_contact` (Canvas P0 Contacts, then Kiko's Gmail, never
  guesses), `search_gmail` and `read_email` (sender, recipients, date, thread, body, attachment names), `find_project`, `canvas_tabs`
  and `canvas_read` (only the tabs on Canvas's allow-list), and `add_work_days` (Monday to Friday; Philippine holidays are not known
  yet, and the tool says so).
- Claude ends by calling an `answer` tool whose fields are the same chat form as before, so every job, card and approval works as it
  did: nothing is sent or written from chat, and an email still goes only when Kiko taps Approve and send.
- At most 6 rounds and about 150 seconds per message. When Claude cannot be reached, refuses, runs out of room or never answers, the
  old one-call form answers instead, so Kiko always gets a reply. Every round is logged in AI Runs, so Settings > AI usage and cost
  shows the real cost per chat. The estimate is about P2 to P4 per chat against about P0.25 before.
- Cue's rules, voice and tool list are sent as a cached prefix, so repeat rounds and chats read them at the cache price.
- Tests: 546 on the deploys line (6 new in test/features/68-claude-brain.js, including "find Ruth at Moldex's email" and the AMI Group ask).

## Cue 1.27.81: Send follow-up and Open in Canvas on urgent CE award chasers, foldable Morning batch (live as Version 179, 30 Oct 2026 05:42Z, rollback Version 173)

Cut on live 1.27.77 (Version 173). Builds 1.27.78 to 1.27.80 belong to other threads; the deploys thread stacks them. No Canvas
release is needed: Open in Canvas uses the project link Canvas already reads. Tests: 540, all passing on the deploys line (1.27.80 + this).

Kiko asked on 30 Oct 2026 at 03:21Z, with a screenshot of the CE award chasers in the Morning batch: "how come there is no send
follow up button?". It was not a bug. The CE award chaser spec approved on 21 Oct made a project whose event is within 7 days,
or already past, an "urgent" flag with no draft, so those lines had only Skip today and Stop chasing. At 03:26Z he added "can you
also make cards foldable and expandable?". He saw the mockups and picked "Yes, build all" on the decision card at 03:54Z.

- **Send follow-up.** When the event is within 7 days and Kiko's CE thread is waiting on the client, the line now carries an
  urgent draft, written in the batch's one ChatGPT call (template when ChatGPT is down). The draft asks kindly for a decision
  today and never quotes the CE total. The line has no tick and is not part of the 9:00 send. Kiko edits the box and taps Send
  follow-up: that one email goes at once from his Gmail, as a reply in the CE thread. The tap is his approval of that email only.
  The button works until the batch is closed, also after Approve and send. A second tap sends nothing. The send is counted in
  the Chase log and the project log, like a batch send. When there is no CE thread, no client address, or the client replied,
  the line stays a flag ("Call the client today") as before.
- **Open in Canvas.** When the event date has passed, the line gets Open in Canvas, which opens the project's Main tab (viewer
  pane on a PC, new tab on a phone) so Kiko can set the award status.
- **Folding.** Each kind in the Morning batch (for example "CE award chasers (15)") folds like the Project intake card's sections;
  only the first starts open. Each line folds to one row: its name, its tags and a short note (the event date for award lines, the
  person for other chasers). The tick stays on the row, so Approve and send works on folded lines. What Kiko opens or closes stays
  that way when the page redraws.
- Code: `cueAwardItem_` and the award template and brief (`src/CueSweepAward.gs`), `cueSweepSendOne` and the tap line kept out of
  the batch send (`src/CueSweep.gs`), the view fields `tap`, `short`, `canvas_url` (`src/Cue.gs`), the card
  (`src/IndexPages.html`), its button (`src/IndexCards.html`) and fold styles (`src/IndexStyle.html`). Tests A6, A6b, A6c, A6d
  in `test/features/17-award-chasers.js` (A6 replaces the old "urgent with no draft" test).

## Cue 1.27.80: Cue finds contacts' email addresses (live as Version 179, 30 Oct 2026 05:42Z, rollback Version 173)

Kiko asked on 30 Oct 2026 at 03:33Z: "can you please teach Cue now how to find contacts! what the format of an email address is!!
how to find it where to find it!!!". At 11:26 to 11:34 Manila that day he asked for Rommel Siena and Archie's addresses on the AMI
Group account follow-up. Cue searched Canvas projects for the names, then said "I can't look up contact emails from chat".

- What an email address is: `cueEmailClean_` (CueText.gs) takes "Name <a@b.com>", "mailto:a@b.com?subject=x" or "<a@b.com>," and
  keeps the bare address in lower case. It must be local@domain.tld: no spaces, no two dots in a row, no dot at either end of the
  name part, domain labels of letters, digits and hyphens, and a top-level domain of 2 or more letters. A To line can hold several
  addresses separated by commas (`cueEmailList_`).
- Where Cue looks, in order (CueContacts.gs, read only, no AI call): Canvas Client Desk P0 Contacts by Contact Name; then the From,
  To, Cc and Reply-To headers of Kiko's Gmail for the last 3 years; then the text of the newest 5 of those emails (an address on the
  person's line or the 3 lines under it). Names match on every word, short forms of 3+ letters, and one letter off for words of 5+
  letters ("Sienna" finds "Siena"). An address on the company's domain, then the most used, goes first; others are named.
- Cue never makes up an address. When none is found, it says where it looked.
- "Draft an email" to "Rommel Siena and Archie" now fills To with both addresses and says where each came from. A company alone
  gives its one contact on file, or lists them when there are several. A typed To that is not an address says what one looks like.
- The chat call gets the addresses of people Kiko names (in an email's thread, or when the message is about an email, a contact or an
  address) and is told that a name is a person, not a project, unless it matches a Canvas project.
- Not in this release: HubSpot contacts (needs a Canvas bridge read), RFQ attachments, and web or LinkedIn searches.
- Tests: 459 (7 new in test/features/67-contact-find.js).

## Cue 1.27.79: accreditation threads in Ask Cue; the Gmail contact scan skips no-reply senders like chrome-noreply@ (live as Version 179, 30 Oct 2026 05:42Z, rollback Version 173)

One release on live 1.27.77: the bug fix below plus the accreditation feature built as 1.27.78. Tests: 530, all passing.

### Gmail contact scan skips every no-reply sender

Bug fix, found by the Gmail new contacts thread while watching the first live run of 1.27.77 (29 Oct 2026, 17:34Z): the tab "New
contacts" kept chrome-noreply@google.com. Kiko's yes on 29 Oct 13:40Z ("Yes, skip them") covers no-reply senders, but the match only
caught no-reply at the start of the address. Built on live 1.27.77 (Version 173).

- No-reply now counts anywhere in the name part before the @ (chrome-noreply@, info.noreply@, noreply+x@). notifications@,
  mailer-daemon@ and bounce@ match as before.
- Rows already in the tab from earlier runs are marked "Skipped: automated sender" before Canvas checks them, so they never reach a
  card.
- The 3-year read failed every other run on 29 Oct ("Gmail did not list messages", no reason shown). The list call now tries
  once more after 2 seconds, and a failure names Gmail's HTTP status and message in Job Runs.
- Tests: 526, all passing (CN6 new; CN1 adds chrome-noreply@ to its automated senders; CN2 checks the HTTP status in the error).

### Client accreditation threads in Ask Cue (built as 1.27.78)

Kiko asked on 29 Oct 2026 at 16:14Z: "any reply for accreditation shows there as well" and "accreditation threads". At 17:24Z he
picked "P4 companies + accreditation words" on the card "Which emails go into a company's accreditation thread?".

- **One Ask Cue thread per company, "Accreditation · <company>".** Every 30 minutes the 5-minute job ("Client accreditation
  mail") searches Kiko's Gmail for the last 3 days: any email from a company at P4 (its P0 Contacts domain, or the person's
  address when it is a personal one such as gmail.com), plus any email whose subject says accreditation, accredited, vendor or
  supplier registration, or vendor enrolment. Kiko's own emails and BSE staff are left out.
- Each new reply is one short line in its company's thread: who, when, the subject, Gmail's preview and an **Open email** link.
  The thread waits on Kiko until he taps **Done**; the next reply opens it again and is marked New. **Open Accounts in Canvas**
  opens the company in Accounts.
- The company is the P0 Contacts company of the sender's address or domain, else the sender's email domain. Each message posts
  once: its id goes to the Cue sheet's new "Accreditation Mail" tab.
- Read only. Nothing is sent, labelled or changed in Gmail or Canvas. No AI call. A cloud check never runs it.
- New `src/CueAccred.gs`, the card in `src/IndexPages.html`, tests AC1 to AC4 (`test/features/66-client-accreditation.js`).
  529 tests pass on top of live 1.27.77.


## Cue 1.27.77: Gmail new contacts, Start intake on RFQ/RFP emails, centred tables, daily sales update, standard tags (live as Version 173, 29 Oct 17:30Z, rollback 171)

One release cut by the deploys thread on live 1.27.76 (Version 171), after Canvas V353 shipped the Canvas halves (bridge
`contact_new_check` / `contact_add`, the Emails waiting Start intake button, table short columns). The builder threads numbered
their parts 1.27.71, 1.27.73 and 1.27.x; they ship together here as 1.27.77. Bridge fixture refreshed from Canvas V353.
Tests: 525, all passing.

### New contacts and companies from Kiko's Gmail

Card gmail-new-contacts. Kiko asked on 29 Oct 2026 in the backlog thread to "add contacts and accounts from gmail scan", and
answered the questions at 13:14Z: "1. my email only 2. one time 3 year scan 3. senders and people copied 4. P0 unless there are
contacts 5. once for the 3 year rewind. then we run weekly for ongoing emails". Spec `specs/gmail-new-contacts.md`.

- **What it reads.** Kiko's own Gmail only, read only, in his account (the 5-minute job "New contacts from Gmail"). Each email is
  read as headers only: From, Cc and Subject. No body and no attachment. The first window is the last 3 years, read a few
  hundred emails at a time; after it is read, one window a week covers the mail since the last one. Every person found is one
  row of the new Cue sheet tab "New contacts".
- **Canvas checks each person** (bridge read `contact_new_check`): already in Canvas (P0 Contacts, PROJ Contacts or the Admin
  Directory), or the company they would go to. One email domain is one company. A company already in P0 keeps its P stage; a
  company not in P0 starts at P0.
- **One Approve card at a time**, with at most 25 companies and 40 people, new companies first. Every person has a tick. Title,
  company and phone come only from the signature lines of that person's own emails, with the old-email contact scan's reader
  and one Claude Haiku call per 20 people. Approve sends the ticked people in one `contact_add` (a claimed plan's write); Canvas
  adds the P0 and P0 Contacts rows and logs each in CRM Auto Added, so Accounts › Auto add's Undo takes it back. Skip page adds
  nobody. The next page comes on the next run. No email, no HubSpot write.
- "scan my gmail for new contacts" runs the job at once and says how far it is.
- Needs Canvas with `contact_new_check` and `contact_add` (CanvasWorkspace branch claude/project-thread-t7caj1); the bridge
  fixture is refreshed from it. Until that Canvas ships, the job reads Gmail and stops at the Canvas check.
- Automated senders are skipped and never kept: no-reply@, noreply@, do-not-reply@, notifications@, mailer-daemon@ and bounce@
  addresses (Kiko 29 Oct 13:40Z, "Yes, skip them").
- R1 (Kiko 29 Oct 14:02Z, "approve"): Canvas skips personal addresses (Gmail, Yahoo, Outlook, Hotmail, iCloud), known suppliers
  (an email or a business domain in the Supplier Database, Main and Supplier Contact) and BSE staff (blankspaceevent.com). They
  never reach the card; their row says why ("Skipped: personal email", "Skipped: supplier", "Skipped: BSE staff"). Canvas checks
  again at Approve, so a supplier added in between is skipped then and counted in the reply.
- Tests: 491 (CN1 to CN5 for this feature).

### Emails asking for a quotation or proposal start intake

Kiko, 29 Oct 2026 15:13Z, about Moldex's "Request Quotation" email on his Emails waiting card: "i dont think it sensed that its for
intake - keywords - Request for Quotation, Request for Proposal and variations of it". This release needs Kiko's yes and Canvas's
part (CanvasWorkspace PR #313).

- **New mail:** an email whose subject says Request for Quotation, Request for Proposal, RFQ, RFP or a variation (Request Quotation,
  Request for a quote, Quotation request, Proposal request) is a new inquiry, even when the sort calls it FYI or skip.
  A known supplier's reply ("Re: Request for Quotation") is left as it was: Kiko's card answer 29 Oct 15:20Z, "No, skip supplier replies".
- **Emails waiting:** Cue marks those emails in the file Canvas reads (`rfq: true`). Canvas's card then shows **Start intake**. Tapping it
  opens Cue, which reads the email and its files in Kiko's Gmail and starts intake, the same as Start intake on the New mail card.
- Tests: 497, all passing (`test/features/64-rfq-intake.js`, RI1 to RI5).

### Table headers, numbers and short columns centred

Kiko set a standing UI rule on 29 Oct 2026 at 14:32Z: "UI rule - for tables where the table values are numbers - align center.
Headers are always aligned center".

- Every table header in Cue (chat cards, Finance and pipeline cards, CE and requirement lines, Settings and Cue Admin tables, AI usage)
  is centred.
- Kiko added at 14:51Z: "middle align tables for short columns and the headers". A column whose filled cells are all 12 characters
  or fewer (status, P-stage, date, yes/no, code) is centred whole. Columns with buttons or text boxes are left as they are. Every table cell now
  sits in the middle of its row instead of at the top.
- A cell whose value is a number (amount, count, percent) is centred, and so is a number box in a table. A column whose filled cells
  are all numbers is centred whole, so its dashes line up. Long text is unchanged. Key/value "facts" tables are left as they are.
- The same rule ships in Canvas (main V349, Client C215), with the same number test. CLAUDE.md and the scope-then-design Brand lock
  now carry the rule, so mockups follow it too. Version number is provisional; the deploys thread names the release. Tests: 456.

### Standard tags

- Cue's tags use the standard Canvas label (`.bs-pill` look, Kiko 29 Oct 2026 14:48Z to 14:51Z: "make it a standard UI"), and
  CLAUDE.md carries the label and table rules.

### The Sales funnel becomes a daily sales update

Kiko asked on 29 Oct 2026 at 15:59Z: "can you align the Sales Funnel in Ask Cue with the latest that we did". A first build put
Canvas's Accounts dashboard into the card; Kiko then said at 16:13Z "it has to be able to give updates not a dashboard. you cant
fit a dashboard in a chat window", and "yes." at 16:14Z to: what moved since yesterday, what is due today, and a link to Accounts.

- **The 7:00 Sales funnel run is now a sales update.** Cue reads the P0 tab (through Canvas's `read_rows` when it is
  allow-listed, else directly) and keeps each company's P stage. It compares them with the last run and writes a few plain lines:
  which companies moved (for example "VXI P1 to P4") and which are new on the list, follow-up emails due (P1 and P2, 3 business
  days since the last email and no reply, the rule Canvas's dashboard uses), Canvas follow-ups due by tomorrow, deals waiting for
  award and deals gone quiet, and projects at risk or escalated (P8 and P9).
- **No dashboard in the chat.** The thread shows the lines and an **Open Accounts in Canvas** button. The bars, cards and counts
  stay on Canvas's Accounts dashboard. The thread's message carries only the first line, so nothing shows twice.
- **The Today row** is the update: its first line as the title and the next two as the detail, with Open update.
- **The Monday sales funnel review** gives ChatGPT the P stage counts as well.
- **HubSpot tasks are kept** as they were.
- Names: the Scheduled tasks row is "Sales funnel"; Cue Admin's description says what it reads now.
- Nothing is written to Canvas or HubSpot. No AI call on the update. Tests: 492 (6 new, FP1 to FP6).

## Cue 1.27.76: Back to Team Cue button, and Canvas's CRM and To do in Ask Cue's list (live as Version 171, 29 Oct 16:26Z, rollback 170; Canvas V353)

Asked by Kiko on 29 Oct 2026 at 15:59Z: "can there be a button in Ask Cue that switches me back the other chat". At 15:56Z he
also said Ask Cue keeps its own threads ("Ask Cue can still have its own threads like Job reports, Project Intake, actually CRMs,
chasers and other CRM related can be in Ask Cue"), so the dropped builds 1.27.74 (no daily tasks-waiting list) and 1.27.75 (Ask
Cue's list moved into the Canvas panel) are not in this release. Built on 1.27.72; cut by the deploys thread on live 1.27.72 (Version 170).

- **Back to Team Cue.** When Ask Cue is open inside Canvas, its header shows a "Back to Team Cue" button. It asks Canvas
  (`{canvasWs:'cueBack'}`) to close Ask Cue and open the Team Cue panel; Canvas needs its matching release (CanvasWorkspace PR
  #338). Cue opened on its own never shows the button.
- **Canvas's CRM and To do rows in Ask Cue's list.** Kiko's card pick on 29 Oct 16:01Z: "Inside Ask Cue's list". Inside Canvas,
  Canvas sends its CRM and To do rows (`{canvasWs:'cueRows'}`, name, latest line and count only); they show under "From Canvas"
  at the top of Threads. A tap asks Canvas (`{canvasWs:'cueTeam'}`) to show that thread with all its buttons (Log call, Done,
  Tomorrow, Open client), and its "‹" comes back to Ask Cue. Canvas's Team Cue list no longer shows those two rows for Kiko.
- Tests: 505, all passing on top of live 1.27.72 (`test/features/64-team-cue-back.js`, TCB1 and TCB2).

## Cue 1.27.72: RFQ drafts say TBC for blank event details; typed intake reads the email it names (live as Version 170, 29 Oct 16:19Z, rollback 168)

Backlog card intake-real-check (High, 29 Oct 2026): intake was built but had never run on real inquiries. The coordinator asked
this thread to prove it end to end (from Gmail Start intake, from a screenshot and from an uploaded file) and to fix what breaks.
Built on the live line (1.27.70), then stacked on live 1.27.71 (Version 168) by the deploys thread.

- **Bug fix: RFQ drafts no longer print blank event lines.** On real inquiries the drafts read "Venue:", "City:" and "Expected
  pax: 0", and one made up an event date. Empty event details now go to GPT as TBC, and the RFQ prompt says never to invent a
  date, venue, city or pax.
- **Bug fix: an intake asked in words reads the email it names.** Kiko, 29 Oct 2026 16:08Z, after typing "find the latest email from
  Ms Ruth Andres in Gmail and run a project intake from it": "does project intake in Cue can not read email subject, header and attached
  files?". It could not: a typed intake read only his words. Now "intake … the email from <name or address>" finds that person's newest
  email in Kiko's Gmail (last 6 months) and runs Start intake on it, with Kiko's words added as his note. Start intake now also passes
  To, Cc and Date, not only From and Subject. Files: PDFs, images and text files are read, as before.
- **Cloud check for intake on real inquiries** (`test/checks/intake-real.check.mjs`, door functions in `src/CueIntakeCheck.gs`).
  It picks the newest inquiries Cue sorted (New mail's own sort, plus older Inbox triage lines), runs phase 1 for real, then
  phases 2 to 4 on a copy, so nothing is written to Canvas and nothing is sent. `intake-real.only.txt` next to the script narrows
  it to one named project. In a check, a new message never joins or reopens one of Kiko's own threads (`cueCheckMine_`).
- Tests: 503, all passing on top of 1.27.71 (`test/features/63-intake-real-check.js`, IR1 to IR6; `test/features/65-mail-intake.js`, MI1 and MI2).

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
