import { downloadJson } from '../../../lib/downloadJson'
import { missionReportFileName, type MissionReport } from './missionReport'

/** Saves the report as a pretty-printed JSON file in the browser. */
export function downloadMissionReport(report: MissionReport): void {
  downloadJson(missionReportFileName(report), report)
}
