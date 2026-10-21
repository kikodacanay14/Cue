# Changelog

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
