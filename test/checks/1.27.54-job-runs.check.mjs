// Cloud check for Cue 1.27.54 Job Runs (CueJobs.gs, structure review phase 3.1). Through the check door, one job runs the way the
// 5-minute tick runs it: looked up by name (globalThis), timed, and its row written to the Job Runs tab with the daily trim. The
// job is "Bid check tidy" (a one-off from 1.27.2 that returns 0 once done). What it writes, all in Cue's own sheet and properties:
// the "Job Runs" tab on first use (header row), one row for this run, and the CUE_JOB_TRIM_DAY property (today). Nothing in Canvas,
// no mail. Then the page opens as usual, so the template page is checked too.
export default {
  name: '1.27.54 Job Runs (one job through the tick runner)',
  steps: [
    { title: 'One job runs through the tick runner and its Job Runs row reads back', run: async h => {
      const r = await h.door('check_call', { fn: 'cueJobsCheck', args: [] });
      if (!r.ok) throw new Error('cueJobsCheck failed: ' + r.error);
      const o = r.result || {};
      if (JSON.stringify(o.header) !== JSON.stringify(['Started', 'Finished', 'Job', 'Result', 'Error', 'Count'])) throw new Error('Job Runs header is ' + JSON.stringify(o.header));
      if (!o.wrote || o.wrote[2] !== 'Bid check tidy') throw new Error('No row made for the job: ' + JSON.stringify(o.wrote));
      if (o.wrote[3] !== 'OK') throw new Error('The job failed on real Apps Script: ' + o.wrote[4]);
      if (!o.read || o.read.length !== 1) throw new Error('Expected its one row back from the tab, got ' + JSON.stringify(o.read));
      if (o.trim_day !== String(o.wrote[0]).slice(0, 10)) throw new Error('The daily trim did not record today: ' + o.trim_day);
    } },
    { title: 'Cue opens as usual', run: async h => { await h.see(/Cue/, 60000); } }
  ]
};
