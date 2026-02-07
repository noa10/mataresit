import { Receipt } from "@/types/receipt";
import { fetchUserPayers, fetchPayersByIds } from "@/services/paidByService";

export async function buildPayerNameMap(
    receipts: Receipt[],
    teamContext?: { currentTeam: { id: string } | null }
): Promise<Record<string, string>> {
    const ids = Array.from(
        new Set(receipts.map(r => r.paid_by_id).filter((id): id is string => !!id))
    );
    if (ids.length === 0) return {};

    const payers = await fetchUserPayers(teamContext);
    const map: Record<string, string> = {};
    for (const p of payers) map[p.id] = p.name;

    const missing = ids.filter(id => !map[id]);
    if (missing.length > 0) {
        const fetched = await fetchPayersByIds(missing);
        for (const p of fetched) map[p.id] = p.name;
    }

    return map;
}
