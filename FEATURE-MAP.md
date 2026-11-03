# Cue feature map

Made from the code by `node tools/map.mjs` (structure review phase 1, item 1.1). Do not edit by hand: change the code and run
the script again. `test/cue.test.js` fails when this file is out of date.

Counts: 76 server files, 1483 top-level names, 34 task kinds, 35 word checks before the
chat call, 17 background jobs in the 5-minute trigger, 93 page-to-server functions, 65 bridge actions in the Canvas bridge copy.

## 1. Commands (task kinds)

A kind is the name a task carries from start to card. Each kind is one line in `cueCommands_` (`CueCommands.gs`): its run, its Approve
and its "stopped" line. "Wrong command?" is its name in that list (`CUE_ROUTE_CMDS_`). Card family is its line in the page's `kindOf`
(`IndexThreads.html`): Approve (one write Kiko approves), Draft and send (emails), Info (an answer or report) or Question (buttons that pick).
Page checks count the kind's remaining `kind === ...` checks in the page.

| Kind | What it is | Wrong command? | Card family | Runs in | Approve in | Page checks |
|---|---|---|---|---|---|---|
| `accred` | Page only (not in the command list) |  | Info | none | none | 2 |
| `ar` | ARs | ARs | Draft and send | `CueAr.gs` | `CueAr.gs` | 5 |
| `avoid` | Page only (not in the command list) |  |  | none | none | 1 |
| `bids` | Bid check |  | Info | `CueBids.gs` | intake (default) | 1 |
| `cecost` | CE cost update |  | Approve | `CueCeCost.gs` | `CueCeCost.gs` | 3 |
| `change` | Change request | Project intake | Draft and send | `CueIntake.gs` | `CueChange.gs` | 1 |
| `email` | Email | Email | Draft and send | `CueMail.gs` | `CueMail.gs` | 3 |
| `example` | Page only (not in the command list) |  |  | none | none | 2 |
| `expense` | Project expense |  | Approve | `CueIntake.gs` (default) | `CueExpense.gs` | 2 |
| `final` | Page only (not in the command list) |  |  | none | none | 1 |
| `finance` | Money question | Money question | Info | `CueIntake.gs` (default) | intake (default) | 3 |
| `funnel` | Sales funnel |  | Info | `CueFunnel.gs` | intake (default) | 1 |
| `gtask` | ChatGPT task |  | Draft and send | `CueGptTasks.gs` | intake (default) | 1 |
| `help` | Help answer |  | Info | `CueHelp.gs` | intake (default) | 2 |
| `inbox` | Page only (not in the command list) |  | Info | none | none | 4 |
| `intake` | Project intake | Project intake | Approve | `CueIntake.gs` | intake (default) | 0 |
| `mail` | Page only (not in the command list) |  | Info | none | none | 1 |
| `memory` | Learning your memory |  | Approve | `CueTeach.gs` | `CueTeach.gs` | 5 |
| `newmail` | Page only (not in the command list) |  | Question | none | none | 3 |
| `open` | Page only (not in the command list) |  |  | none | none | 1 |
| `own` | Page only (not in the command list) |  |  | none | none | 2 |
| `personal` | Personal expense |  | Approve | `CuePersonal.gs` | `CuePersonal.gs` | 3 |
| `process` | Learning your process |  | Approve | `CueTeach.gs` | `CueTeach.gs` | 3 |
| `readiness` | Readiness check | Readiness check | Draft and send | `CueReady.gs` | `CueReady.gs` | 1 |
| `relnotes` | Page only (not in the command list) |  | Approve | none | none | 1 |
| `staff` | Page only (not in the command list) |  |  | none | none | 1 |
| `status` | Friday status updates |  | Draft and send | `CueStatus.gs` | `CueStatus.gs` | 1 |
| `style` | Learning your style |  | Approve | `CueStyle.gs` | `CueStyle.gs` | 3 |
| `supplier` | Supplier registration |  | Approve | `CueSupplier.gs` | `CueSupplier.gs` | 4 |
| `sweep` | Morning sweep |  | Draft and send | `CueSweep.gs` | `CueSweep.gs` | 2 |
| `tasks` | Page only (not in the command list) |  |  | none | none | 2 |
| `tri` | Task, issue or risk |  | Approve | `CueIntake.gs` (default) | `CueTri.gs` | 1 |
| `vendor` | Supplier search | Supplier search | Draft and send | `CueVendor.gs` | `CueVendor.gs` | 1 |
| `workflow` | Workflow map | Workflow map | Approve | `CueWorkflow.gs` | `CueWorkflow.gs` | 1 |

## 2. Routing order

Who answers which words first. `cueSendWith_` (in `Cue.gs`) goes down `cueRoutes_` (`CueCommands.gs`); the first that answers wins.
If none answers, the AI chat call reads the message, and its answer starts the first command in the second list that it filled in.

1. `askreply`: Kiko types "approve" or "not" for an Approve question (ACC-12, no buttons in Ask Cue chat). Checks `cueAskSaid_` in `CueEditLog.gs`.
2. `msgrchat`: Kiko's reply in a Messenger chat with a crew member (CUE-MSGR-2026-11-02). Checks `cueMsgrSaid_` in `CueMessenger.gs`.
3. `mailchat`: Kiko's reply in an email chat or a new-kind-of-email chat (ACC-5, ACC-6). Checks `cueMcSaid_` in `CueMailChat.gs`.
4. `learn`: "remember: …" saves a rule. Checks `cueLearnSaid_` in `CueTeach.gs`.
5. `help`: "help: <question>" answers from the Help Q&A list. Checks `cueHelpSaid_` in `CueHelp.gs`.
6. `ticktick`: "connect ticktick". Checks `cueTtConnectSaid_` in `CueTickTick.gs`.
7. `schedule`: "schedule …" and "show my schedules". Checks `cueSchedSaid_` in `CueSchedule.gs`.
8. `transfer`: Transfer lookup. Checks `cueTxSaid_` in `CueLookup.gs`.
9. `invoice`: Invoice line edit. Checks `cueInvSaid_` in `CueLookup.gs`.
10. `allow`: "allow cue to read\|edit …". Checks `cueAllowSaid_` in `CueEdit.gs`.
11. `contact-scan`: Old-email contact scan. Checks `cueCsSaid_` in `CueContactScan.gs`.
12. `contact-new`: "scan my gmail for new contacts". Checks `cueCnSaid_` in `CueContactNew.gs`.
13. `bids-redo`: "redo" in a Bid check thread. Checks `cueBidsRedoSaid_`.
14. `cecost-reply`: Reply to a CE cost question. Checks `cueCecReply_` in `CueCeCost.gs`.
15. `cecost`: "update CE cost for …". Checks `cueCecAsked_` in `CueCeCost.gs`; starts `cueCecStart_` in `CueCeCost.gs`.
16. `tri`: "add task\|issue\|risk … to <project>". Checks `cueTriSaid_` in `CueTri.gs`.
17. `canvas`: Open in Canvas. Checks `cueCanvasSaid_` in `CueCanvas.gs`.
18. `add-project`: "add project …" becomes a project intake. Checks `cueAddProjectSaid_`.
19. `mail-intake`: "intake from the email from <person>" reads that email in Gmail. Checks `cueMailIntakeSaid_` in `CueTriage.gs`.
20. `phased-reply`: Reply while a phased intake card waits. Checks `cuePhReply_` in `CueIntakePhases.gs`.
21. `style`: "learn my style". Checks `CUE_STYLE_RE_` in `CueStyle.gs`; starts `cueStyleStart_` in `CueStyle.gs`.
22. `memory`: "learn my memory". Checks `CUE_MEM_RE_` in `CueTeach.gs`; starts `cueTeachStart_` in `CueTeach.gs`.
23. `process`: "learn my process". Checks `CUE_PROC_RE_` in `CueTeach.gs`; starts `cueTeachStart_` in `CueTeach.gs`.
24. `memory-paste`: Pasted memory text. Checks `cueMemPaste_` in `CueTeach.gs`; starts `cueTeachStart_` in `CueTeach.gs`.
25. `money-taught`: A money phrase Kiko taught word for word. Checks `cueRouteExact_` in `CueRoute.gs`; starts `cueFinance_` in `CueFinance.gs`.
26. `gtask`: "run daily plan" and other ChatGPT tasks. Checks `cueGtAsked_` in `CueGptTasks.gs`; starts `cueGtStart_` in `CueGptTasks.gs`.
27. `personal`: Personal expense (Kiko's own words). Checks `cueIsPersonal_` in `CuePersonal.gs`; starts `cuePersonalStart_` in `CuePersonal.gs`.
28. `money`: Money question. Checks `cueMoneyAsked_`; starts `cueFinance_` in `CueFinance.gs`.
29. `workflow-reply`: Reply in a waiting workflow map. Checks `cueWorkflowWaiting_`; starts `cueWorkflowReply_` in `CueWorkflow.gs`.
30. `workflow-files`: Files with a map word. Checks `cueWorkflowAsked_` in `CueWorkflow.gs`; starts `cueWorkflowFiles_`.
31. `funnel`: "show the funnel". Checks `cueFunnelAsked_` in `CueFunnel.gs`; starts `cueFunnelStart_` in `CueFunnel.gs`.
32. `status`: "status updates", "status of …". Checks `cueStatusSaid_`.
33. `bids-intake`: "do intake for <bid>". Checks `cueBidsFor_` in `CueBids.gs`; starts `cueBidsIntake_` in `CueBids.gs`.
34. `bids`: Bid check. Checks `cueBidsAsked_` in `CueBids.gs`; starts `cueBidsStart_` in `CueBids.gs`.
35. `recost`: "cost them", "re-cost" in a thread with a read. Checks `cueRecostStart_` in `Cue.gs`.

Then a supplier to register (`cueIsSupplier_` in `CueSupplier.gs`) skips the chat call. Otherwise the chat call (`cueTalk_`) answers, and it starts, in this order:

1. `talk.workflow`: Workflow map. Starts `cueWorkflowStart_` in `CueWorkflow.gs`.
2. `talk.readiness`: Readiness check. Starts `cueReadyStart_` in `CueReady.gs`.
3. `talk.start_ar`: ARs. Starts `cueArStart_` in `CueAr.gs`.
4. `talk.email`: Email. Starts `cueMailStart_` in `CueMail.gs`.
5. `talk.vendor`: Supplier search. Starts `cueVendorStart_` in `CueVendor.gs`.
6. `talk.canvas_edit`: Canvas edit. Starts `cueEditStart_` in `CueEdit.gs`.

Last, `talk.start_intake` starts a project intake (or a supplier registration).

## 3. Background jobs (one trigger, every 5 minutes)

`cueResume` in `Cue.gs` runs the list in `cueJobs_` (`CueJobs.gs`) in order, resumes waiting tasks, and last runs the scheduler
(`cueSchedTick_`). Each job has its own timing inside its own code. Each run writes one row to the Job Runs tab, which Canvas Admin reads.

| # | Job (Job Runs name) | Function | File | Note in the code |
|---|---|---|---|---|
| 1 | Reminders and approved sends | `cueSweepTick_` | `CueSweep.gs` | reminders, and 9:00 sends Kiko approved |
| 2 | Bid check tidy | `cueBidsTidyAll_` | `CueBids.gs` | once: one Bid check thread per day |
| 3 | Stuck write fix | `cueFixStuckWrites_` | `Cue.gs` | 1.27.7: CE cost / expense approved before the save fix |
| 4 | FSA and AR Send later | `cueArDue_` | `CueAr.gs` | CREW-DOCS-2026-10-26: FSAs and ARs Kiko chose to Send later |
| 5 | Emails waiting check | `cueMaTick_` | `CueMailAlerts.gs` | CUE-MAIL-ALERTS-2026-10-27: Emails waiting file for Canvas, every 10 minutes |
| 6 | Project log | `cuePlogFlush_` | `CueProjectLog.gs` | CUE-PROJECT-LOG-2026-10-27: emails, task summaries and chasers to the project logs |
| 7 | Messenger inbox | `cueMsgrPull_` | `CueMessenger.gs` | CUE-MSGR-2026-11-02: crew messages held by the Messenger relay, every 5 min, no AI |
| 8 | Messenger sign links | `cueMsgrTick_` | `CueMessenger.gs` | CUE-MSGR-2026-11-02: unsigned FSA and AR links on Messenger, every 15 min, no AI |
| 9 | Release notes at 8 PM | `cueRnDue_` | `CueRelnotes.gs` | CUE-RELNOTES-2026-10-27: release notes Kiko approved before 8 PM |
| 10 | CRM email log | `cueCrmLogTick_` | `CueCrmLog.gs` | CUE-CRM-EMAIL-LOG-2026-10-26: client emails to Accounts › Activity, hourly |
| 11 | New mail | `cueNmTick_` | `CueNewMail.gs` | CUE-NEW-MAIL-2026-10-27: new mail in Kiko's inbox and info@, Claude sorts every 30 min |
| 12 | New contacts from Gmail | `cueCnTick_` | `CueContactNew.gs` | CUE-CONTACT-NEW-2026-10-29: 3-year rewind, then weekly; one Approve card at a time |
| 13 | CRM work | `cueCrmTickTick_` | `CueCrmTick.gs` | CUE-CRM-TICK-2026-10-29: Canvas's 15-minute CRM work, from Kiko's account (bridge crm_tick) |
| 14 | Client accreditation mail | `cueAcTick_` | `CueAccred.gs` |  |
| 15 | 8 AM update after the morning batch | `cueK0Retry_` | `CueMorning.gs` | CUE-K0-2026-10-31: the update waits while the 07:00 batch still drafts         // CLIENT-ACCRED-THREADS-2026-10-29: replies into each company's Accreditation thread, every 30 min |
| 16 | New PhilGEPS read | `cueBidsPgTick_` | `CueBidsPg.gs` | CUE-BIDS-PG-2026-11-01: the public bulletin board, hourly 7 AM to 7 PM, no AI |
| 17 | Schedules | `cueSchedTick_` | `CueSchedule.gs` | last, after the tasks: a task it starts runs on the next tick in its own 6 minutes |

## 4. Files: what each one touches

Bridge actions are names from `test/fixtures/ZapBridge.gs` found in the file. AI sites count the places a file calls GPT or Claude,
not calls per run. "Used by" and "Uses" count other files.

| File | Canvas bridge actions | Sheet tabs | GPT sites | Claude sites | Used by | Uses |
|---|---|---|---|---|---|---|
| `Cue.gs` | `search_projects` | Chat, Requests | 0 | 0 | 69 | 44 |
| `CueAccred.gs` | `subject` | Requests | 0 | 0 | 4 | 7 |
| `CueAdmin.gs` |  | Job Runs, Triage rules | 0 | 0 | 4 | 11 |
| `CueAdminCanvas.gs` | `run_now_list`, `run_now_send`, `sn_board`, `sn_items`, `sn_prepare`, `sn_send`, `subject` |  | 0 | 0 | 3 | 5 |
| `CueAgent.gs` | `contains` |  | 0 | 0 | 1 | 7 |
| `CueAi.gs` |  | AI Runs | 1 | 1 | 34 | 3 |
| `CueAr.gs` | `crew_docs`, `crew_docs_job`, `crew_docs_make`, `crew_docs_send` | Requests | 0 | 0 | 5 | 4 |
| `CueBatch.gs` |  |  | 0 | 0 | 2 | 3 |
| `CueBids.gs` | `phone`, `subject` | Bid documents, Cowork PhilGEPS findings, Requests | 3 | 0 | 9 | 11 |
| `CueBidsPg.gs` |  |  | 0 | 0 | 2 | 5 |
| `CueBidsPhilgeps.gs` |  |  | 0 | 0 | 2 | 3 |
| `CueBridge.gs` | `claim_plan` |  | 0 | 0 | 43 | 3 |
| `CueCanvas.gs` | `find_similar_projects`, `phone`, `search_projects` |  | 0 | 0 | 16 | 5 |
| `CueCeCost.gs` | `ce_lines`, `ce_update_costs`, `search_projects` | Requests | 1 | 0 | 3 | 8 |
| `CueChange.gs` | `list_project_files` | Requests | 1 | 0 | 4 | 7 |
| `CueCheck.gs` | `accreditation_gaps`, `ar_email`, `canvas_link`, `ce_lines`, `claim_plan`, `client_check`, `client_status`, `crew_docs`, `crew_docs_job`, `crew_docs_send`, `expense_evidence`, `finance_snapshot`, `find_similar_projects`, `get_project`, `get_project_board`, `get_readiness`, `inbox_new`, `intake_evidence`, `list_project_files`, `list_unsigned_docs`, `mail_waiting`, `overdue_billings`, `rfp_outbox`, `search_projects`, `send_doc_reminder`, `send_payment_chasers`, `status_digest`, `supplier_check`, `supplier_lookup` | Requests | 0 | 0 | 5 | 37 |
| `CueCheckKey.gs` |  |  | 0 | 0 | 2 | 0 |
| `CueCheckPost.gs` |  |  | 0 | 0 | 0 | 2 |
| `CueCommands.gs` |  |  | 0 | 0 | 3 | 37 |
| `CueContactNew.gs` | `phone`, `subject` | New contacts | 0 | 1 | 5 | 10 |
| `CueContactScan.gs` | `phone` | Contact scan | 0 | 1 | 3 | 9 |
| `CueContacts.gs` |  |  | 0 | 0 | 3 | 6 |
| `CueCrmLog.gs` | `mail_waiting` |  | 0 | 0 | 2 | 4 |
| `CueCrmTick.gs` |  |  | 0 | 0 | 2 | 2 |
| `CueDates.gs` |  |  | 0 | 0 | 26 | 1 |
| `CueEdit.gs` | `contains` |  | 0 | 1 | 4 | 6 |
| `CueEditLog.gs` |  | Canvas edits | 0 | 0 | 3 | 5 |
| `CueExpense.gs` | `expense_evidence`, `record_expense` | Requests | 1 | 1 | 3 | 5 |
| `CueFiles.gs` | `save_project_file` |  | 0 | 0 | 16 | 3 |
| `CueFinance.gs` | `finance_snapshot` | Requests | 1 | 1 | 3 | 3 |
| `CueFunnel.gs` |  | Requests | 0 | 0 | 6 | 8 |
| `CueGmail.gs` |  |  | 0 | 0 | 30 | 4 |
| `CueGptTasks.gs` | `get_project_board`, `get_readiness`, `subject` | ChatGPT findings, Requests | 1 | 0 | 10 | 8 |
| `CueHelp.gs` |  | Requests | 0 | 1 | 3 | 4 |
| `CueIntake.gs` | `apply_intake`, `find_similar_projects`, `intake_evidence`, `make_project_folders`, `phone`, `subject`, `submit_intake` |  | 3 | 1 | 3 | 9 |
| `CueIntakeCheck.gs` |  | Requests, Triage log | 0 | 0 | 1 | 6 |
| `CueIntakePhases.gs` | `client_check`, `find_similar_projects`, `intake_add_lines`, `intake_add_project`, `intake_evidence`, `intake_log_rfqs`, `intake_remove`, `intake_save_costs`, `phone`, `search_projects` |  | 1 | 3 | 4 | 9 |
| `CueJobs.gs` |  | Job Runs | 0 | 0 | 4 | 16 |
| `CueLookup.gs` |  |  | 0 | 0 | 2 | 5 |
| `CueMail.gs` | `subject` | Requests | 1 | 0 | 2 | 6 |
| `CueMailAlerts.gs` | `subject` |  | 0 | 0 | 2 | 6 |
| `CueMailChat.gs` | `phone` | Requests | 0 | 1 | 2 | 8 |
| `CueMailTypes.gs` |  | Triage rules, Triage types | 0 | 0 | 4 | 4 |
| `CueMessenger.gs` |  | Requests | 0 | 0 | 4 | 4 |
| `CueMorning.gs` | `client_status` | Requests | 0 | 0 | 9 | 11 |
| `CueMsgTemplates.gs` |  |  | 0 | 0 | 1 | 6 |
| `CueNewMail.gs` | `get_project_board`, `inbox_new`, `mail_waiting` | Requests, Triage log, Triage rules | 0 | 0 | 7 | 8 |
| `CuePersonal.gs` |  | Requests | 1 | 3 | 5 | 5 |
| `CueProjectLog.gs` | `subject` |  | 0 | 0 | 4 | 5 |
| `CueReady.gs` | `find_similar_projects`, `get_readiness`, `list_project_files`, `search_projects` | Requests | 1 | 1 | 5 | 7 |
| `CueRelnotes.gs` |  | Release Notes, Requests | 0 | 1 | 6 | 6 |
| `CueRfpSend.gs` | `rfp_outbox`, `rfp_sent` |  | 0 | 0 | 6 | 8 |
| `CueRoute.gs` |  | Routing examples | 0 | 0 | 12 | 16 |
| `CueSchedule.gs` |  | Requests, Schedule | 0 | 0 | 9 | 20 |
| `CueStatus.gs` | `client_status`, `find_similar_projects`, `get_readiness`, `search_projects` | Requests | 0 | 0 | 5 | 7 |
| `CueStyle.gs` |  | Requests, Style | 0 | 1 | 15 | 4 |
| `CueSubjects.gs` |  | Requests | 0 | 0 | 1 | 3 |
| `CueSupplier.gs` | `handoff_put`, `register_supplier`, `save_supplier_file`, `subject`, `supplier_check` |  | 2 | 1 | 3 | 7 |
| `CueSweep.gs` | `get_project_board`, `subject` | Chase log, Requests, Rules | 1 | 0 | 16 | 12 |
| `CueSweepAccr.gs` | `accreditation_gaps`, `log_accreditation_reminder` |  | 0 | 0 | 0 | 8 |
| `CueSweepAward.gs` |  |  | 0 | 0 | 0 | 6 |
| `CueSweepFunnel.gs` |  |  | 1 | 0 | 2 | 9 |
| `CueSweepPay.gs` | `overdue_billings`, `send_payment_chasers` |  | 0 | 0 | 1 | 4 |
| `CueSweepRfq.gs` |  |  | 0 | 0 | 0 | 6 |
| `CueSweepSignature.gs` | `list_unsigned_docs`, `send_doc_reminder` |  | 0 | 0 | 0 | 4 |
| `CueTeach.gs` |  | Memory, Requests, Workflows | 0 | 3 | 7 | 9 |
| `CueTemplates.gs` |  |  | 2 | 0 | 8 | 7 |
| `CueText.gs` |  |  | 0 | 0 | 61 | 0 |
| `CueTickTick.gs` |  |  | 0 | 0 | 3 | 4 |
| `CueToday.gs` |  | Requests | 0 | 0 | 1 | 3 |
| `CueTri.gs` | `add_tri_items` | Requests | 0 | 0 | 2 | 4 |
| `CueTriage.gs` | `mail_waiting` | Triage log, Triage rules | 1 | 1 | 12 | 8 |
| `CueTutor.gs` |  | Patterns | 1 | 0 | 4 | 6 |
| `CueUsage.gs` |  | AI Runs, Requests | 0 | 0 | 2 | 4 |
| `CueVendor.gs` | `subject`, `supplier_lookup` | Requests | 2 | 1 | 3 | 7 |
| `CueWorkflow.gs` |  | Requests, Workflows | 2 | 1 | 3 | 4 |

## 5. Shared helpers

Names used by 5 or more other files, and the file that holds them.

| Helper | Lives in | Used by files |
|---|---|---|
| `cueNow_` | `Cue.gs` | 60 |
| `cueStr_` | `CueText.gs` | 60 |
| `cueChat_` | `Cue.gs` | 43 |
| `cueSheet_` | `Cue.gs` | 39 |
| `cueBridge_` | `CueBridge.gs` | 38 |
| `cueLocked_` | `Cue.gs` | 37 |
| `cueLoad_` | `Cue.gs` | 35 |
| `cueProp_` | `Cue.gs` | 33 |
| `cueSave_` | `Cue.gs` | 33 |
| `cueOwner_` | `Cue.gs` | 31 |
| `cueAiAll_` | `CueAi.gs` | 29 |
| `cueEmail_` | `CueText.gs` | 28 |
| `CUE_VERSION_` | `Cue.gs` | 26 |
| `cueGpt_` | `CueAi.gs` | 21 |
| `cueClaude_` | `CueAi.gs` | 19 |
| `cueMetrics_` | `Cue.gs` | 18 |
| `cuePh_` | `CueDates.gs` | 17 |
| `cueResume` | `Cue.gs` | 17 |
| `CUE_GMAIL_` | `CueGmail.gs` | 16 |
| `cueView_` | `Cue.gs` | 16 |
| `cueGmail_` | `CueGmail.gs` | 15 |
| `cueRows_` | `Cue.gs` | 15 |
| `cueSummary_` | `Cue.gs` | 15 |
| `cueGmailSend_` | `CueGmail.gs` | 12 |
| `cueBridgeParse_` | `CueBridge.gs` | 10 |
| `cueBridgeReq_` | `CueBridge.gs` | 10 |
| `cueKey_` | `CueAi.gs` | 10 |
| `cueMe_` | `Cue.gs` | 10 |
| `cueName_` | `CueText.gs` | 10 |
| `cueAskOpen_` | `CueRoute.gs` | 9 |
| `cueMnlDay_` | `CueDates.gs` | 9 |
| `cueOwnDomain_` | `CueGmail.gs` | 9 |
| `CUE_DATE_RE_` | `CueText.gs` | 8 |
| `cueAddDays_` | `CueDates.gs` | 8 |
| `cueAskPick` | `CueRoute.gs` | 8 |
| `cueBridgePlan_` | `CueBridge.gs` | 8 |
| `cueGmailDraft_` | `CueGmail.gs` | 8 |
| `CUE_DRIVE_` | `CueFiles.gs` | 7 |
| `cueCanvasFind_` | `CueCanvas.gs` | 7 |
| `cueDrive_` | `CueFiles.gs` | 7 |
| `cueKind_` | `CueSweep.gs` | 7 |
| `cueRunLeased_` | `Cue.gs` | 7 |
| `cueStyleFor_` | `CueStyle.gs` | 7 |
| `cueWords_` | `Cue.gs` | 7 |
| `cueGmailAll_` | `CueTriage.gs` | 6 |
| `cueRecent_` | `Cue.gs` | 6 |
| `CUE_TABS_` | `Cue.gs` | 5 |
| `cueBridgeAll_` | `CueBridge.gs` | 5 |
| `cueCloseSuperseded_` | `Cue.gs` | 5 |
| `cueFilesParts_` | `CueFiles.gs` | 5 |
| `cueK0On_` | `CueMorning.gs` | 5 |
| `cueR2_` | `CueText.gs` | 5 |
| `cueSend` | `Cue.gs` | 5 |
| `cueSendWith_` | `Cue.gs` | 5 |
| `cueStyleBody_` | `CueStyle.gs` | 5 |
| `cueStyleSignOff_` | `CueStyle.gs` | 5 |
| `cueTerm_` | `CueText.gs` | 5 |

## 6. What the page calls

Server functions `Index.html` calls, by the file that holds them.

- `Cue.gs`: `cueApprove`, `cueAsNew`, `cueCancelIntake`, `cueCloseTask`, `cueDrafts`, `cueFixAccess`, `cueFolders`, `cueReject`, `cueReopen`, `cueRescan`, `cueRetry`, `cueRfq`, `cueRfqPick`, `cueRun`, `cueSameAnswer`, `cueSend`, `cueState`, `cueSupplierCanvas`, `cueSupplierSaved`
- `CueAccred.gs`: `cueAcDone`
- `CueAdmin.gs`: `cueAdminChasers`, `cueAdminLog`, `cueAdminRelnotes`, `cueAdminTriage`, `cueAdminTriageDel`
- `CueAdminCanvas.gs`: `cueAdminCanvasChaseSend`, `cueAdminCanvasChasers`, `cueAdminSnBoard`, `cueAdminSnItems`, `cueAdminSnPrepare`, `cueAdminSnSend`
- `CueBatch.gs`: `cueBatchAdd`, `cueBatchCancel`, `cueBatchStart`, `cueBatchTake`
- `CueBids.gs`: `cueBidsClarifyCancel`, `cueBidsClarifySend`, `cueBidsClose`, `cueBidsDecide`, `cueBidsStartIntake`
- `CueEditLog.gs`: `cueAdminEditUndo`, `cueAdminEdits`
- `CueExpense.gs`: `cueExpense`
- `CueFiles.gs`: `cueFileData`, `cueUpload`
- `CueFinance.gs`: `cueFinSave`, `cueFinSheet`
- `CueFunnel.gs`: `cueFunnelDone`
- `CueGptTasks.gs`: `cueGtAct`, `cueGtClose`, `cueGtDraftAll`
- `CueHelp.gs`: `cueHelpAct`
- `CueMailTypes.gs`: `cueAdminTypeSender`, `cueAdminTypes`, `cueAdminTypesSave`
- `CueMessenger.gs`: `cueMsgrKey`, `cueMsgrSave`
- `CueMsgTemplates.gs`: `cueAdminTemplatePreview`, `cueAdminTemplateSave`, `cueAdminTemplateTest`, `cueAdminTemplates`
- `CueNewMail.gs`: `cueNmItem`
- `CueReady.gs`: `cueReadyFollowups`, `cueReadyPick`, `cueReadyRecheck`
- `CueRoute.gs`: `cueAskPick`, `cueWrongCommand`
- `CueSchedule.gs`: `cueSchedDelete`, `cueSchedRunNow`, `cueSchedSet`, `cueSchedules`
- `CueStatus.gs`: `cueStatusDone`, `cueStatusPreview`
- `CueSweep.gs`: `cueArchive`, `cueCloseOlder`, `cueCloseThread`, `cueRules`, `cueRulesSave`, `cueSweepAct`, `cueSweepCancel`, `cueSweepItem`, `cueSweepSendOne`
- `CueTeach.gs`: `cueLearnChats`, `cueMyRuleSave`, `cueMyRules`, `cueSettings`
- `CueTemplates.gs`: `cueSweepRewrite`
- `CueTriage.gs`: `cueTriageIntake`
- `CueTutor.gs`: `cueMyPatternDemote`, `cueTutorSet`
- `CueUsage.gs`: `cueUsage`, `cueUsagePrices`
- `CueVendor.gs`: `cueVendorRfqs`
