import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Histórico · Console" };
export const dynamic = "force-dynamic";

export default async function PlatformEventsPage() {
  await requirePlatformAdmin();
  const events = await db.platformEvent.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Histórico" description="Bloqueios, liberações, módulos, vencimento e administradores (últimos 200 eventos)." />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Quando</th><th>Quem</th><th>Evento</th></tr></thead>
          <tbody>
            {events.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted">Nenhum evento ainda.</td></tr>}
            {events.map((e) => <tr key={e.id}><td className="whitespace-nowrap">{formatDateTime(e.createdAt)}</td><td>{e.adminName}</td><td className="font-medium">{e.message}</td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  );
}
