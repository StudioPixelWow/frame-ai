/**
 * PIXEL SEO/GEO — Scan Logs & Debugging Storage
 * Stores all scan activity for audit trail and debugging.
 */

export interface ScanLogEntry {
  timestamp: string;       // ISO
  stage: string;           // which pipeline stage
  action: string;          // what happened
  details?: any;           // extracted data or context
  duration?: number;       // ms this action took
  success: boolean;
  error?: string;
}

export interface RejectedAssumption {
  timestamp: string;
  field: string;           // what field was attempted
  attemptedValue: any;     // what was going to be set
  reason: string;          // why it was rejected (Hebrew)
  reasonEn: string;        // English for debugging
  rule: string;            // which validation rule blocked it
}

export interface ScanLog {
  scanId: string;
  planId: string;
  url: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'invalid';
  entries: ScanLogEntry[];
  rejectedAssumptions: RejectedAssumption[];
  metrics: {
    totalDurationMs: number;
    pagesScanned: number;
    evidenceCollected: number;
    assumptionsRejected: number;
    apiCallsMade: number;
    apiCallsFailed: number;
  };
}

export class ScanLogger {
  private log: ScanLog;

  constructor(scanId: string, planId: string, url: string) {
    this.log = {
      scanId,
      planId,
      url,
      startedAt: new Date().toISOString(),
      status: 'running',
      entries: [],
      rejectedAssumptions: [],
      metrics: { totalDurationMs: 0, pagesScanned: 0, evidenceCollected: 0, assumptionsRejected: 0, apiCallsMade: 0, apiCallsFailed: 0 },
    };
  }

  /** Log a scan action */
  logAction(stage: string, action: string, details?: any, durationMs?: number, success = true, error?: string): void {
    this.log.entries.push({
      timestamp: new Date().toISOString(),
      stage, action, details, duration: durationMs, success, error,
    });
    if (!success) console.warn(`[SCAN-LOG][${stage}] FAILED: ${action}`, error);
  }

  /** Record a rejected assumption (data that was NOT used) */
  rejectAssumption(field: string, attemptedValue: any, reason: string, reasonEn: string, rule: string): void {
    this.log.rejectedAssumptions.push({
      timestamp: new Date().toISOString(),
      field, attemptedValue, reason, reasonEn, rule,
    });
    this.log.metrics.assumptionsRejected++;
    console.warn(`[SCAN-LOG][REJECTED] Field "${field}": ${reasonEn} (Rule: ${rule})`);
  }

  /** Increment metrics */
  incrementPages(): void { this.log.metrics.pagesScanned++; }
  incrementEvidence(): void { this.log.metrics.evidenceCollected++; }
  incrementApiCall(failed = false): void {
    this.log.metrics.apiCallsMade++;
    if (failed) this.log.metrics.apiCallsFailed++;
  }

  /** Finalize the log */
  finalize(status: 'completed' | 'failed' | 'invalid'): ScanLog {
    this.log.completedAt = new Date().toISOString();
    this.log.status = status;
    this.log.metrics.totalDurationMs = new Date(this.log.completedAt).getTime() - new Date(this.log.startedAt).getTime();
    return this.log;
  }

  /** Get current log state */
  getLog(): ScanLog { return this.log; }
}
