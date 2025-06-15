import { supabase } from '@/integrations/supabase/client';
// No need for Receipt type here if we select specific columns
// import { Receipt } from '@/types/receipt';

// Update DailyExpenseData to include receipt IDs
export interface DailyExpenseData {
  date: string;
  total: number;
  receiptIds: string[]; // Add receipt IDs
}

// Fetch daily expense data with optional date filtering, aggregating IDs
export const fetchDailyExpenses = async (startDateISO?: string | null, endDateISO?: string | null): Promise<DailyExpenseData[]> => {
  let query = supabase
    .from('receipts')
    // Select id, date, and total
    .select('id, date, total');

  if (startDateISO) {
    query = query.gte('date', startDateISO);
  }
  // Add end date filtering
  if (endDateISO) {
      // Use 'lte' for less than or equal to the end date
      // Adjust if end date should be exclusive
      query = query.lte('date', endDateISO);
  }


  // Order by date for easier processing
  query = query.order('date', { ascending: true });

  const { data: receiptsData, error } = await query;

  if (error) {
    console.error('Error fetching receipts for daily expenses:', error);
    throw new Error('Could not fetch receipts data');
  }

  // Aggregate data client-side
  const aggregated: { [date: string]: { total: number; receiptIds: string[] } } = {};

  (receiptsData || []).forEach(item => {
    // Ensure date is handled correctly (without time part for grouping)
    const dateKey = item.date.split('T')[0];
    if (!aggregated[dateKey]) {
      aggregated[dateKey] = { total: 0, receiptIds: [] };
    }
    aggregated[dateKey].total += Number(item.total) || 0;
    aggregated[dateKey].receiptIds.push(item.id); // Collect IDs
  });

  // Convert aggregated object to the desired array format
  const results: DailyExpenseData[] = Object.entries(aggregated).map(([date, data]) => ({
    date,
    total: data.total,
    receiptIds: data.receiptIds,
  }));

  // Return sorted by date (already done by query order, but good practice)
  // results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return results;
};

// Define the shape for category expense data
export interface CategoryExpenseData {
  category: string | null; // Category name (from custom categories or predicted)
  total_spent: number;
}

// Fetch expenses grouped by category with optional date filtering
// This function now prioritizes custom categories over predicted categories
export const fetchExpensesByCategory = async (startDateISO?: string | null, endDateISO?: string | null): Promise<CategoryExpenseData[]> => {
    // Query receipts with custom category information
    let query = supabase
      .from('receipts')
      .select(`
        predicted_category,
        total,
        custom_categories (
          name
        )
      `)

    if (startDateISO) {
      query = query.gte('date', startDateISO); // Use ISO string here too
    }
    // Add end date filtering
    if (endDateISO) {
        query = query.lte('date', endDateISO);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching category expenses:', error);
      throw new Error('Could not fetch category expense data');
    }

    // Aggregate in the client-side (less efficient than DB aggregation)
    const aggregated: { [category: string]: number } = {};
    (data || []).forEach(item => {
      // Priority: custom category name → predicted category → 'Uncategorized'
      const categoryKey = (item.custom_categories?.name) || item.predicted_category || 'Uncategorized';
      if (!aggregated[categoryKey]) {
        aggregated[categoryKey] = 0;
      }
      aggregated[categoryKey] += Number(item.total) || 0;
    });

    return Object.entries(aggregated).map(([category, total_spent]) => ({
      category,
      total_spent,
    }));

    // --- Alternative: Using Supabase aggregation (Potentially more efficient but requires testing) ---
    /*
    let rpcParams = { start_date_param: startDateISO };
    // You would need to create a function like 'get_category_expenses' in Supabase
    const { data, error } = await supabase.rpc('get_category_expenses', rpcParams);
    if (error) {
        console.error('Error fetching category expenses via RPC:', error);
        throw new Error('Could not fetch category expense data');
    }
    return (data || []) as CategoryExpenseData[];
    */
};

// Define the shape for summary receipt data needed for analysis
export interface ReceiptSummary {
  id: string;
  date: string;
  total: number | null;
  merchant: string | null;
  payment_method: string | null;
}

// Fetch detailed receipt summaries for a date range
export const fetchReceiptDetailsForRange = async (startDateISO?: string | null, endDateISO?: string | null): Promise<ReceiptSummary[]> => {
  let query = supabase
    .from('receipts')
    // Select necessary fields
    .select('id, date, total, merchant, payment_method');

  if (startDateISO) {
    query = query.gte('date', startDateISO);
  }
  if (endDateISO) {
    query = query.lte('date', endDateISO);
  }

  // Order by date for easier processing in the select function
  query = query.order('date', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching receipt details for range:', error);
    throw new Error('Could not fetch detailed receipts data');
  }

  // Ensure correct types, default total to 0 if null/undefined
  return (data || []).map(item => ({
    ...item,
    total: Number(item.total) || 0, // Convert null/undefined total to 0
  })) as ReceiptSummary[];
};

// Potential future improvement: Aggregate directly in Supabase using an RPC function
// const { data, error } = await supabase.rpc('get_daily_expense_summary');