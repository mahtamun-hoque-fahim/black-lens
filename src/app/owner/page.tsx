import { redirect } from "next/navigation"
import { getDb } from "@/db"
import { OwnerDashboard } from "@/components/owner/owner-dashboard"
import { utcDay } from "@/lib/count-rules"
import { readDailyCounts, type DayCounts } from "@/lib/counter"
import { getOwnerSession } from "@/lib/owner-session"

export const dynamic = "force-dynamic"

export default async function OwnerPage() {
  const session = await getOwnerSession()
  if (!session) redirect("/owner/sign-in")

  let rows: DayCounts[] | null = null
  const db = getDb()
  if (db) {
    try {
      rows = await readDailyCounts(db, { today: utcDay(new Date()), days: 30 })
    } catch {
      rows = null
    }
  }
  return <OwnerDashboard rows={rows} email={session.user.email} />
}
