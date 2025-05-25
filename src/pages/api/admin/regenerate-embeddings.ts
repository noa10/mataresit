import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { generateEmbeddingsForReceipt } from '@/lib/ai-search';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerSupabaseClient({ req, res });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { receipt_id } = req.body;

    if (receipt_id) {
      // Regenerate embeddings for a single receipt
      await generateEmbeddingsForReceipt(receipt_id);
      return res.status(200).json({ message: 'Embeddings regenerated successfully' });
    } else {
      // Regenerate embeddings for all reviewed receipts
      const { data: receipts, error: fetchError } = await supabase
        .from('receipts')
        .select('id')
        .eq('status', 'reviewed');

      if (fetchError) {
        throw fetchError;
      }

      // Process receipts in parallel with a concurrency limit
      const concurrencyLimit = 5;
      const receiptIds = receipts?.map(r => r.id) || [];
      
      for (let i = 0; i < receiptIds.length; i += concurrencyLimit) {
        const batch = receiptIds.slice(i, i + concurrencyLimit);
        await Promise.all(batch.map(id => generateEmbeddingsForReceipt(id).catch(error => {
          console.error(`Failed to generate embeddings for receipt ${id}:`, error);
        })));
      }

      return res.status(200).json({ 
        message: 'Bulk embedding regeneration completed',
        processed: receiptIds.length
      });
    }
  } catch (error) {
    console.error('Error in regenerate-embeddings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 