# Cue feature map

Made from the code by `node tools/map.mjs` (structure review phase 1, item 1.1). Do not edit by hand: change the code and run
the script again. `test/cue.test.js` fails when this file is out of date.

Counts: 66 server files, 1310 top-level names, 31 task kinds, 31 word checks before the
chat call, 12 background jobs in the 5-minute trigger, 85 page-to-server functions, 64 bridge actions in the Canvas bridge copy.

## 1. Commands (task kinds)

A kind is the name a task carries from start to card. Each kind is one line in `cueCommands_` (`CueCommands.gs`): its run, its Approve
and its "stopped" line. "Wrong command?" is its name in that list (`CUE_ROUTE_CMDS_`). Card family is its line in the page's `kindOf`
(`IndexThreads.html`): Approve (one write Kiko approves), Draft and send (emails), Info (an answer or report) or Question (buttons that pick).
Page checks count the kind's remaining `kind === ...` checks in the page.

| Kind | What it is | Wrong command? | Card family | Runs in | Approve in | Page checks |
|---|---|---|---|---|---|---|
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
| `gtask` | ChatGPT task |  | Draft and send | `CueGptTasks.gs` | intake (default) | 1 |
| `help` | Help Q&A |  | Info | `CueHelp.gs` | intake (default) | 2 |
| `hubspot` | HubSpot clean-up |  | Approve | `CueHubspot.gs` | `CueHubspot.gs` | 1 |
| `inbox` | Page only (not in the command list) |  | Info | none | none | 4 |
| `intake` | Project intake | Project intake | Approve | `CueIntake.gs` | intake (default) | 0 |
| `memory` | Learning your memory |  | Approve | `CueTeach.gs` | `CueTeach.gs` | 5 |
| `newmail` | Page only (not in the command list) |  | Question | none | none | 3 |
| `own` | Page only (not in the command list) |  |  | none | none | 2 |
| `personal` | Personal expense |  | Approve | `CuePersonal.gs` | `CuePersonal.gs` | 3 |
| `pipeline` | Pipeline review | Pipeline review | Draft and send | `CuePipeline.gs` | `CuePipeline.gs` | 1 |
| `process` | Learning your process |  | Approve | `CueTeach.gs` | `CueTeach.gs` | 3 |
| `readiness` | Readiness check | Readiness check | Draft and send | `CueReady.gs` | `CueReady.gs` | 1 |
| `relay` | AI relay |  | Question | `CueIntake.gs` (default) | intake (default) | 2 |
| `relnotes` | Page only (not in the command list) |  | Approve | none | none | 1 |
| `staff` | Page only (not in the command list) |  |  | none | none | 1 |
| `status` | Status report |  | Draft and send | `CueStatus.gs` | `CueStatus.gs` | 1 |
| `style` | Learning your style |  | Approve | `CueStyle.gs` | `CueStyle.gs` | 3 |
| `supplier` | Supplier registration |  | Approve | `CueSupplier.gs` | `CueSupplier.gs` | 4 |
| `sweep` | Morning sweep |  | Draft and send | `CueSweep.gs` | `CueSweep.gs` | 1 |
| `vendor` | Supplier search | Supplier search | Draft and send | `CueVendor.gs` | `CueVendor.gs` | 1 |
| `workflow` | Workflow map | Workflow map | Approve | `CueWorkflow.gs` | `CueWorkflow.gs` | 1 |

## 2. Routing order

Who answers which words first. `cueSendWith_` (in `Cue.gs`) goes down `cueRoutes_` (`CueCommands.gs`); the first that answers wins.
If none answers, the AI chat call reads the message, and its answer starts the first command in the second list that it filled in.

1. `askreply`: Kiko types "approve" or "not" for an Approve question (ACC-12, no buttons in Ask Cue chat). Checks `cueAskSaid_` in `CueEditLog.gs`.
2. `mailchat`: Kiko's reply in an email chat or a new-kind-of-email chat (ACC-5, ACC-6). Checks `cueMcSaid_` in `CueMailChat.gs`.
3. `learn`: "remember: …" saves a rule. Checks `cueLearnSaid_` in `CueTeach.gs`.
4. `relay`: "tell Claude: …" relay note. Checks `cueRelaySaid_` in `CueRelay.gs`.
5. `help`: "help: …" Help Q&A answer. Checks `cueHelpSaid_` in `CueHelp.gs`.
6. `ticktick`: "connect ticktick". Checks `cueTtConnectSaid_` in `CueTickTick.gs`.
7. `schedule`: "schedule …" and "show my schedules". Checks `cueSchedSaid_` in `CueSchedule.gs`.
8. `transfer`: Transfer lookup. Checks `cueTxSaid_` in `CueLookup.gs`.
9. `invoice`: Invoice line edit. Checks `cueInvSaid_` in `CueLookup.gs`.
10. `allow`: "allow cue to read\|edit …". Checks `cueAllowSaid_` in `CueEdit.gs`.
11. `contact-scan`: Old-email contact scan. Checks `cueCsSaid_` in `CueContactScan.gs`.
12. `bids-redo`: "redo" in a Bid check thread. Checks `cueBidsRedoSaid_`.
13. `cecost-reply`: Reply to a CE cost question. Checks `cueCecReply_` in `CueCeCost.gs`.
14. `cecost`: "update CE cost for …". Checks `cueCecAsked_` in `CueCeCost.gs`; starts `cueCecStart_` in `CueCeCost.gs`.
15. `canvas`: Open in Canvas. Checks `cueCanvasSaid_` in `CueCanvas.gs`.
16. `phased-reply`: Reply while a phased intake card waits. Checks `cuePhReply_` in `CueIntakePhases.gs`.
17. `style`: "learn my style". Checks `CUE_STYLE_RE_` in `CueStyle.gs`; starts `cueStyleStart_` in `CueStyle.gs`.
18. `memory`: "learn my memory". Checks `CUE_MEM_RE_` in `CueTeach.gs`; starts `cueTeachStart_` in `CueTeach.gs`.
19. `process`: "learn my process". Checks `CUE_PROC_RE_` in `CueTeach.gs`; starts `cueTeachStart_` in `CueTeach.gs`.
20. `memory-paste`: Pasted memory text. Checks `cueMemPaste_` in `CueTeach.gs`; starts `cueTeachStart_` in `CueTeach.gs`.
21. `money-taught`: A money phrase Kiko taught word for word. Checks `cueRouteExact_` in `CueRoute.gs`; starts `cueFinance_` in `CueFinance.gs`.
22. `gtask`: "run daily plan" and other ChatGPT tasks. Checks `cueGtAsked_` in `CueGptTasks.gs`; starts `cueGtStart_` in `CueGptTasks.gs`.
23. `personal`: Personal expense (Kiko's own words). Checks `cueIsPersonal_` in `CuePersonal.gs`; starts `cuePersonalStart_` in `CuePersonal.gs`.
24. `money`: Money question. Checks `cueMoneyAsked_`; starts `cueFinance_` in `CueFinance.gs`.
25. `workflow-reply`: Reply in a waiting workflow map. Checks `cueWorkflowWaiting_`; starts `cueWorkflowReply_` in `CueWorkflow.gs`.
26. `workflow-files`: Files with a map word. Checks `cueWorkflowAsked_` in `CueWorkflow.gs`; starts `cueWorkflowFiles_`.
27. `hubspot`: HubSpot clean-up. Checks `cueHsAsked_` in `CueHubspot.gs`; starts `cueHsStart_` in `CueHubspot.gs`.
28. `status`: "status report", "status of …". Checks `cueStatusSaid_`.
29. `bids-intake`: "do intake for <bid>". Checks `cueBidsFor_` in `CueBids.gs`; starts `cueBidsIntake_` in `CueBids.gs`.
30. `bids`: Bid check. Checks `cueBidsAsked_` in `CueBids.gs`; starts `cueBidsStart_` in `CueBids.gs`.
31. `recost`: "cost them", "re-cost" in a thread with a read. Checks `cueRecostStart_` in `Cue.gs`.

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
| 3 | Relay notes | `cueRelaySweep_` | `CueRelay.gs` | notes claude.ai added to the Relay tab |
| 4 | ChatGPT tasks | `cueRelayTasks_` | `CueRelay.gs` | tasks ChatGPT handed over (if the one-off trigger missed them) |
| 5 | FSA and AR Send later | `cueArDue_` | `CueAr.gs` | CREW-DOCS-2026-10-26: FSAs and ARs Kiko chose to Send later |
| 6 | Emails waiting check | `cueMaTick_` | `CueMailAlerts.gs` | CUE-MAIL-ALERTS-2026-10-27: Emails waiting file for Canvas, every 10 minutes |
| 7 | Project log | `cuePlogFlush_` | `CueProjectLog.gs` | CUE-PROJECT-LOG-2026-10-27: emails, task summaries and chasers to the project logs |
| 8 | CRM email log | `cueCrmLogTick_` | `CueCrmLog.gs` |  |
| 9 | Release notes at 8 PM | `cueRnDue_` | `CueRelnotes.gs` | CUE-RELNOTES-2026-10-27: release notes Kiko approved before 8 PM                 // CUE-CRM-EMAIL-LOG-2026-10-26: client emails to Accounts › Activity, hourly |
| 10 | New mail | `cueNmTick_` | `CueNewMail.gs` | CUE-NEW-MAIL-2026-10-27: new mail in Kiko's inbox and info@, Claude sorts every 30 min |
| 11 | New PhilGEPS read | `cueBidsPgTick_` | `CueBidsPg.gs` | CUE-BIDS-PG-2026-11-01: the public bulletin board, hourly 7 AM to 7 PM, no AI |
| 12 | Schedules | `cueSchedTick_` | `CueSchedule.gs` | last, after the tasks: a task it starts runs on the next tick in its own 6 minutes |

## 4. Files: what each one touches

Bridge actions are names from `test/fixtures/ZapBridge.gs` found in the file. AI sites count the places a file calls GPT or Claude,
not calls per run. "Used by" and "Uses" count other files.

| File | Canvas bridge actions | Sheet tabs | GPT sites | Claude sites | Used by | Uses |
|---|---|---|---|---|---|---|
| `Cue.gs` | `search_projects` | Chat, Requests | 0 | 0 | 59 | 42 |
| `CueAdmin.gs` |  | Job Runs, Triage rules | 0 | 0 | 4 | 10 |
| `CueAdminCanvas.gs` | `run_now_list`, `run_now_send`, `sn_board`, `sn_items`, `sn_prepare`, `sn_send` |  | 0 | 0 | 2 | 5 |
| `CueAgent.gs` | `contains` |  | 0 | 0 | 1 | 8 |
| `CueAi.gs` |  | AI Runs | 1 | 1 | 35 | 3 |
| `CueAr.gs` | `crew_docs`, `crew_docs_job`, `crew_docs_make`, `crew_docs_send` | Requests | 0 | 0 | 5 | 4 |
| `CueBatch.gs` |  |  | 0 | 0 | 2 | 3 |
| `CueBids.gs` |  | Requests | 1 | 0 | 7 | 5 |
| `CueBidsPg.gs` |  |  | 0 | 0 | 2 | 3 |
| `CueBridge.gs` | `claim_plan` |  | 0 | 0 | 37 | 3 |
| `CueCanvas.gs` | `find_similar_projects`, `search_projects` |  | 0 | 0 | 11 | 5 |
| `CueCeCost.gs` | `ce_lines`, `ce_update_costs`, `search_projects` | Requests | 1 | 0 | 4 | 9 |
| `CueChange.gs` | `list_project_files` | Requests | 1 | 0 | 4 | 7 |
| `CueCheck.gs` | `accreditation_gaps`, `ar_email`, `canvas_link`, `ce_lines`, `claim_plan`, `crew_docs`, `crew_docs_job`, `crew_docs_send`, `expense_evidence`, `finance_snapshot`, `find_similar_projects`, `get_project`, `get_project_board`, `get_readiness`, `inbox_new`, `intake_evidence`, `list_project_files`, `list_unsigned_docs`, `mail_waiting`, `overdue_billings`, `rfp_outbox`, `search_projects`, `send_doc_reminder`, `send_payment_chasers`, `status_digest`, `supplier_check`, `supplier_lookup` | Requests | 0 | 0 | 4 | 31 |
| `CueCheckKey.gs` |  |  | 0 | 0 | 2 | 0 |
| `CueCommands.gs` |  |  | 0 | 0 | 2 | 34 |
| `CueContactScan.gs` |  | Contact scan | 0 | 1 | 2 | 9 |
| `CueContacts.gs` |  |  | 0 | 0 | 3 | 6 |
| `CueCrmLog.gs` | `mail_waiting` |  | 0 | 0 | 2 | 4 |
| `CueDates.gs` |  |  | 0 | 0 | 16 | 0 |
| `CueEdit.gs` | `contains` |  | 0 | 1 | 4 | 6 |
| `CueEditLog.gs` |  | Canvas edits | 0 | 0 | 3 | 5 |
| `CueExpense.gs` | `expense_evidence`, `record_expense` | Requests | 1 | 1 | 4 | 5 |
| `CueFiles.gs` | `save_project_file` |  | 0 | 0 | 15 | 3 |
| `CueFinance.gs` | `finance_snapshot` | Requests | 1 | 1 | 3 | 3 |
| `CueGmail.gs` |  |  | 0 | 0 | 25 | 3 |
| `CueGptTasks.gs` | `get_project_board`, `get_readiness` | ChatGPT findings, Requests | 1 | 0 | 6 | 8 |
| `CueHelp.gs` |  | Requests | 0 | 1 | 3 | 4 |
| `CueHubspot.gs` | `hubspot_fix`, `hubspot_scan` | HubSpot Cleanup, Requests | 1 | 1 | 4 | 4 |
| `CueIntake.gs` | `apply_intake`, `find_similar_projects`, `intake_evidence`, `make_project_folders`, `submit_intake` |  | 3 | 1 | 3 | 9 |
| `CueIntakePhases.gs` | `client_check`, `find_similar_projects`, `intake_add_lines`, `intake_add_project`, `intake_evidence`, `intake_log_rfqs`, `intake_remove`, `intake_save_costs`, `search_projects` |  | 1 | 3 | 5 | 9 |
| `CueJobs.gs` |  | Job Runs | 0 | 0 | 4 | 12 |
| `CueLookup.gs` |  |  | 0 | 0 | 2 | 5 |
| `CueMail.gs` |  | Requests | 1 | 0 | 2 | 6 |
| `CueMailAlerts.gs` |  |  | 0 | 0 | 2 | 5 |
| `CueMailChat.gs` |  | Requests | 0 | 1 | 2 | 8 |
| `CueMailTypes.gs` |  | Triage rules, Triage types | 0 | 0 | 4 | 4 |
| `CueNewMail.gs` | `get_project_board`, `inbox_new`, `mail_waiting` | Requests, Triage log, Triage rules | 0 | 0 | 4 | 8 |
| `CuePersonal.gs` |  | Requests | 1 | 3 | 4 | 5 |
| `CuePipeline.gs` |  | Pipeline, Requests | 1 | 1 | 9 | 5 |
| `CueProjectLog.gs` |  |  | 0 | 0 | 4 | 5 |
| `CueReady.gs` | `find_similar_projects`, `get_readiness`, `list_project_files`, `search_projects` | Requests | 1 | 1 | 5 | 7 |
| `CueRelay.gs` | `ar_list`, `ce_lines`, `finance_snapshot`, `get_project`, `get_project_board`, `get_readiness`, `list_project_files`, `overdue_billings`, `search_projects`, `status_digest` | Relay, Requests | 0 | 0 | 6 | 10 |
| `CueRelnotes.gs` |  | Release Notes, Requests | 0 | 1 | 6 | 6 |
| `CueRfpSend.gs` | `rfp_outbox`, `rfp_sent` |  | 0 | 0 | 2 | 8 |
| `CueRoute.gs` |  | Routing examples | 0 | 0 | 11 | 15 |
| `CueSchedule.gs` |  | Requests, Schedule | 0 | 0 | 7 | 15 |
| `CueStatus.gs` | `add_tri_items`, `find_similar_projects`, `search_projects`, `status_digest` | AI Runs, Requests | 2 | 1 | 4 | 12 |
| `CueStyle.gs` |  | Requests, Style | 0 | 1 | 15 | 4 |
| `CueSupplier.gs` | `handoff_put`, `register_supplier`, `save_supplier_file`, `supplier_check` |  | 2 | 1 | 3 | 7 |
| `CueSweep.gs` | `get_project_board` | Chase log, Requests, Rules | 1 | 0 | 16 | 11 |
| `CueSweepAccr.gs` | `accreditation_gaps`, `log_accreditation_reminder` |  | 0 | 0 | 0 | 6 |
| `CueSweepAward.gs` |  |  | 0 | 0 | 0 | 4 |
| `CueSweepFunnel.gs` |  |  | 1 | 0 | 2 | 6 |
| `CueSweepHubspot.gs` |  |  | 0 | 0 | 0 | 2 |
| `CueSweepPay.gs` | `overdue_billings`, `send_payment_chasers` |  | 0 | 0 | 0 | 3 |
| `CueSweepRfq.gs` |  |  | 0 | 0 | 0 | 5 |
| `CueSweepSignature.gs` | `list_unsigned_docs`, `send_doc_reminder` |  | 0 | 0 | 0 | 4 |
| `CueTeach.gs` |  | Memory, Requests, Workflows | 0 | 3 | 7 | 9 |
| `CueText.gs` |  |  | 0 | 0 | 54 | 0 |
| `CueTickTick.gs` |  |  | 0 | 0 | 3 | 4 |
| `CueTriage.gs` |  | Triage log, Triage rules | 1 | 1 | 8 | 6 |
| `CueTutor.gs` |  | Patterns | 1 | 0 | 4 | 6 |
| `CueUsage.gs` |  | AI Runs, Requests | 0 | 0 | 3 | 4 |
| `CueVendor.gs` | `supplier_lookup` | Requests | 2 | 1 | 3 | 7 |
| `CueWorkflow.gs` |  | Requests, Workflows | 2 | 1 | 3 | 4 |

## 5. Shared helpers

Names used by 5 or more other files, and the file that holds them.

| Helper | Lives in | Used by files |
|---|---|---|
| `cueStr_` | `CueText.gs` | 53 |
| `cueNow_` | `Cue.gs` | 51 |
| `cueChat_` | `Cue.gs` | 40 |
| `cueProp_` | `Cue.gs` | 34 |
| `cueLocked_` | `Cue.gs` | 33 |
| `cueSheet_` | `Cue.gs` | 33 |
| `cueBridge_` | `CueBridge.gs` | 32 |
| `cueAiAll_` | `CueAi.gs` | 30 |
| `cueLoad_` | `Cue.gs` | 30 |
| `cueSave_` | `Cue.gs` | 29 |
| `cueOwner_` | `Cue.gs` | 28 |
| `CUE_VERSION_` | `Cue.gs` | 23 |
| `cueEmail_` | `CueText.gs` | 23 |
| `cueGpt_` | `CueAi.gs` | 23 |
| `cueClaude_` | `CueAi.gs` | 21 |
| `cueMetrics_` | `Cue.gs` | 18 |
| `CUE_GMAIL_` | `CueGmail.gs` | 16 |
| `cueSummary_` | `Cue.gs` | 16 |
| `cuePh_` | `CueDates.gs` | 14 |
| `cueView_` | `Cue.gs` | 14 |
| `cueResume` | `Cue.gs` | 13 |
| `cueGmailSend_` | `CueGmail.gs` | 12 |
| `cueGmail_` | `CueGmail.gs` | 12 |
| `cueKey_` | `CueAi.gs` | 11 |
| `cueMe_` | `Cue.gs` | 11 |
| `cueName_` | `CueText.gs` | 11 |
| `cueRows_` | `Cue.gs` | 10 |
| `cueRunLeased_` | `Cue.gs` | 10 |
| `cueAddDays_` | `CueDates.gs` | 8 |
| `cueAskOpen_` | `CueRoute.gs` | 8 |
| `cueGmailDraft_` | `CueGmail.gs` | 8 |
| `cueKind_` | `CueSweep.gs` | 8 |
| `cueOwnDomain_` | `CueGmail.gs` | 8 |
| `cueStyleFor_` | `CueStyle.gs` | 8 |
| `cueWords_` | `Cue.gs` | 8 |
| `CUE_DATE_RE_` | `CueText.gs` | 7 |
| `CUE_DRIVE_` | `CueFiles.gs` | 7 |
| `cueAskPick` | `CueRoute.gs` | 7 |
| `cueBridgeParse_` | `CueBridge.gs` | 7 |
| `cueBridgeReq_` | `CueBridge.gs` | 7 |
| `cueDrive_` | `CueFiles.gs` | 7 |
| `cueRecent_` | `Cue.gs` | 7 |
| `cueStyleSignOff_` | `CueStyle.gs` | 7 |
| `cueTerm_` | `CueText.gs` | 7 |
| `cueBridgePlan_` | `CueBridge.gs` | 6 |
| `cueCanvasFind_` | `CueCanvas.gs` | 6 |
| `cueR2_` | `CueText.gs` | 6 |
| `cueSendWith_` | `Cue.gs` | 6 |
| `CUE_TABS_` | `Cue.gs` | 5 |
| `cueBridgeAll_` | `CueBridge.gs` | 5 |
| `cueFilesParts_` | `CueFiles.gs` | 5 |
| `cueGmailAll_` | `CueTriage.gs` | 5 |
| `cueGmailReply_` | `CueGmail.gs` | 5 |
| `cueMnlDay_` | `CuePipeline.gs` | 5 |
| `cueSend` | `Cue.gs` | 5 |
| `cueTalk_` | `Cue.gs` | 5 |

## 6. What the page calls

Server functions `Index.html` calls, by the file that holds them.

- `Cue.gs`: `cueApprove`, `cueAsNew`, `cueCancelIntake`, `cueCloseTask`, `cueDrafts`, `cueFixAccess`, `cueFolders`, `cueReject`, `cueReopen`, `cueRescan`, `cueRetry`, `cueRfq`, `cueRfqPick`, `cueRun`, `cueSameAnswer`, `cueSend`, `cueState`, `cueSupplierCanvas`, `cueSupplierSaved`
- `CueAdmin.gs`: `cueAdminChasers`, `cueAdminLog`, `cueAdminRelnotes`, `cueAdminTriage`, `cueAdminTriageDel`
- `CueAdminCanvas.gs`: `cueAdminCanvasChaseSend`, `cueAdminCanvasChasers`, `cueAdminSnBoard`, `cueAdminSnItems`, `cueAdminSnPrepare`, `cueAdminSnSend`
- `CueBatch.gs`: `cueBatchAdd`, `cueBatchCancel`, `cueBatchStart`, `cueBatchTake`
- `CueBids.gs`: `cueBidsClose`
- `CueEditLog.gs`: `cueAdminEditUndo`, `cueAdminEdits`
- `CueExpense.gs`: `cueExpense`
- `CueFiles.gs`: `cueFileData`, `cueUpload`
- `CueFinance.gs`: `cueFinSave`, `cueFinSheet`
- `CueGptTasks.gs`: `cueGtAct`, `cueGtClose`, `cueGtDraftAll`
- `CueHelp.gs`: `cueHelpAct`
- `CueHubspot.gs`: `cueHsClose`, `cueHsLookup`
- `CueMailTypes.gs`: `cueAdminTypeSender`, `cueAdminTypes`, `cueAdminTypesSave`
- `CueNewMail.gs`: `cueNmItem`
- `CuePipeline.gs`: `cuePipeDone`, `cuePipeFollowUps`
- `CueReady.gs`: `cueReadyFollowups`, `cueReadyPick`, `cueReadyRecheck`
- `CueRelay.gs`: `cueRelayAct`, `cueRelayGate`, `cueRelayKeys`, `cueRelayUrlSet`, `cueRelayWrites`
- `CueRoute.gs`: `cueAskPick`, `cueWrongCommand`
- `CueSchedule.gs`: `cueSchedDelete`, `cueSchedRunNow`, `cueSchedSet`, `cueSchedules`
- `CueStatus.gs`: `cueStatusDone`, `cueStatusTri`
- `CueSweep.gs`: `cueArchive`, `cueRules`, `cueRulesSave`, `cueSweepAct`, `cueSweepCancel`, `cueSweepItem`
- `CueTeach.gs`: `cueLearnChats`, `cueMyRuleSave`, `cueMyRules`, `cueSettings`
- `CueTutor.gs`: `cueMyPatternDemote`, `cueTutorSet`
- `CueUsage.gs`: `cueUsage`, `cueUsagePrices`
- `CueVendor.gs`: `cueVendorRfqs`
