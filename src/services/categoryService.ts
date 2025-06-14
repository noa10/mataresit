import { supabase } from "@/integrations/supabase/client";
import { 
  CustomCategory, 
  CreateCategoryRequest, 
  UpdateCategoryRequest, 
  BulkCategoryAssignmentRequest,
  DeleteCategoryRequest 
} from "@/types/receipt";
import { toast } from "sonner";

/**
 * Service for managing custom categories
 */

// Fetch all categories for the current user with receipt counts
export const fetchUserCategories = async (): Promise<CustomCategory[]> => {
  try {
    const { data, error } = await supabase.rpc('get_user_categories_with_counts');

    if (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load categories");
      return [];
    }

    const categories = data || [];

    // If user has no categories, create default ones
    if (categories.length === 0) {
      await createDefaultCategories();
      // Fetch again after creating defaults
      const { data: newData, error: newError } = await supabase.rpc('get_user_categories_with_counts');
      if (newError) {
        console.error("Error fetching categories after creating defaults:", newError);
        return [];
      }
      return newData || [];
    }

    return categories;
  } catch (error) {
    console.error("Error fetching categories:", error);
    toast.error("Failed to load categories");
    return [];
  }
};

// Create a new category
export const createCategory = async (categoryData: CreateCategoryRequest): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('create_custom_category', {
      p_name: categoryData.name,
      p_color: categoryData.color || '#3B82F6',
      p_icon: categoryData.icon || 'tag'
    });

    if (error) {
      console.error("Error creating category:", error);
      toast.error(error.message || "Failed to create category");
      return null;
    }

    toast.success("Category created successfully");
    return data;
  } catch (error: any) {
    console.error("Error creating category:", error);
    toast.error(error.message || "Failed to create category");
    return null;
  }
};

// Update an existing category
export const updateCategory = async (
  categoryId: string, 
  categoryData: UpdateCategoryRequest
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('update_custom_category', {
      p_category_id: categoryId,
      p_name: categoryData.name,
      p_color: categoryData.color,
      p_icon: categoryData.icon
    });

    if (error) {
      console.error("Error updating category:", error);
      toast.error(error.message || "Failed to update category");
      return false;
    }

    toast.success("Category updated successfully");
    return true;
  } catch (error: any) {
    console.error("Error updating category:", error);
    toast.error(error.message || "Failed to update category");
    return false;
  }
};

// Delete a category
export const deleteCategory = async (
  categoryId: string, 
  reassignToCategoryId?: string | null
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('delete_custom_category', {
      p_category_id: categoryId,
      p_reassign_to_category_id: reassignToCategoryId
    });

    if (error) {
      console.error("Error deleting category:", error);
      toast.error(error.message || "Failed to delete category");
      return false;
    }

    toast.success("Category deleted successfully");
    return true;
  } catch (error: any) {
    console.error("Error deleting category:", error);
    toast.error(error.message || "Failed to delete category");
    return false;
  }
};

// Bulk assign category to receipts
export const bulkAssignCategory = async (
  receiptIds: string[], 
  categoryId?: string | null
): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('bulk_assign_category', {
      p_receipt_ids: receiptIds,
      p_category_id: categoryId
    });

    if (error) {
      console.error("Error bulk assigning category:", error);
      toast.error(error.message || "Failed to assign category");
      return 0;
    }

    const updatedCount = data || 0;
    if (updatedCount > 0) {
      const action = categoryId ? "assigned to category" : "removed from category";
      toast.success(`${updatedCount} receipt(s) ${action}`);
    }

    return updatedCount;
  } catch (error: any) {
    console.error("Error bulk assigning category:", error);
    toast.error(error.message || "Failed to assign category");
    return 0;
  }
};

// Get a single category by ID
export const fetchCategoryById = async (categoryId: string): Promise<CustomCategory | null> => {
  try {
    const { data, error } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('id', categoryId)
      .single();

    if (error) {
      console.error("Error fetching category:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error fetching category:", error);
    return null;
  }
};

// Validate category data
export const validateCategoryData = (data: CreateCategoryRequest | UpdateCategoryRequest): string[] => {
  const errors: string[] = [];

  if ('name' in data && data.name !== undefined) {
    if (!data.name || data.name.trim().length === 0) {
      errors.push("Category name is required");
    } else if (data.name.trim().length > 50) {
      errors.push("Category name cannot exceed 50 characters");
    }
  }

  if (data.color && !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
    errors.push("Color must be a valid hex color (e.g., #3B82F6)");
  }

  return errors;
};

// Default category colors
export const DEFAULT_CATEGORY_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
];

// Default category icons
export const DEFAULT_CATEGORY_ICONS = [
  'tag',
  'shopping-cart',
  'utensils',
  'car',
  'home',
  'briefcase',
  'heart',
  'gift',
  'plane',
  'book',
  'music',
  'camera',
  'gamepad',
  'coffee',
  'fuel',
];

// Create default categories for new users
export const createDefaultCategories = async (): Promise<void> => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    const { error } = await supabase.rpc('create_default_categories_for_user', {
      p_user_id: user.user.id
    });

    if (error) {
      console.error("Error creating default categories:", error);
      // Don't show toast error for this as it's automatic
    }
  } catch (error) {
    console.error("Error creating default categories:", error);
    // Don't show toast error for this as it's automatic
  }
};
