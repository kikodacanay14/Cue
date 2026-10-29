# Cue feature map

Made from the code by `node tools/map.mjs` (structure review phase 1, item 1.1). Do not edit by hand: change the code and run
the script again. `test/cue.test.js` fails when this file is out of date.

Counts: 65 server files, 1276 top-level names, 33 task kinds, 30 word checks before the
chat call, 12 background jobs in the 5-minute trigger, 82 page-to-server functions, 64 bridge actions in the Canvas bridge copy.

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
| `funnel` | Sales funnel |  | Info | `CueFunnel.gs` | intake (default) | 2 |
| `gtask` | ChatGPT task |  | Draft and send | `CueGptTasks.gs` | intake (default) | 1 |
| `help` | Help answer |  | Info | `CueHelp.gs` | intake (default) | 2 |
| `hubspot` | HubSpot clean-up |  | Approve | `CueHubspot.gs` | `CueHubspot.gs` | 1 |
| `inbox` | Page only (not in the command list) |  | Info | none | none | 4 |
| `intake` | Project intake | Project intake | Approve | `CueIntake.gs` | intake (default) | 0 |
| `memory` | Learning your memory |  | Approve | `CueTeach.gs` | `CueTeach.gs` | 5 |
| `newmail` | Page only (not in the command list) |  | Question | none | none | 3 |
| `open` | Page only (not in the command list) |  |  | none | none | 1 |
| `own` | Page only (not in the command list) |  |  | none | none | 2 |
| `personal` | Personal expense |  | Approve | `CuePersonal.gs` | `CuePersonal.gs` | 3 |
| `pipeline` | Pipeline review | Pipeline review | Draft and send | `CuePipeline.gs` | `CuePipeline.gs` | 1 |
| `process` | Learning your process |  | Approve | `CueTeach.gs` | `CueTeach.gs` | 3 |
| `readiness` | Readiness check | Readiness check | Draft and send | `CueReady.gs` | `CueReady.gs` | 1 |
| `relnotes` | Page only (not in the command list) |  | Approve | none | none | 1 |
| `staff` | Page only (not in the command list) |  |  | none | none | 1 |
| `style` | Learning your style |  | Approve | `CueStyle.gs` | `CueStyle.gs` | 3 |
| `supplier` | Supplier registration |  | Approve | `CueSupplier.gs` | `CueSupplier.gs` | 4 |
| `sweep` | Morning sweep |  | Draft and send | `CueSweep.gs` | `CueSweep.gs` | 1 |
| `tri` | Task, issue or risk |  | Approve | `CueIntake.gs` (default) | `CueTri.gs` | 1 |
| `vendor` | Supplier search | Supplier search | Draft and send | `CueVendor.gs` | `CueVendor.gs` | 1 |
| `workflow` | Workflow map | Workflow map | Approve | `CueWorkflow.gs` | `CueWorkflow.gs` | 1 |

## 2. Routing order

Who answers which words first. `cueSendWith_` (in `Cue.gs`) goes down `cueRoutes_` (`CueCommands.gs`); the first that answers wins.
If none answers, the AI chat call reads the message, and its answer starts the first command in the second list that it filled in.

1. `learn`: "remember: …" saves a rule. Checks `cueLearnSaid_` in `CueTeach.gs`.
2. `help`: "help: <question>" answers from the Help Q&A list. Checks `cueHelpSaid_` in `CueHelp.gs`.
3. `ticktick`: "connect ticktick". Checks `cueTtConnectSaid_` in `CueTickTick.gs`.
4. `schedule`: "schedule …" and "show my schedules". Checks `cueSchedSaid_` in `CueSchedule.gs`.
5. `transfer`: Transfer lookup. Checks `cueTxSaid_` in `CueLookup.gs`.
6. `invoice`: Invoice line edit. Checks `cueInvSaid_` in `CueLookup.gs`.
7. `allow`: "allow cue to read\|edit …". Checks `cueAllowSaid_` in `CueEdit.gs`.
8. `contact-scan`: Old-email contact scan. Checks `cueCsSaid_` in `CueContactScan.gs`.
9. `bids-redo`: "redo" in a Bid check thread. Checks `cueBidsRedoSaid_`.
10. `cecost-reply`: Reply to a CE cost question. Checks `cueCecReply_` in `CueCeCost.gs`.
11. `cecost`: "update CE cost for …". Checks `cueCecAsked_` in `CueCeCost.gs`; starts `cueCecStart_` in `CueCeCost.gs`.
12. `tri`: "add task\|issue\|risk … to <project>". Checks `cueTriSaid_` in `CueTri.gs`.
13. `canvas`: Open in Canvas. Checks `cueCanvasSaid_` in `CueCanvas.gs`.
14. `add-project`: "add project …" becomes a project intake. Checks `cueAddProjectSaid_`.
15. `phased-reply`: Reply while a phased intake card waits. Checks `cuePhReply_` in `CueIntakePhases.gs`.
16. `style`: "learn my style". Checks `CUE_STYLE_RE_` in `CueStyle.gs`; starts `cueStyleStart_` in `CueStyle.gs`.
17. `memory`: "learn my memory". Checks `CUE_MEM_RE_` in `CueTeach.gs`; starts `cueTeachStart_` in `CueTeach.gs`.
18. `process`: "learn my process". Checks `CUE_PROC_RE_` in `CueTeach.gs`; starts `cueTeachStart_` in `CueTeach.gs`.
19. `memory-paste`: Pasted memory text. Checks `cueMemPaste_` in `CueTeach.gs`; starts `cueTeachStart_` in `CueTeach.gs`.
20. `money-taught`: A money phrase Kiko taught word for word. Checks `cueRouteExact_` in `CueRoute.gs`; starts `cueFinance_` in `CueFinance.gs`.
21. `gtask`: "run daily plan" and other ChatGPT tasks. Checks `cueGtAsked_` in `CueGptTasks.gs`; starts `cueGtStart_` in `CueGptTasks.gs`.
22. `personal`: Personal expense (Kiko's own words). Checks `cueIsPersonal_` in `CuePersonal.gs`; starts `cuePersonalStart_` in `CuePersonal.gs`.
23. `money`: Money question. Checks `cueMoneyAsked_`; starts `cueFinance_` in `CueFinance.gs`.
24. `workflow-reply`: Reply in a waiting workflow map. Checks `cueWorkflowWaiting_`; starts `cueWorkflowReply_` in `CueWorkflow.gs`.
25. `workflow-files`: Files with a map word. Checks `cueWorkflowAsked_` in `CueWorkflow.gs`; starts `cueWorkflowFiles_`.
26. `hubspot`: HubSpot clean-up. Checks `cueHsAsked_` in `CueHubspot.gs`; starts `cueHsStart_` in `CueHubspot.gs`.
27. `funnel`: "show the funnel", "my HubSpot tasks". Checks `cueFunnelAsked_` in `CueFunnel.gs`; starts `cueFunnelStart_` in `CueFunnel.gs`.
28. `bids-intake`: "do intake for <bid>". Checks `cueBidsFor_` in `CueBids.gs`; starts `cueBidsIntake_` in `CueBids.gs`.
29. `bids`: Bid check. Checks `cueBidsAsked_` in `CueBids.gs`; starts `cueBidsStart_` in `CueBids.gs`.
30. `recost`: "cost them", "re-cost" in a thread with a read. Checks `cueRecostStart_` in `Cue.gs`.

Then a supplier to register (`cueIsSupplier_` in `CueSupplier.gs`) skips the chat call. Otherwise the chat call (`cueTalk_`) answers, and it starts, in this order:

1. `talk.workflow`: Workflow map. Starts `cueWorkflowStart_` in `CueWorkflow.gs`.
2. `talk.readiness`: Readiness check. Starts `cueReadyStart_` in `CueReady.gs`.
3. `talk.pipeline`: Pipeline review. Starts `cuePipeStart_` in `CuePipeline.gs`.
4. `talk.start_ar`: ARs. Starts `cueArStart_` in `CueAr.gs`.
5. `talk.email`: Email. Starts `cueMailStart_` in `CueMail.gs`.
6. `talk.vendor`: Supplier search. Starts `cueVendorStart_` in `CueVendor.gs`.
7. `talk.canvas_edit`: Canvas edit. Starts `cueEditStart_` in `CueEdit.gs`.

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
| 7 | Release notes at 8 PM | `cueRnDue_` | `CueRelnotes.gs` | CUE-RELNOTES-2026-10-27: release notes Kiko approved before 8 PM |
| 8 | CRM email log | `cueCrmLogTick_` | `CueCrmLog.gs` | CUE-CRM-EMAIL-LOG-2026-10-26: client emails to Accounts › Activity, hourly |
| 9 | New mail | `cueNmTick_` | `CueNewMail.gs` | CUE-NEW-MAIL-2026-10-27: new mail in Kiko's inbox and info@, Claude sorts every 30 min |
| 10 | CRM work | `cueCrmTickTick_` | `CueCrmTick.gs` | CUE-CRM-TICK-2026-10-29: Canvas's 15-minute CRM work, from Kiko's account (bridge crm_tick) |
| 11 | Client accreditation mail | `cueAcTick_` | `CueAccred.gs` | CLIENT-ACCRED-THREADS-2026-10-29: replies into each company's Accreditation thread, every 30 min |
| 12 | Schedules | `cueSchedTick_` | `CueSchedule.gs` | last, after the tasks: a task it starts runs on the next tick in its own 6 minutes |

## 4. Files: what each one touches

Bridge actions are names from `test/fixtures/ZapBridge.gs` found in the file. AI sites count the places a file calls GPT or Claude,
not calls per run. "Used by" and "Uses" count other files.

| File | Canvas bridge actions | Sheet tabs | GPT sites | Claude sites | Used by | Uses |
|---|---|---|---|---|---|---|
| `Cue.gs` | `search_projects` | Chat, Requests | 0 | 0 | 57 | 42 |
| `CueAccred.gs` |  | Requests | 0 | 0 | 3 | 7 |
| `CueAdmin.gs` |  | Job Runs, Triage rules | 0 | 0 | 4 | 10 |
| `CueAdminCanvas.gs` | `run_now_list`, `run_now_send`, `sn_board`, `sn_items`, `sn_prepare`, `sn_send` |  | 0 | 0 | 2 | 5 |
| `CueAi.gs` |  | AI Runs | 1 | 1 | 32 | 3 |
| `CueAr.gs` | `crew_docs`, `crew_docs_job`, `crew_docs_make`, `crew_docs_send` | Requests | 0 | 0 | 6 | 4 |
| `CueBatch.gs` |  |  | 0 | 0 | 2 | 3 |
| `CueBids.gs` |  | Bid documents, Requests | 3 | 0 | 7 | 8 |
| `CueBidsPhilgeps.gs` |  |  | 0 | 0 | 1 | 3 |
| `CueBridge.gs` | `claim_plan` |  | 0 | 0 | 37 | 3 |
| `CueCanvas.gs` | `find_similar_projects`, `search_projects` |  | 0 | 0 | 15 | 5 |
| `CueCeCost.gs` | `ce_lines`, `ce_update_costs`, `search_projects` | Requests | 1 | 0 | 3 | 8 |
| `CueChange.gs` | `list_project_files` | Requests | 1 | 0 | 4 | 7 |
| `CueCheck.gs` | `accreditation_gaps`, `ar_email`, `canvas_link`, `ce_lines`, `claim_plan`, `crew_docs`, `crew_docs_job`, `crew_docs_send`, `expense_evidence`, `finance_snapshot`, `find_similar_projects`, `get_project`, `get_project_board`, `get_readiness`, `inbox_new`, `intake_evidence`, `list_project_files`, `list_unsigned_docs`, `mail_waiting`, `overdue_billings`, `rfp_outbox`, `search_projects`, `send_doc_reminder`, `send_payment_chasers`, `status_digest`, `supplier_check`, `supplier_lookup` | Requests | 0 | 0 | 5 | 31 |
| `CueCheckKey.gs` |  |  | 0 | 0 | 2 | 0 |
| `CueCheckPost.gs` |  |  | 0 | 0 | 0 | 2 |
| `CueCommands.gs` |  |  | 0 | 0 | 2 | 32 |
| `CueContactScan.gs` |  | Contact scan | 0 | 1 | 2 | 9 |
| `CueCrmLog.gs` | `mail_waiting` |  | 0 | 0 | 2 | 4 |
| `CueCrmTick.gs` |  |  | 0 | 0 | 1 | 2 |
| `CueDates.gs` |  |  | 0 | 0 | 16 | 0 |
| `CueEdit.gs` | `contains` |  | 0 | 1 | 2 | 5 |
| `CueExpense.gs` | `expense_evidence`, `record_expense` | Requests | 1 | 1 | 3 | 5 |
| `CueFiles.gs` | `save_project_file` |  | 0 | 0 | 15 | 3 |
| `CueFinance.gs` | `finance_snapshot` | Requests | 1 | 1 | 3 | 3 |
| `CueFunnel.gs` |  | Requests | 0 | 0 | 6 | 6 |
| `CueGmail.gs` |  |  | 0 | 0 | 23 | 3 |
| `CueGptTasks.gs` | `get_project_board`, `get_readiness` | ChatGPT findings, Requests | 1 | 0 | 9 | 8 |
| `CueHelp.gs` |  | Requests | 0 | 1 | 3 | 4 |
| `CueHubspot.gs` | `hubspot_fix`, `hubspot_scan` | HubSpot Cleanup, Requests | 1 | 1 | 4 | 4 |
| `CueIntake.gs` | `apply_intake`, `find_similar_projects`, `intake_evidence`, `make_project_folders`, `submit_intake` |  | 3 | 1 | 3 | 9 |
| `CueIntakePhases.gs` | `client_check`, `find_similar_projects`, `intake_add_lines`, `intake_add_project`, `intake_evidence`, `intake_log_rfqs`, `intake_remove`, `intake_save_costs`, `search_projects` |  | 1 | 3 | 3 | 9 |
| `CueJobs.gs` |  | Job Runs | 0 | 0 | 4 | 12 |
| `CueLookup.gs` |  |  | 0 | 0 | 2 | 5 |
| `CueMail.gs` |  | Requests | 1 | 0 | 2 | 5 |
| `CueMailAlerts.gs` |  |  | 0 | 0 | 2 | 5 |
| `CueNewMail.gs` | `get_project_board`, `inbox_new`, `mail_waiting` | Requests, Triage log | 0 | 0 | 3 | 6 |
| `CuePersonal.gs` |  | Requests | 1 | 3 | 5 | 5 |
| `CuePipeline.gs` |  | Pipeline, Requests | 1 | 1 | 8 | 8 |
| `CueProjectLog.gs` |  |  | 0 | 0 | 4 | 5 |
| `CueReady.gs` | `find_similar_projects`, `get_readiness`, `list_project_files`, `search_projects` | Requests | 1 | 1 | 4 | 7 |
| `CueRelnotes.gs` |  | Release Notes, Requests | 0 | 1 | 6 | 6 |
| `CueRfpSend.gs` | `rfp_outbox`, `rfp_sent` |  | 0 | 0 | 3 | 8 |
| `CueRoute.gs` |  | Routing examples | 0 | 0 | 10 | 15 |
| `CueSchedule.gs` |  | Requests, Schedule | 0 | 0 | 7 | 15 |
| `CueStyle.gs` |  | Requests, Style | 0 | 1 | 12 | 4 |
| `CueSupplier.gs` | `handoff_put`, `register_supplier`, `save_supplier_file`, `supplier_check` |  | 2 | 1 | 3 | 7 |
| `CueSweep.gs` | `get_project_board` | Chase log, Requests, Rules | 1 | 0 | 16 | 13 |
| `CueSweepAccr.gs` | `accreditation_gaps`, `log_accreditation_reminder` |  | 0 | 0 | 0 | 6 |
| `CueSweepAward.gs` |  |  | 0 | 0 | 0 | 4 |
| `CueSweepFunnel.gs` |  |  | 1 | 0 | 2 | 8 |
| `CueSweepHubspot.gs` |  |  | 0 | 0 | 0 | 2 |
| `CueSweepPay.gs` | `overdue_billings`, `send_payment_chasers` |  | 0 | 0 | 0 | 3 |
| `CueSweepRfq.gs` |  |  | 0 | 0 | 0 | 5 |
| `CueSweepSignature.gs` | `list_unsigned_docs`, `send_doc_reminder` |  | 0 | 0 | 0 | 4 |
| `CueTeach.gs` |  | Memory, Requests, Workflows | 0 | 3 | 6 | 8 |
| `CueText.gs` |  |  | 0 | 0 | 50 | 0 |
| `CueTickTick.gs` |  |  | 0 | 0 | 3 | 4 |
| `CueToday.gs` |  | Requests | 0 | 0 | 1 | 3 |
| `CueTri.gs` | `add_tri_items` | Requests | 0 | 0 | 2 | 4 |
| `CueTriage.gs` |  | Triage log, Triage rules | 1 | 1 | 7 | 6 |
| `CueTutor.gs` |  | Patterns | 1 | 0 | 4 | 6 |
| `CueUsage.gs` |  | AI Runs, Requests | 0 | 0 | 2 | 4 |
| `CueVendor.gs` | `supplier_lookup` | Requests | 2 | 1 | 3 | 7 |
| `CueWorkflow.gs` |  | Requests, Workflows | 2 | 1 | 3 | 4 |

## 5. Shared helpers

Names used by 5 or more other files, and the file that holds them.

| Helper | Lives in | Used by files |
|---|---|---|
| `cueNow_` | `Cue.gs` | 50 |
| `cueStr_` | `CueText.gs` | 49 |
| `cueChat_` | `Cue.gs` | 38 |
| `cueBridge_` | `CueBridge.gs` | 33 |
| `cueLocked_` | `Cue.gs` | 33 |
| `cueSheet_` | `Cue.gs` | 32 |
| `cueLoad_` | `Cue.gs` | 30 |
| `cueProp_` | `Cue.gs` | 30 |
| `cueSave_` | `Cue.gs` | 29 |
| `cueAiAll_` | `CueAi.gs` | 27 |
| `cueOwner_` | `Cue.gs` | 27 |
| `CUE_VERSION_` | `Cue.gs` | 24 |
| `cueEmail_` | `CueText.gs` | 24 |
| `cueGpt_` | `CueAi.gs` | 22 |
| `cueClaude_` | `CueAi.gs` | 19 |
| `cueMetrics_` | `Cue.gs` | 19 |
| `cueSummary_` | `Cue.gs` | 16 |
| `cuePh_` | `CueDates.gs` | 15 |
| `cueResume` | `Cue.gs` | 14 |
| `cueView_` | `Cue.gs` | 14 |
| `CUE_GMAIL_` | `CueGmail.gs` | 13 |
| `cueGmailSend_` | `CueGmail.gs` | 12 |
| `cueGmail_` | `CueGmail.gs` | 12 |
| `cueRows_` | `Cue.gs` | 11 |
| `cueKey_` | `CueAi.gs` | 10 |
| `cueMe_` | `Cue.gs` | 10 |
| `cueName_` | `CueText.gs` | 10 |
| `cueRunLeased_` | `Cue.gs` | 9 |
| `cueAddDays_` | `CueDates.gs` | 8 |
| `cueAskOpen_` | `CueRoute.gs` | 8 |
| `cueGmailDraft_` | `CueGmail.gs` | 8 |
| `cueKind_` | `CueSweep.gs` | 8 |
| `cueOwnDomain_` | `CueGmail.gs` | 8 |
| `cueWords_` | `Cue.gs` | 8 |
| `CUE_DRIVE_` | `CueFiles.gs` | 7 |
| `cueDrive_` | `CueFiles.gs` | 7 |
| `cueRecent_` | `Cue.gs` | 7 |
| `cueStyleFor_` | `CueStyle.gs` | 7 |
| `CUE_DATE_RE_` | `CueText.gs` | 6 |
| `cueAskPick` | `CueRoute.gs` | 6 |
| `cueBridgeParse_` | `CueBridge.gs` | 6 |
| `cueBridgePlan_` | `CueBridge.gs` | 6 |
| `cueBridgeReq_` | `CueBridge.gs` | 6 |
| `cueCanvasFind_` | `CueCanvas.gs` | 6 |
| `cueR2_` | `CueText.gs` | 6 |
| `cueStyleSignOff_` | `CueStyle.gs` | 6 |
| `cueTerm_` | `CueText.gs` | 6 |
| `cueBridgeAll_` | `CueBridge.gs` | 5 |
| `cueCloseSuperseded_` | `Cue.gs` | 5 |
| `cueFilesParts_` | `CueFiles.gs` | 5 |
| `cueGmailAll_` | `CueTriage.gs` | 5 |
| `cueGmailReply_` | `CueGmail.gs` | 5 |
| `cueSend` | `Cue.gs` | 5 |
| `cueSendWith_` | `Cue.gs` | 5 |

## 6. What the page calls

Server functions `Index.html` calls, by the file that holds them.

- `Cue.gs`: `cueApprove`, `cueAsNew`, `cueCancelIntake`, `cueCloseTask`, `cueDrafts`, `cueFixAccess`, `cueFolders`, `cueReject`, `cueReopen`, `cueRescan`, `cueRetry`, `cueRfq`, `cueRfqPick`, `cueRun`, `cueSameAnswer`, `cueSend`, `cueState`, `cueSupplierCanvas`, `cueSupplierSaved`
- `CueAccred.gs`: `cueAcDone`
- `CueAdmin.gs`: `cueAdminChasers`, `cueAdminLog`, `cueAdminRelnotes`, `cueAdminTriage`, `cueAdminTriageDel`
- `CueAdminCanvas.gs`: `cueAdminCanvasChaseSend`, `cueAdminCanvasChasers`, `cueAdminSnBoard`, `cueAdminSnItems`, `cueAdminSnPrepare`, `cueAdminSnSend`
- `CueBatch.gs`: `cueBatchAdd`, `cueBatchCancel`, `cueBatchStart`, `cueBatchTake`
- `CueBids.gs`: `cueBidsClarifyCancel`, `cueBidsClarifySend`, `cueBidsClose`, `cueBidsDecide`, `cueBidsStartIntake`
- `CueExpense.gs`: `cueExpense`
- `CueFiles.gs`: `cueFileData`, `cueUpload`
- `CueFinance.gs`: `cueFinSave`, `cueFinSheet`
- `CueFunnel.gs`: `cueFunnelDone`, `cueFunnelTaskDone`
- `CueGptTasks.gs`: `cueGtAct`, `cueGtClose`, `cueGtDraftAll`
- `CueHelp.gs`: `cueHelpAct`
- `CueHubspot.gs`: `cueHsClose`, `cueHsLookup`
- `CueNewMail.gs`: `cueNmItem`
- `CuePipeline.gs`: `cuePipeDone`, `cuePipeFollowUps`
- `CueReady.gs`: `cueReadyFollowups`, `cueReadyPick`, `cueReadyRecheck`
- `CueRoute.gs`: `cueAskPick`, `cueWrongCommand`
- `CueSchedule.gs`: `cueSchedDelete`, `cueSchedRunNow`, `cueSchedSet`, `cueSchedules`
- `CueSweep.gs`: `cueArchive`, `cueCloseOlder`, `cueCloseThread`, `cueRules`, `cueRulesSave`, `cueSweepAct`, `cueSweepCancel`, `cueSweepItem`
- `CueTeach.gs`: `cueLearnChats`, `cueMyRuleSave`, `cueMyRules`, `cueSettings`
- `CueTutor.gs`: `cueMyPatternDemote`, `cueTutorSet`
- `CueUsage.gs`: `cueUsage`, `cueUsagePrices`
- `CueVendor.gs`: `cueVendorRfqs`
