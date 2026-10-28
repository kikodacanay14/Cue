# Cue feature map

Made from the code by `node tools/map.mjs` (structure review phase 1, item 1.1). Do not edit by hand: change the code and run
the script again. `test/cue.test.js` fails when this file is out of date.

Counts: 52 server files, 1110 top-level names, 26 task kinds, 39 routing checks before the
chat call, 9 background jobs in the 5-minute trigger, 68 page-to-server functions, 55 bridge actions in the Canvas bridge copy.

## 1. Commands (task kinds)

A kind is the name a task carries from start to card. Each column is one of the places the kind is written by hand today.

| Kind | What it is | Runs in | Approve in | Page checks |
|---|---|---|---|---|
| `ar` | Receipts | `CueAr.gs` | `CueAr.gs` | 7 |
| `avoid` | Page only (no run or approve on the server) | none | none | 1 |
| `bids` | Bid check | `CueBids.gs` | none | 3 |
| `cecost` | CE cost update | `CueCeCost.gs` | `CueCeCost.gs` | 6 |
| `change` | Page only (no run or approve on the server) | none | `CueChange.gs` | 4 |
| `email` | Drafting the email | `CueMail.gs` | `CueMail.gs` | 5 |
| `example` | Page only (no run or approve on the server) | none | none | 2 |
| `expense` | Page only (no run or approve on the server) | none | `CueExpense.gs` | 5 |
| `finance` | Money question | none | none | 4 |
| `gtask` | ChatGPT task | `CueGptTasks.gs` | none | 3 |
| `help` | Reading the Help Q&A list from Canvas | `CueHelp.gs` | none | 4 |
| `hubspot` | HubSpot clean-up | `CueHubspot.gs` | `CueHubspot.gs` | 4 |
| `inbox` | Page only (no run or approve on the server) | none | none | 4 |
| `intake` | Project intake | `CueIntake.gs` (default) | `CueIntake.gs` (default) | 0 |
| `memory` | Learning your memory | `CueTeach.gs` | none | 7 |
| `personal` | Personal expense | `CuePersonal.gs` | `CuePersonal.gs` | 6 |
| `pipeline` | Pipeline review | `CuePipeline.gs` | `CuePipeline.gs` | 3 |
| `process` | Learning your process | `CueTeach.gs` | none | 5 |
| `readiness` | Readiness check | `CueReady.gs` | `CueReady.gs` | 3 |
| `relay` | Page only (no run or approve on the server) | none | none | 4 |
| `status` | Status report | `CueStatus.gs` | `CueStatus.gs` | 2 |
| `style` | Learning your style | `CueStyle.gs` | `CueStyle.gs` | 5 |
| `supplier` | Supplier registration | `CueSupplier.gs` | `CueSupplier.gs` | 6 |
| `sweep` | Morning sweep | `CueSweep.gs` | `CueSweep.gs` | 2 |
| `vendor` | Supplier search | `CueVendor.gs` | `CueVendor.gs` | 4 |
| `workflow` | Workflow map | `CueWorkflow.gs` | `CueWorkflow.gs` | 4 |

## 2. Routing order

What `cueSendWith_` (in `Cue.gs`) checks, in this order, before or around the AI chat call. The first match wins.
`talk.x` lines are answers from the chat call itself.

1. `cueLearnSaid_` in `CueTeach.gs`
2. `cueRelaySaid_` in `CueRelay.gs`
3. `cueHelpSaid_` in `CueHelp.gs`
4. `cueTtConnectSaid_` in `CueTickTick.gs`
5. `cueSchedSaid_` in `CueSchedule.gs`
6. `cueTxSaid_` in `CueLookup.gs`
7. `cueInvSaid_` in `CueLookup.gs`
8. `cueAllowSaid_` in `CueEdit.gs`
9. `cueCsSaid_` in `CueContactScan.gs`
10. `cueBidsThread_` in `Cue.gs`
11. `cueBidsFor_` in `CueBids.gs`
12. `cueBidsRedo_` in `CueBids.gs`
13. `cueCecReply_` in `CueCeCost.gs`
14. `cueCecAsked_` in `CueCeCost.gs`
15. `cueCanvasSaid_` in `CueCanvas.gs`
16. `cuePhReply_` in `CueIntakePhases.gs`
17. `CUE_STYLE_RE_` in `CueStyle.gs`
18. `CUE_MEM_RE_` in `CueTeach.gs`
19. `CUE_PROC_RE_` in `CueTeach.gs`
20. `cueMemPaste_` in `CueTeach.gs`
21. `cueRouteExact_` in `CueRoute.gs`
22. `cueGtAsked_` in `CueGptTasks.gs`
23. `cueIsPersonal_` in `CuePersonal.gs`
24. `cueFinAsk_` in `CueFinance.gs`
25. `cueWorkflowReply_` in `CueWorkflow.gs`
26. `cueWorkflowAsked_` in `CueWorkflow.gs`
27. `cueHsAsked_` in `CueHubspot.gs`
28. `cueStAsked_` in `CueStatus.gs`
29. `cueBidsAsked_` in `CueBids.gs`
30. `cueIsSupplier_` in `CueSupplier.gs`
31. `cueTalk_` in `Cue.gs`
32. `talk.workflow` (chat call)
33. `talk.readiness` (chat call)
34. `talk.pipeline` (chat call)
35. `talk.start_ar` (chat call)
36. `talk.email` (chat call)
37. `talk.vendor` (chat call)
38. `talk.canvas_edit` (chat call)
39. `talk.start_intake` (chat call)

## 3. Background jobs (one trigger, every 5 minutes)

`cueResume` in `Cue.gs` runs these in order, resumes waiting tasks, and last runs the scheduler (`cueSchedTick_`). Each job has its own
timing inside its own code.

| # | Job | File | Note in the code |
|---|---|---|---|
| 1 | `cueSweepTick_` | `CueSweep.gs` | reminders, and 9:00 sends Kiko approved |
| 2 | `cueBidsTidyAll_` | `CueBids.gs` | once: one Bid check thread per day |
| 3 | `cueRelaySweep_` | `CueRelay.gs` | notes claude.ai added to the Relay tab |
| 4 | `cueRelayTasks_` | `CueRelay.gs` | tasks ChatGPT handed over (if the one-off trigger missed them) |
| 5 | `cueArDue_` | `CueAr.gs` | CREW-DOCS-2026-10-26: FSAs and ARs Kiko chose to Send later |
| 6 | `cueMaTick_` | `CueMailAlerts.gs` | CUE-MAIL-ALERTS-2026-10-27: Emails waiting file for Canvas, every 10 minutes |
| 7 | `cuePlogFlush_` | `CueProjectLog.gs` | CUE-PROJECT-LOG-2026-10-27: emails, task summaries and chasers to the project logs |
| 8 | `cueCrmLogTick_` | `CueCrmLog.gs` | CUE-CRM-EMAIL-LOG-2026-10-26: client emails to Accounts › Activity, hourly |
| 9 | `cueSchedTick_` | `CueSchedule.gs` |  |

## 4. Files: what each one touches

Bridge actions are names from `test/fixtures/ZapBridge.gs` found in the file. AI sites count the places a file calls GPT or Claude,
not calls per run. "Used by" and "Uses" count other files.

| File | Canvas bridge actions | Sheet tabs | GPT sites | Claude sites | Used by | Uses |
|---|---|---|---|---|---|---|
| `Cue.gs` | `search_projects` | Chat, Requests | 0 | 0 | 45 | 41 |
| `CueAi.gs` |  | AI Runs | 1 | 1 | 31 | 3 |
| `CueAr.gs` | `crew_docs`, `crew_docs_job`, `crew_docs_make`, `crew_docs_send`, `find_similar_projects` | Requests | 0 | 0 | 3 | 3 |
| `CueBatch.gs` |  |  | 0 | 0 | 2 | 3 |
| `CueBids.gs` |  | Requests | 1 | 0 | 4 | 3 |
| `CueBridge.gs` | `claim_plan` |  | 0 | 0 | 28 | 3 |
| `CueCanvas.gs` | `find_similar_projects`, `search_projects` |  | 0 | 0 | 5 | 5 |
| `CueCeCost.gs` | `ce_lines`, `ce_update_costs`, `search_projects` | Requests | 1 | 0 | 3 | 9 |
| `CueChange.gs` | `list_project_files` | Requests | 1 | 0 | 3 | 7 |
| `CueCheck.gs` | `accreditation_gaps`, `ar_email`, `canvas_link`, `ce_lines`, `claim_plan`, `crew_docs`, `crew_docs_job`, `crew_docs_send`, `expense_evidence`, `finance_snapshot`, `find_similar_projects`, `get_project`, `get_project_board`, `get_readiness`, `intake_evidence`, `list_project_files`, `list_unsigned_docs`, `mail_waiting`, `overdue_billings`, `search_projects`, `send_doc_reminder`, `send_payment_chasers`, `status_digest`, `supplier_check`, `supplier_lookup` | Requests | 0 | 0 | 3 | 23 |
| `CueCheckKey.gs` |  |  | 0 | 0 | 2 | 0 |
| `CueContactScan.gs` |  | Contact scan | 0 | 1 | 2 | 9 |
| `CueCrmLog.gs` | `mail_waiting` |  | 0 | 0 | 2 | 4 |
| `CueDates.gs` |  |  | 0 | 0 | 10 | 0 |
| `CueEdit.gs` | `contains` |  | 0 | 1 | 2 | 5 |
| `CueExpense.gs` | `expense_evidence`, `record_expense` | Requests | 1 | 1 | 3 | 5 |
| `CueFiles.gs` | `save_project_file` |  | 0 | 0 | 14 | 3 |
| `CueFinance.gs` | `finance_snapshot` | Requests | 1 | 1 | 3 | 3 |
| `CueGmail.gs` |  |  | 0 | 0 | 19 | 3 |
| `CueGptTasks.gs` | `get_project_board`, `get_readiness` | ChatGPT findings, Requests | 1 | 0 | 4 | 8 |
| `CueHelp.gs` |  | Requests | 0 | 1 | 2 | 4 |
| `CueHubspot.gs` | `hubspot_fix`, `hubspot_scan` | HubSpot Cleanup, Requests | 1 | 1 | 3 | 4 |
| `CueIntake.gs` | `apply_intake`, `find_similar_projects`, `intake_evidence`, `make_project_folders`, `submit_intake` |  | 3 | 1 | 2 | 9 |
| `CueIntakePhases.gs` | `find_similar_projects`, `intake_add_lines`, `intake_add_project`, `intake_evidence`, `intake_log_rfqs`, `intake_remove`, `intake_save_costs`, `search_projects` |  | 1 | 3 | 4 | 9 |
| `CueLookup.gs` |  |  | 0 | 0 | 2 | 5 |
| `CueMail.gs` |  | Requests | 1 | 0 | 1 | 5 |
| `CueMailAlerts.gs` |  |  | 0 | 0 | 2 | 5 |
| `CuePersonal.gs` |  | Requests | 1 | 3 | 3 | 5 |
| `CuePipeline.gs` |  | Pipeline, Requests | 1 | 1 | 6 | 5 |
| `CueProjectLog.gs` |  |  | 0 | 0 | 3 | 5 |
| `CueReady.gs` | `find_similar_projects`, `get_readiness`, `list_project_files` | Requests | 1 | 1 | 4 | 6 |
| `CueRelay.gs` | `ar_list`, `ce_lines`, `finance_snapshot`, `get_project`, `get_project_board`, `get_readiness`, `list_project_files`, `overdue_billings`, `search_projects`, `status_digest` | Relay, Requests | 0 | 0 | 4 | 10 |
| `CueRoute.gs` |  | Routing examples | 0 | 0 | 9 | 14 |
| `CueSchedule.gs` |  | Requests, Schedule | 0 | 0 | 4 | 11 |
| `CueStatus.gs` | `add_tri_items`, `find_similar_projects`, `status_digest` | AI Runs, Requests | 2 | 1 | 3 | 11 |
| `CueStyle.gs` |  | Requests, Style | 0 | 1 | 12 | 4 |
| `CueSupplier.gs` | `handoff_put`, `register_supplier`, `save_supplier_file`, `supplier_check` |  | 2 | 1 | 2 | 7 |
| `CueSweep.gs` | `get_project_board` | Chase log, Requests, Rules | 1 | 0 | 12 | 10 |
| `CueSweepAccr.gs` | `accreditation_gaps`, `log_accreditation_reminder` |  | 0 | 0 | 0 | 6 |
| `CueSweepAward.gs` |  |  | 0 | 0 | 0 | 4 |
| `CueSweepHubspot.gs` |  |  | 0 | 0 | 0 | 2 |
| `CueSweepPay.gs` | `overdue_billings`, `send_payment_chasers` |  | 0 | 0 | 0 | 3 |
| `CueSweepRfq.gs` |  |  | 0 | 0 | 0 | 5 |
| `CueSweepSignature.gs` | `list_unsigned_docs`, `send_doc_reminder` |  | 0 | 0 | 0 | 4 |
| `CueTeach.gs` |  | Memory, Requests, Workflows | 0 | 3 | 6 | 9 |
| `CueText.gs` |  |  | 0 | 0 | 41 | 0 |
| `CueTickTick.gs` |  |  | 0 | 0 | 2 | 4 |
| `CueTriage.gs` |  | Triage log, Triage rules | 1 | 0 | 4 | 6 |
| `CueTutor.gs` |  | Patterns | 1 | 0 | 4 | 6 |
| `CueUsage.gs` |  | AI Runs, Requests | 0 | 0 | 3 | 2 |
| `CueVendor.gs` | `find_similar_projects`, `supplier_lookup` | Requests | 2 | 1 | 2 | 6 |
| `CueWorkflow.gs` |  | Requests, Workflows | 2 | 1 | 2 | 4 |

## 5. Shared helpers

Names used by 5 or more other files, and the file that holds them.

| Helper | Lives in | Used by files |
|---|---|---|
| `cueNow_` | `Cue.gs` | 40 |
| `cueStr_` | `CueText.gs` | 40 |
| `cueChat_` | `Cue.gs` | 34 |
| `cueProp_` | `Cue.gs` | 31 |
| `cueLocked_` | `Cue.gs` | 30 |
| `cueAiAll_` | `CueAi.gs` | 26 |
| `cueBridge_` | `CueBridge.gs` | 26 |
| `cueLoad_` | `Cue.gs` | 26 |
| `cueSave_` | `Cue.gs` | 26 |
| `cueSheet_` | `Cue.gs` | 26 |
| `cueGpt_` | `CueAi.gs` | 22 |
| `cueOwner_` | `Cue.gs` | 21 |
| `CUE_VERSION_` | `Cue.gs` | 20 |
| `cueEmail_` | `CueText.gs` | 20 |
| `cueClaude_` | `CueAi.gs` | 18 |
| `cueMetrics_` | `Cue.gs` | 17 |
| `cueSummary_` | `Cue.gs` | 15 |
| `CUE_GMAIL_` | `CueGmail.gs` | 13 |
| `cueView_` | `Cue.gs` | 12 |
| `cueGmailSend_` | `CueGmail.gs` | 11 |
| `cueName_` | `CueText.gs` | 11 |
| `cueGmail_` | `CueGmail.gs` | 9 |
| `cueKey_` | `CueAi.gs` | 9 |
| `cueMe_` | `Cue.gs` | 9 |
| `cuePh_` | `CueDates.gs` | 9 |
| `cueResume` | `Cue.gs` | 9 |
| `cueRunLeased_` | `Cue.gs` | 9 |
| `cueAskOpen_` | `CueRoute.gs` | 8 |
| `cueOwnDomain_` | `CueGmail.gs` | 8 |
| `cueStyleFor_` | `CueStyle.gs` | 8 |
| `cueWords_` | `Cue.gs` | 8 |
| `CUE_DRIVE_` | `CueFiles.gs` | 7 |
| `cueDrive_` | `CueFiles.gs` | 7 |
| `cueGmailDraft_` | `CueGmail.gs` | 7 |
| `cueKind_` | `CueSweep.gs` | 7 |
| `cueRecent_` | `Cue.gs` | 7 |
| `cueRows_` | `Cue.gs` | 7 |
| `cueStyleSignOff_` | `CueStyle.gs` | 7 |
| `cueTerm_` | `CueText.gs` | 7 |
| `CUE_DATE_RE_` | `CueText.gs` | 6 |
| `cueAddDays_` | `CueDates.gs` | 6 |
| `cueAskPick` | `CueRoute.gs` | 6 |
| `cueR2_` | `CueText.gs` | 6 |
| `cueBridgeParse_` | `CueBridge.gs` | 5 |
| `cueBridgePlan_` | `CueBridge.gs` | 5 |
| `cueBridgeReq_` | `CueBridge.gs` | 5 |
| `cueFilesParts_` | `CueFiles.gs` | 5 |
| `cueGmailReply_` | `CueGmail.gs` | 5 |
| `cueSendWith_` | `Cue.gs` | 5 |

## 6. What the page calls

Server functions `Index.html` calls, by the file that holds them.

- `Cue.gs`: `cueApprove`, `cueAsNew`, `cueCancelIntake`, `cueCloseTask`, `cueDrafts`, `cueFixAccess`, `cueFolders`, `cueReject`, `cueReopen`, `cueRescan`, `cueRetry`, `cueRfq`, `cueRfqPick`, `cueRun`, `cueSameAnswer`, `cueSend`, `cueState`, `cueSupplierCanvas`, `cueSupplierSaved`
- `CueBatch.gs`: `cueBatchAdd`, `cueBatchCancel`, `cueBatchStart`, `cueBatchTake`
- `CueBids.gs`: `cueBidsClose`
- `CueExpense.gs`: `cueExpense`
- `CueFiles.gs`: `cueFileData`, `cueUpload`
- `CueFinance.gs`: `cueFinSave`, `cueFinSheet`
- `CueGptTasks.gs`: `cueGtAct`, `cueGtClose`, `cueGtDraftAll`
- `CueHelp.gs`: `cueHelpAct`
- `CueHubspot.gs`: `cueHsClose`, `cueHsLookup`
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
