import { supabase } from '@/integrations/supabase/client';
// No need for Receipt type here if we select specific columns
// import { Receipt } from '@/types/receipt';

// Update DailySpendingData to include receipt IDs
export interface DailySpendingData {
  date: string;
  total: number;
  receiptIds: string[]; // Add receipt IDs
}

// Fetch daily spending data with optional date filtering, aggregating IDs
export const fetchDailySpending = async (startDateISO?: string | null, endDateISO?: string | null): Promise<DailySpendingData[]> => {
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
    console.error('Error fetching receipts for daily spending:', error);
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
  const results: DailySpendingData[] = Object.entries(aggregated).map(([date, data]) => ({
    date,
    total: data.total,
    receiptIds: data.receiptIds,
  }));

  // Return sorted by date (already done by query order, but good practice)
  // results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return results;
};

// Define the shape for category spending data
export interface CategorySpendingData {
  category: string | null; // Use correct column name 'predicted_category'
  total_spent: number;
}

// Fetch spending grouped by category with optional date filtering
export const fetchSpendingByCategory = async (startDateISO?: string | null, endDateISO?: string | null): Promise<CategorySpendingData[]> => {
    // Use an RPC function for robust aggregation, or handle null categories in the query
    // Basic approach:
    let query = supabase
      .from('receipts')
      .select('predicted_category, total') // Use predicted_category

    if (startDateISO) {
      query = query.gte('date', startDateISO); // Use ISO string here too
    }
    // Add end date filtering
    if (endDateISO) {
        query = query.lte('date', endDateISO);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching category spending:', error);
      throw new Error('Could not fetch category spending data');
    }

    // Aggregate in the client-side (less efficient than DB aggregation)
    const aggregated: { [category: string]: number } = {};
    (data || []).forEach(item => {
      const categoryKey = item.predicted_category || 'Uncategorized'; // Handle null categories
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
    // You would need to create a function like 'get_category_spending' in Supabase
    const { data, error } = await supabase.rpc('get_category_spending', rpcParams);
    if (error) {
        console.error('Error fetching category spending via RPC:', error);
        throw new Error('Could not fetch category spending data');
    }
    return (data || []) as CategorySpendingData[];
    */
};

// Potential future improvement: Aggregate directly in Supabase using an RPC function
// const { data, error } = await supabase.rpc('get_daily_spending_summary'); 