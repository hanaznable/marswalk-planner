import { missionReportFileName, type MissionReport } from './missionReport'

/** Saves the report as a pretty-printed JSON file in the browser. */
export function downloadMissionReport(report: MissionReport): void {
  const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = missionReportFileName(report)
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
