"""
Mataresit API - Python Examples

This file demonstrates basic usage of the Mataresit API using Python.
Install required dependencies: pip install requests python-dotenv
"""

import os
import json
import time
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MATARESIT_API_BASE = 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/external-api/api/v1'
API_KEY = os.getenv('MATARESIT_API_KEY')  # Set your API key in .env file


@dataclass
class Receipt:
    """Receipt data structure"""
    merchant: str
    date: str
    total: float
    currency: str = 'USD'
    payment_method: Optional[str] = None
    category: Optional[str] = None
    full_text: Optional[str] = None
    team_id: Optional[str] = None


@dataclass
class Claim:
    """Claim data structure"""
    team_id: str
    title: str
    amount: float
    currency: str = 'USD'
    description: Optional[str] = None
    category: Optional[str] = None
    priority: str = 'medium'


class MataresitAPIError(Exception):
    """Custom exception for API errors"""
    def __init__(self, message: str, status_code: int = None, error_code: str = None):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(self.message)


class MataresitAPI:
    """Mataresit API client"""
    
    def __init__(self, api_key: str, base_url: str = MATARESIT_API_BASE):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        })
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make API request with error handling"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            data = response.json()
            
            if not response.ok:
                raise MataresitAPIError(
                    message=data.get('message', 'API request failed'),
                    status_code=response.status_code,
                    error_code=data.get('code')
                )
            
            return data
        
        except requests.RequestException as e:
            raise MataresitAPIError(f"Request failed: {str(e)}")
    
    def health_check(self) -> Dict[str, Any]:
        """Check API health"""
        return self._request('GET', '/health')
    
    # Receipt methods
    def get_receipts(self, **params) -> Dict[str, Any]:
        """Get receipts with optional filtering"""
        return self._request('GET', '/receipts', params=params)
    
    def get_receipt(self, receipt_id: str) -> Dict[str, Any]:
        """Get specific receipt"""
        return self._request('GET', f'/receipts/{receipt_id}')
    
    def create_receipt(self, receipt: Receipt) -> Dict[str, Any]:
        """Create new receipt"""
        data = {
            'merchant': receipt.merchant,
            'date': receipt.date,
            'total': receipt.total,
            'currency': receipt.currency
        }
        
        # Add optional fields
        if receipt.payment_method:
            data['paymentMethod'] = receipt.payment_method
        if receipt.category:
            data['category'] = receipt.category
        if receipt.full_text:
            data['fullText'] = receipt.full_text
        if receipt.team_id:
            data['teamId'] = receipt.team_id
        
        return self._request('POST', '/receipts', json=data)
    
    def update_receipt(self, receipt_id: str, **updates) -> Dict[str, Any]:
        """Update receipt"""
        return self._request('PUT', f'/receipts/{receipt_id}', json=updates)
    
    def delete_receipt(self, receipt_id: str) -> Dict[str, Any]:
        """Delete receipt"""
        return self._request('DELETE', f'/receipts/{receipt_id}')
    
    def create_receipts_batch(self, receipts: List[Receipt]) -> Dict[str, Any]:
        """Create multiple receipts in batch"""
        receipts_data = []
        for receipt in receipts:
            receipt_dict = {
                'merchant': receipt.merchant,
                'date': receipt.date,
                'total': receipt.total,
                'currency': receipt.currency
            }
            if receipt.payment_method:
                receipt_dict['paymentMethod'] = receipt.payment_method
            if receipt.category:
                receipt_dict['category'] = receipt.category
            if receipt.team_id:
                receipt_dict['teamId'] = receipt.team_id
            
            receipts_data.append(receipt_dict)
        
        return self._request('POST', '/receipts/batch', json={'receipts': receipts_data})
    
    # Claims methods
    def get_claims(self, **params) -> Dict[str, Any]:
        """Get claims with optional filtering"""
        return self._request('GET', '/claims', params=params)
    
    def create_claim(self, claim: Claim) -> Dict[str, Any]:
        """Create new claim"""
        data = {
            'teamId': claim.team_id,
            'title': claim.title,
            'amount': claim.amount,
            'currency': claim.currency,
            'priority': claim.priority
        }
        
        if claim.description:
            data['description'] = claim.description
        if claim.category:
            data['category'] = claim.category
        
        return self._request('POST', '/claims', json=data)
    
    # Search methods
    def search(self, query: str, sources: List[str] = None, **options) -> Dict[str, Any]:
        """Perform semantic search"""
        data = {'query': query}
        
        if sources:
            data['sources'] = sources
        
        data.update(options)
        return self._request('POST', '/search', json=data)
    
    # Analytics methods
    def get_analytics(self, **params) -> Dict[str, Any]:
        """Get comprehensive analytics"""
        return self._request('GET', '/analytics', params=params)
    
    def get_spending_summary(self, **params) -> Dict[str, Any]:
        """Get spending summary"""
        return self._request('GET', '/analytics/summary', params=params)
    
    def get_category_analytics(self, **params) -> Dict[str, Any]:
        """Get category breakdown"""
        return self._request('GET', '/analytics/categories', params=params)
    
    # Teams methods
    def get_teams(self) -> Dict[str, Any]:
        """Get user's teams"""
        return self._request('GET', '/teams')
    
    def get_team_stats(self, team_id: str) -> Dict[str, Any]:
        """Get team statistics"""
        return self._request('GET', f'/teams/{team_id}/stats')


class AdvancedMataresitAPI(MataresitAPI):
    """Advanced API client with retry logic and additional features"""
    
    def __init__(self, api_key: str, base_url: str = MATARESIT_API_BASE, max_retries: int = 3):
        super().__init__(api_key, base_url)
        self.max_retries = max_retries
    
    def _request_with_retry(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make API request with retry logic"""
        for attempt in range(1, self.max_retries + 1):
            try:
                return self._request(method, endpoint, **kwargs)
            
            except MataresitAPIError as e:
                if e.status_code == 429 and attempt < self.max_retries:  # Rate limited
                    delay = 2 ** attempt  # Exponential backoff
                    print(f"Rate limited, retrying in {delay} seconds...")
                    time.sleep(delay)
                    continue
                raise
        
        raise MataresitAPIError("Max retries exceeded")
    
    def upload_receipt_with_processing(self, receipt: Receipt, wait_for_processing: bool = True) -> Dict[str, Any]:
        """Upload receipt and optionally wait for processing"""
        # Create receipt
        result = self.create_receipt(receipt)
        receipt_id = result['data']['id']
        
        if wait_for_processing:
            return self.wait_for_processing(receipt_id)
        
        return result
    
    def wait_for_processing(self, receipt_id: str, max_wait: int = 30) -> Dict[str, Any]:
        """Wait for receipt processing to complete"""
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            receipt = self.get_receipt(receipt_id)
            status = receipt['data'].get('processingStatus', 'pending')
            
            if status == 'complete':
                return receipt
            elif status == 'failed':
                raise MataresitAPIError("Receipt processing failed")
            
            time.sleep(2)  # Wait 2 seconds before checking again
        
        raise MataresitAPIError("Receipt processing timeout")
    
    def bulk_upload_with_progress(self, receipts: List[Receipt], batch_size: int = 10) -> Dict[str, Any]:
        """Upload receipts in batches with progress tracking"""
        total_receipts = len(receipts)
        successful = []
        failed = []
        
        print(f"Uploading {total_receipts} receipts in batches of {batch_size}...")
        
        for i in range(0, total_receipts, batch_size):
            batch = receipts[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total_receipts + batch_size - 1) // batch_size
            
            print(f"Processing batch {batch_num}/{total_batches} ({len(batch)} receipts)...")
            
            try:
                result = self.create_receipts_batch(batch)
                successful.extend(result['data']['created'])
                failed.extend(result['data']['errors'])
                
                print(f"Batch {batch_num} complete: {len(result['data']['created'])} successful, {len(result['data']['errors'])} failed")
                
            except MataresitAPIError as e:
                print(f"Batch {batch_num} failed: {e.message}")
                failed.extend([{'error': e.message, 'batch': batch_num}])
            
            # Small delay between batches to avoid rate limiting
            if i + batch_size < total_receipts:
                time.sleep(1)
        
        return {
            'total': total_receipts,
            'successful': len(successful),
            'failed': len(failed),
            'successful_receipts': successful,
            'failed_receipts': failed
        }


def basic_examples():
    """Basic usage examples"""
    api = MataresitAPI(API_KEY)
    
    try:
        # Health check
        print("=== Health Check ===")
        health = api.health_check()
        print(f"API Status: {health['data']['status']}")
        print(f"User Scopes: {health['data']['user']['scopes']}")
        
        # Create a receipt
        print("\n=== Create Receipt ===")
        receipt = Receipt(
            merchant="Starbucks Coffee",
            date="2025-01-15",
            total=15.50,
            currency="USD",
            payment_method="Credit Card",
            category="Food & Dining"
        )
        
        result = api.create_receipt(receipt)
        receipt_id = result['data']['id']
        print(f"Created receipt: {receipt_id}")
        
        # Get receipts with filtering
        print("\n=== Get Receipts ===")
        receipts = api.get_receipts(
            start_date="2025-01-01",
            end_date="2025-01-31",
            limit=10,
            sort_by="total",
            sort_order="desc"
        )
        print(f"Found {len(receipts['data']['receipts'])} receipts")
        
        # Search
        print("\n=== Search ===")
        search_results = api.search(
            query="coffee expenses",
            sources=["receipts"],
            limit=5
        )
        print(f"Search found {len(search_results['data']['results'])} results")
        
        # Analytics
        print("\n=== Analytics ===")
        summary = api.get_spending_summary(
            start_date="2025-01-01",
            end_date="2025-01-31",
            currency="USD"
        )
        print(f"Total spending: ${summary['data']['totalAmount']:.2f}")
        print(f"Average amount: ${summary['data']['averageAmount']:.2f}")
        
    except MataresitAPIError as e:
        print(f"API Error: {e.message} (Code: {e.error_code})")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")


def advanced_examples():
    """Advanced usage examples"""
    api = AdvancedMataresitAPI(API_KEY)
    
    try:
        # Batch upload with progress
        print("\n=== Batch Upload Example ===")
        receipts = [
            Receipt("Amazon", "2025-01-15", 129.99, "USD", "Credit Card", "Office Supplies"),
            Receipt("Uber", "2025-01-15", 25.50, "USD", "Credit Card", "Transportation"),
            Receipt("Walmart", "2025-01-15", 67.89, "USD", "Debit Card", "Groceries"),
            Receipt("Shell", "2025-01-15", 45.00, "USD", "Credit Card", "Transportation"),
            Receipt("Best Buy", "2025-01-15", 299.99, "USD", "Credit Card", "Electronics")
        ]
        
        result = api.bulk_upload_with_progress(receipts, batch_size=3)
        print(f"\nBulk upload complete:")
        print(f"Total: {result['total']}")
        print(f"Successful: {result['successful']}")
        print(f"Failed: {result['failed']}")
        
        # Generate monthly report
        print("\n=== Monthly Report ===")
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        analytics = api.get_analytics(
            start_date=start_date.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d")
        )
        
        summary = analytics['data']['summary']
        categories = analytics['data']['categoryBreakdown']
        
        print(f"Monthly Spending Report ({start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')})")
        print(f"Total Amount: ${summary['totalAmount']:.2f}")
        print(f"Total Receipts: {summary['totalReceipts']}")
        print(f"Average Amount: ${summary['averageAmount']:.2f}")
        
        print("\nTop Categories:")
        for category in categories[:5]:
            print(f"  {category['category']}: ${category['amount']:.2f} ({category['percentage']:.1f}%)")
        
    except MataresitAPIError as e:
        print(f"API Error: {e.message}")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")


def real_world_integration():
    """Real-world integration example"""
    api = AdvancedMataresitAPI(API_KEY)
    
    # Simulate processing receipts from a CSV file or database
    expense_data = [
        {"merchant": "Office Depot", "amount": 89.99, "date": "2025-01-15", "category": "Office Supplies"},
        {"merchant": "Starbucks", "amount": 12.50, "date": "2025-01-15", "category": "Food & Dining"},
        {"merchant": "Uber", "amount": 28.75, "date": "2025-01-15", "category": "Transportation"},
        {"merchant": "Amazon", "amount": 156.99, "date": "2025-01-14", "category": "Office Supplies"},
        {"merchant": "Shell", "amount": 52.00, "date": "2025-01-14", "category": "Transportation"}
    ]
    
    try:
        print("=== Real-World Integration Example ===")
        print(f"Processing {len(expense_data)} expense records...")
        
        # Convert to Receipt objects
        receipts = [
            Receipt(
                merchant=item["merchant"],
                date=item["date"],
                total=item["amount"],
                category=item["category"],
                currency="USD"
            )
            for item in expense_data
        ]
        
        # Upload with error handling
        successful_uploads = []
        failed_uploads = []
        
        for i, receipt in enumerate(receipts, 1):
            try:
                print(f"Uploading receipt {i}/{len(receipts)}: {receipt.merchant}")
                result = api.create_receipt(receipt)
                successful_uploads.append(result['data'])
                print(f"  ✓ Success: {result['data']['id']}")
                
            except MataresitAPIError as e:
                failed_uploads.append({'receipt': receipt, 'error': e.message})
                print(f"  ✗ Failed: {e.message}")
        
        # Summary
        print(f"\nUpload Summary:")
        print(f"Successful: {len(successful_uploads)}")
        print(f"Failed: {len(failed_uploads)}")
        
        if successful_uploads:
            total_amount = sum(r['total'] for r in successful_uploads)
            print(f"Total amount processed: ${total_amount:.2f}")
        
        # Generate insights
        if len(successful_uploads) >= 3:
            print("\n=== Generating Insights ===")
            search_result = api.search("office supplies and transportation expenses")
            
            if search_result['data']['results']:
                print("Related expenses found:")
                for result in search_result['data']['results'][:3]:
                    print(f"  - {result['title']}: {result['content'][:100]}...")
        
    except Exception as e:
        print(f"Integration failed: {str(e)}")


if __name__ == "__main__":
    if not API_KEY:
        print("Error: MATARESIT_API_KEY environment variable not set")
        print("Create a .env file with: MATARESIT_API_KEY=mk_live_your_api_key_here")
        exit(1)
    
    print("Running Mataresit API Python Examples...\n")
    
    basic_examples()
    advanced_examples()
    real_world_integration()
    
    print("\n=== All Examples Complete ===")
