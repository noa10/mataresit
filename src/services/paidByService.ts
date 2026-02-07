import { supabase } from "@/integrations/supabase/client";
import { PaidBy, CreatePayerRequest } from "@/types/receipt";
import { toast } from "sonner";

/**
 * Service for managing payers (who paid for receipts)
 */

// Fetch all payers for the current user or team with receipt counts
export async function fetchUserPayers(
    teamContext?: { currentTeam: { id: string } | null }
): Promise<PaidBy[]> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error("[PaidByService] No authenticated user");
            return [];
        }

        // Call the RPC function with team context
        const { data, error } = await supabase.rpc('get_user_payers_with_counts', {
            p_user_id: user.id,
            p_team_id: teamContext?.currentTeam?.id ?? null
        });

        if (error) {
            console.error("[PaidByService] Error fetching payers:", error);
            toast.error("Failed to load payers");
            return [];
        }

        return (data as PaidBy[]) || [];
    } catch (error) {
        console.error("[PaidByService] Exception fetching payers:", error);
        return [];
    }
}

// Create a new payer
export async function createPayer(
    payerData: CreatePayerRequest,
    teamContext?: { currentTeam: { id: string } | null }
): Promise<string | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error("You must be logged in to create a payer");
            return null;
        }

        // Use the RPC function to create payer
        const { data, error } = await supabase.rpc('create_payer', {
            p_name: payerData.name,
            p_team_id: teamContext?.currentTeam?.id ?? null
        });

        if (error) {
            console.error("[PaidByService] Error creating payer:", error);
            if (error.code === '23505') {
                toast.error("A payer with this name already exists");
            } else {
                toast.error("Failed to create payer");
            }
            return null;
        }

        toast.success(`Payer "${payerData.name}" created`);
        return data as string;
    } catch (error) {
        console.error("[PaidByService] Exception creating payer:", error);
        toast.error("Failed to create payer");
        return null;
    }
}

// Update an existing payer
export async function updatePayer(
    payerId: string,
    name: string
): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc('update_payer', {
            p_payer_id: payerId,
            p_name: name
        });

        if (error) {
            console.error("[PaidByService] Error updating payer:", error);
            toast.error("Failed to update payer");
            return false;
        }

        toast.success("Payer updated");
        return true;
    } catch (error) {
        console.error("[PaidByService] Exception updating payer:", error);
        toast.error("Failed to update payer");
        return false;
    }
}

// Archive a payer (soft delete)
export async function archivePayer(payerId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc('archive_payer', {
            p_payer_id: payerId
        });

        if (error) {
            console.error("[PaidByService] Error archiving payer:", error);
            toast.error("Failed to delete payer");
            return false;
        }

        toast.success("Payer deleted");
        return true;
    } catch (error) {
        console.error("[PaidByService] Exception archiving payer:", error);
        toast.error("Failed to delete payer");
        return false;
    }
}

// Get a single payer by ID
export async function fetchPayerById(payerId: string): Promise<PaidBy | null> {
    try {
        // Use type assertion since paid_by table types may not be generated yet
        const { data, error } = await (supabase as any)
            .from('paid_by')
            .select('*')
            .eq('id', payerId)
            .single();

        if (error) {
            console.error("[PaidByService] Error fetching payer:", error);
            return null;
        }

        return data as PaidBy;
    } catch (error) {
        console.error("[PaidByService] Exception fetching payer:", error);
        return null;
    }
}

export async function fetchPayersByIds(payerIds: string[]): Promise<PaidBy[]> {
    if (payerIds.length === 0) return [];
    try {
        const { data, error } = await (supabase as any)
            .from('paid_by')
            .select('*')
            .in('id', payerIds);

        if (error) {
            console.error("[PaidByService] Error fetching payers by IDs:", error);
            return [];
        }

        return (data as PaidBy[]) ?? [];
    } catch (error) {
        console.error("[PaidByService] Exception fetching payers by IDs:", error);
        return [];
    }
}

// Validate payer data
export function validatePayerData(data: CreatePayerRequest): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
        errors.push("Payer name is required");
    }

    if (data.name && data.name.length > 50) {
        errors.push("Payer name must be 50 characters or less");
    }

    return errors;
}
