import type { ApiContext } from './api-auth.ts';
import { hasScope } from './api-auth.ts';

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
  receipt_count: number;
  team_id: string | null;
  is_team_category: boolean;
}

export async function handleCategoriesAPI(
  req: Request,
  pathSegments: string[],
  context: ApiContext,
): Promise<Response> {
  if (pathSegments.length > 1) {
    return createErrorResponse('Categories resource not found', 404);
  }

  if (req.method !== 'GET') {
    return createErrorResponse('Method not allowed', 405);
  }

  if (!hasScope(context, 'categories:read')) {
    return createErrorResponse('Insufficient permissions for categories:read', 403);
  }

  try {
    const url = new URL(req.url);
    const teamId = url.searchParams.get('team_id');

    if (teamId) {
      const { data: membership, error: membershipError } = await context.supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', context.userId)
        .maybeSingle();

      if (membershipError) {
        console.error('Error verifying team membership for GET /categories:', membershipError);
        return createErrorResponse('Failed to verify team membership', 500);
      }

      if (!membership) {
        return createErrorResponse('Access denied to team categories', 403);
      }
    }

    const { data, error } = await context.userSupabase.rpc('get_user_categories_with_counts', {
      p_user_id: context.userId,
      p_team_id: teamId,
    });

    if (error) {
      console.error('Error fetching categories for GET /categories:', error);
      return createErrorResponse('Failed to retrieve categories', 500);
    }

    const categories = ((data ?? []) as CategoryRow[]).map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      createdAt: category.created_at,
      updatedAt: category.updated_at,
      receiptCount: Number(category.receipt_count ?? 0),
      teamId: category.team_id,
      isTeamCategory: Boolean(category.is_team_category),
    }));

    return createSuccessResponse({
      categories,
      count: categories.length,
      teamId: teamId ?? null,
    });
  } catch (error) {
    console.error('Unexpected error in GET /categories:', error);
    return createErrorResponse('Failed to retrieve categories', 500);
  }
}

function createSuccessResponse(data: unknown, status: number = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

function createErrorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({
      error: true,
      message,
      code: status,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}