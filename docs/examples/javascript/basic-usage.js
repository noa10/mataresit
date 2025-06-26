/**
 * Mataresit API - JavaScript/Node.js Examples
 * 
 * This file demonstrates basic usage of the Mataresit API using JavaScript.
 * You can run these examples in Node.js or adapt them for browser use.
 */

const MATARESIT_API_BASE = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1';
const API_KEY = process.env.MATARESIT_API_KEY; // Set your API key in environment variables

/**
 * Basic API client class
 */
class MataresitAPI {
  constructor(apiKey, baseUrl = MATARESIT_API_BASE) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`API Error: ${data.message || response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Receipts
  async getReceipts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/receipts${queryString ? `?${queryString}` : ''}`);
  }

  async getReceipt(id) {
    return this.request(`/receipts/${id}`);
  }

  async createReceipt(receiptData) {
    return this.request('/receipts', {
      method: 'POST',
      body: JSON.stringify(receiptData)
    });
  }

  async updateReceipt(id, updates) {
    return this.request(`/receipts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteReceipt(id) {
    return this.request(`/receipts/${id}`, {
      method: 'DELETE'
    });
  }

  async createReceiptsBatch(receipts) {
    return this.request('/receipts/batch', {
      method: 'POST',
      body: JSON.stringify({ receipts })
    });
  }

  // Claims
  async getClaims(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/claims${queryString ? `?${queryString}` : ''}`);
  }

  async createClaim(claimData) {
    return this.request('/claims', {
      method: 'POST',
      body: JSON.stringify(claimData)
    });
  }

  // Search
  async search(query, options = {}) {
    return this.request('/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        ...options
      })
    });
  }

  // Analytics
  async getAnalytics(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/analytics${queryString ? `?${queryString}` : ''}`);
  }

  async getSpendingSummary(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/analytics/summary${queryString ? `?${queryString}` : ''}`);
  }

  // Teams
  async getTeams() {
    return this.request('/teams');
  }

  async getTeamStats(teamId) {
    return this.request(`/teams/${teamId}/stats`);
  }
}

/**
 * Example usage
 */
async function examples() {
  const api = new MataresitAPI(API_KEY);

  try {
    // 1. Health check
    console.log('=== Health Check ===');
    const health = await api.healthCheck();
    console.log('API Status:', health.data.status);
    console.log('User Scopes:', health.data.user.scopes);

    // 2. Create a receipt
    console.log('\n=== Create Receipt ===');
    const newReceipt = await api.createReceipt({
      merchant: 'Starbucks Coffee',
      date: '2025-01-15',
      total: 15.50,
      currency: 'USD',
      paymentMethod: 'Credit Card',
      category: 'Food & Dining',
      fullText: 'Starbucks Coffee\n123 Main St\nGrande Latte $4.50\nTax $0.45\nTotal $4.95'
    });
    console.log('Created receipt:', newReceipt.data.id);

    // 3. Get receipts with filtering
    console.log('\n=== Get Receipts ===');
    const receipts = await api.getReceipts({
      start_date: '2025-01-01',
      end_date: '2025-01-31',
      limit: 10,
      sort_by: 'total',
      sort_order: 'desc'
    });
    console.log(`Found ${receipts.data.receipts.length} receipts`);
    console.log('Pagination:', receipts.data.pagination);

    // 4. Search receipts
    console.log('\n=== Search ===');
    const searchResults = await api.search('coffee expenses', {
      sources: ['receipts'],
      limit: 5
    });
    console.log(`Search found ${searchResults.data.results.length} results`);

    // 5. Get spending summary
    console.log('\n=== Analytics ===');
    const summary = await api.getSpendingSummary({
      start_date: '2025-01-01',
      end_date: '2025-01-31',
      currency: 'USD'
    });
    console.log('Total spending:', summary.data.totalAmount);
    console.log('Average amount:', summary.data.averageAmount);

    // 6. Batch create receipts
    console.log('\n=== Batch Upload ===');
    const batchReceipts = [
      {
        merchant: 'Office Depot',
        date: '2025-01-15',
        total: 89.99,
        currency: 'USD',
        category: 'Office Supplies'
      },
      {
        merchant: 'Gas Station',
        date: '2025-01-15',
        total: 45.00,
        currency: 'USD',
        category: 'Transportation'
      }
    ];

    const batchResult = await api.createReceiptsBatch(batchReceipts);
    console.log(`Batch created ${batchResult.data.created.length} receipts`);
    if (batchResult.data.errors.length > 0) {
      console.log('Batch errors:', batchResult.data.errors);
    }

  } catch (error) {
    console.error('Example failed:', error.message);
  }
}

/**
 * Advanced examples with error handling and retry logic
 */
class AdvancedMataresitAPI extends MataresitAPI {
  async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        if (error.message.includes('Rate limit') && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }

  async uploadReceiptWithImage(receiptData, imageFile) {
    // First, upload the image (this would typically go to your storage service)
    const imageUrl = await this.uploadImage(imageFile);
    
    // Then create the receipt with the image URL
    return this.createReceipt({
      ...receiptData,
      imageUrl
    });
  }

  async uploadImage(imageFile) {
    // This is a placeholder - implement your image upload logic
    // You might use AWS S3, Cloudinary, or another service
    console.log('Uploading image:', imageFile.name);
    return 'https://example.com/uploaded-image.jpg';
  }

  async processReceiptWorkflow(receiptData) {
    try {
      // 1. Create receipt
      const receipt = await this.createReceipt(receiptData);
      console.log('Receipt created:', receipt.data.id);

      // 2. Wait for processing (if needed)
      await this.waitForProcessing(receipt.data.id);

      // 3. Get updated receipt with processed data
      const processedReceipt = await this.getReceipt(receipt.data.id);
      console.log('Processing complete:', processedReceipt.data.processingStatus);

      return processedReceipt.data;
    } catch (error) {
      console.error('Receipt workflow failed:', error);
      throw error;
    }
  }

  async waitForProcessing(receiptId, maxWait = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const receipt = await this.getReceipt(receiptId);
      
      if (receipt.data.processingStatus === 'complete') {
        return receipt.data;
      }
      
      if (receipt.data.processingStatus === 'failed') {
        throw new Error('Receipt processing failed');
      }
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Receipt processing timeout');
  }
}

/**
 * Real-world integration example
 */
async function realWorldExample() {
  const api = new AdvancedMataresitAPI(API_KEY);

  try {
    // Simulate processing multiple receipts from a form submission
    const receiptsToProcess = [
      {
        merchant: 'Amazon',
        date: '2025-01-15',
        total: 129.99,
        currency: 'USD',
        category: 'Office Supplies',
        paymentMethod: 'Credit Card'
      },
      {
        merchant: 'Uber',
        date: '2025-01-15',
        total: 25.50,
        currency: 'USD',
        category: 'Transportation',
        paymentMethod: 'Credit Card'
      }
    ];

    console.log('Processing receipts...');
    
    // Process receipts with proper error handling
    const results = await Promise.allSettled(
      receiptsToProcess.map(receipt => api.processReceiptWorkflow(receipt))
    );

    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    console.log(`Successfully processed: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);

    if (failed.length > 0) {
      console.log('Failed receipts:', failed.map(f => f.reason.message));
    }

    // Generate a summary report
    if (successful.length > 0) {
      const totalAmount = successful.reduce((sum, result) => 
        sum + result.value.total, 0
      );
      console.log(`Total processed amount: $${totalAmount.toFixed(2)}`);
    }

  } catch (error) {
    console.error('Real-world example failed:', error);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MataresitAPI, AdvancedMataresitAPI };
}

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('Running Mataresit API Examples...\n');
  examples()
    .then(() => console.log('\n=== Basic Examples Complete ==='))
    .then(() => realWorldExample())
    .then(() => console.log('\n=== All Examples Complete ==='))
    .catch(error => console.error('Examples failed:', error));
}
