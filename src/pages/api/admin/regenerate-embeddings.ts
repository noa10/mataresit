import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { regenerateAllEmbeddings } from '@/lib/ai-search';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Initialize Supabase client with the request and response
    const supabase = createServerSupabaseClient({ req, res });
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized - you must be logged in to access this endpoint' 
      });
    }
    
    // Check if user has admin role
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRoles || userRoles.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Forbidden - you must have admin privileges to use this endpoint' 
      });
    }
    
    // Extract parameters from request body
    const { batchSize = 20 } = req.body;
    
    // Call the regeneration function
    console.log('Admin regenerating all embeddings with improved dimension handling');
    const result = await regenerateAllEmbeddings(batchSize);
    
    // Return the result
    return res.status(result.success ? 200 : 500).json({
      ...result,
      message: result.success 
        ? `Successfully regenerated embeddings for ${result.receiptsProcessed} receipts and ${result.lineItemsProcessed} line items` 
        : `Error regenerating embeddings: ${result.message}`
    });
  } catch (error) {
    console.error('Error in regenerate embeddings API route:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Server error: ${error.message}` 
    });
  }
} 