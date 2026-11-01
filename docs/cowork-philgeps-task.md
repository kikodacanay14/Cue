# Claude Cowork task: new PhilGEPS check (paste into Cowork on KKD)

Set up once in Claude Cowork on KKD: Scheduled tasks → New → weekdays at 6:00 AM (Manila) → paste the text below. Keep KKD on,
Chrome open with Claude in Chrome, and stay signed in to PhilGEPS (tick "remember me"). Cue's 6:30 bid check reads what this task
writes; when it finds no RUN row for today, Cue's 8 AM update says "New PhilGEPS was not checked today".

---

You check the new PhilGEPS site for Blank Space Events (BSE), a Philippine events company, every weekday morning. Read only.

Rules
- Never register, sign up, pay, buy bid documents, submit, upload, send a message or change anything on any site. Only search,
  open and read. If PhilGEPS asks you to sign in or shows a CAPTCHA, stop and write a RUN row with "Signed out" in Notes.
- Never type or save a password.

Steps
1. In Chrome (signed in), open https://philgeps.gov.ph/BulletinBoard/current_oppourtunities.
2. Look at opportunities posted in the last 2 days. Search or filter for: events management, event, celebration, conference,
   congress, launch, exhibit, booth, lights and sounds, LED wall, audio visual, stage, fabrication, styling and decor, catering for
   an event, souvenirs, event printing.
3. For each result, check these three filters on the notice page first, before downloading anything:
   - Service: it is for an event or one of those kinds of work. Leave out plain purchases of goods that name no event (office
     supplies, stickers, printing of books or forms, uniforms, equipment for an office or school), and construction, ICT, medical,
     vehicle or janitorial work.
   - Location: NCR, Batangas, Laguna, Cavite, Rizal, Bulacan or Quezon. Never Bataan.
   - Budget: the Approved Budget for the Contract (ABC) is from PHP 50,000 to PHP 700,000.
   If any filter fails, skip the notice: do not open its documents and do not download anything.
4. For each notice that passes, read from its page: agency, reference number, title, location, ABC, date posted, closing date and
   time, a 1-line summary of what must be supplied, and the notice's own link.
5. Download every bid document the notice offers for free (Invitation to Bid, Terms of Reference, bid forms, bulletins, annexes).
   Never pay for or buy a document; if one costs money, write "Paid document not downloaded: <name>" in Notes. Upload the files to
   Google Drive, folder "PhilGEPS bid documents", in a subfolder named after the reference number. Do not read the documents:
   Cue reads them only when Kiko asks about that bid.
6. Open the Google Sheet "BSE Inbox RFP & Bid History 2022-2026", tab "Cowork PhilGEPS findings". If the tab does not exist, make
   it with this header row: Date (PHT) | Agency | Reference | Title | Location | Budget (ABC) | Posted | Closes | Summary | Notice
   link | Documents | Notes
7. Add one row per notice that passed (Date = today, yyyy-MM-dd; Closes as yyyy-MM-ddTHH:MM+08:00; Documents = the Google Drive
   links of the files you saved, separated by commas). Skip a reference number already on the tab.
8. Last, add one RUN row even when nothing passed: Date = today, Reference = RUN, Title = "Checked N notices, kept K", Notes =
   anything that stopped you (signed out, site down).
