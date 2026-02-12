import { supabase } from "@/integrations/supabase/client";
import { CategoryAlias } from "@/types/receipt";
import { toast } from "sonner";

interface TeamContext {
  currentTeam: { id: string } | null;
}

export interface UpsertCategoryAliasRequest {
  aliasId?: string;
  alias: string;
  categoryId: string;
}

export const fetchCategoryAliases = async (teamContext?: TeamContext): Promise<CategoryAlias[]> => {
  try {
    const { data, error } = await supabase.rpc("get_category_aliases", {
      p_team_id: teamContext?.currentTeam?.id || null,
    });

    if (error) {
      console.error("Error fetching category aliases:", error);
      toast.error(error.message || "Failed to load category aliases");
      return [];
    }

    return (data || []) as CategoryAlias[];
  } catch (error) {
    console.error("Error fetching category aliases:", error);
    toast.error("Failed to load category aliases");
    return [];
  }
};

export const upsertCategoryAlias = async (
  payload: UpsertCategoryAliasRequest,
  teamContext?: TeamContext
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc("upsert_category_alias", {
      p_alias_id: payload.aliasId || null,
      p_alias: payload.alias,
      p_category_id: payload.categoryId,
      p_team_id: teamContext?.currentTeam?.id || null,
    });

    if (error) {
      console.error("Error saving category alias:", error);
      toast.error(error.message || "Failed to save category alias");
      return null;
    }

    return data as string;
  } catch (error) {
    console.error("Error saving category alias:", error);
    toast.error("Failed to save category alias");
    return null;
  }
};

export const deleteCategoryAlias = async (aliasId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc("delete_category_alias", {
      p_alias_id: aliasId,
    });

    if (error) {
      console.error("Error deleting category alias:", error);
      toast.error(error.message || "Failed to delete category alias");
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Error deleting category alias:", error);
    toast.error("Failed to delete category alias");
    return false;
  }
};
