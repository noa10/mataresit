import { supabase } from "@/integrations/supabase/client";
import { CategoryRule, CategoryRuleMatchType } from "@/types/receipt";
import { toast } from "sonner";

interface TeamContext {
  currentTeam: { id: string } | null;
}

export interface UpsertCategoryRuleRequest {
  ruleId?: string;
  matchType: CategoryRuleMatchType;
  pattern: string;
  categoryId: string;
  priority?: number;
}

export const fetchCategoryRules = async (teamContext?: TeamContext): Promise<CategoryRule[]> => {
  try {
    const { data, error } = await supabase.rpc("get_category_rules", {
      p_team_id: teamContext?.currentTeam?.id || null,
    });

    if (error) {
      console.error("Error fetching category rules:", error);
      toast.error(error.message || "Failed to load category rules");
      return [];
    }

    return (data || []) as CategoryRule[];
  } catch (error) {
    console.error("Error fetching category rules:", error);
    toast.error("Failed to load category rules");
    return [];
  }
};

export const upsertCategoryRule = async (
  payload: UpsertCategoryRuleRequest,
  teamContext?: TeamContext
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc("upsert_category_rule", {
      p_rule_id: payload.ruleId || null,
      p_match_type: payload.matchType,
      p_pattern: payload.pattern,
      p_category_id: payload.categoryId,
      p_priority: payload.priority ?? 0,
      p_team_id: teamContext?.currentTeam?.id || null,
    });

    if (error) {
      console.error("Error saving category rule:", error);
      toast.error(error.message || "Failed to save category rule");
      return null;
    }

    return data as string;
  } catch (error) {
    console.error("Error saving category rule:", error);
    toast.error("Failed to save category rule");
    return null;
  }
};

export const archiveCategoryRule = async (ruleId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc("archive_category_rule", {
      p_rule_id: ruleId,
    });

    if (error) {
      console.error("Error archiving category rule:", error);
      toast.error(error.message || "Failed to delete category rule");
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Error archiving category rule:", error);
    toast.error("Failed to delete category rule");
    return false;
  }
};
