
# Automated Receipt Processing Application

A web-based application for automating receipt data extraction using OCR technology with Amazon Textract and integrating with Zoho for expense tracking.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Component Structure](#component-structure)
6. [External Integrations](#external-integrations)
7. [Development Guide](#development-guide)

## Overview

The Automated Receipt Processing Application streamlines the digitization and management of paper receipts through a complete workflow:

1. **Upload** - Users upload receipt images in JPEG, PNG, or PDF formats
2. **Process** - Amazon Textract extracts text and data from the receipt
3. **Extract** - Intelligent parsing identifies key information (date, merchant, amount, etc.)
4. **Verify** - Side-by-side interface for users to review and edit data
5. **Sync** - Integration with Zoho Expense for seamless expense tracking

### Key Features

- OCR-powered data extraction with confidence scores
- Enhanced receipt image viewing with zoom, rotate, and fullscreen capabilities
- Side-by-side editing with original image for verification
- Raw OCR text viewing for detailed analysis
- Reprocessing option for improved extraction results
- Reimbursement tracking
- Multi-currency support
- Secure Zoho OAuth integration

## Architecture

The application follows a modern web architecture:

```
┌─────────────┐     ┌───────────────┐     ┌──────────────┐
│ React       │     │ Supabase Edge │     │ Amazon       │
│ Frontend    │◄────┤ Functions     │◄────┤ Textract     │
│ Components  │     │               │     │              │
└─────────────┘     └───────────────┘     └──────────────┘
       ▲                    ▲                    ▲
       │                    │                    │
       ▼                    ▼                    │
┌─────────────┐     ┌───────────────┐           │
│ Supabase    │     │ Supabase      │           │
│ Auth        │     │ Database      │           │
└─────────────┘     └───────────────┘           │
                            ▲                   │
                            │                   │
                            ▼                   │
                    ┌───────────────┐           │
                    │ Supabase      │◄──────────┘
                    │ Storage       │
                    └───────────────┘
                            ▲
                            │
                            ▼
                    ┌───────────────┐
                    │ Zoho          │
                    │ Integration   │
                    └───────────────┘
```

### Data Flow

1. User uploads a receipt image through the React frontend
2. Image is stored in Supabase Storage ("Receipt Images" bucket)
3. Edge Function triggers OCR processing with Amazon Textract
4. Extracted data is stored in Supabase Database
5. Frontend displays data alongside image for user verification
6. Verified data can be synced to Zoho Expense

## Database Schema

### Tables

#### `receipts`
- `id` (UUID, PK) - Unique identifier
- `user_id` (UUID, FK) - Reference to the user
- `merchant` (VARCHAR) - Store/vendor name
- `date` (DATE) - Receipt date
- `total` (DECIMAL) - Total amount
- `tax` (DECIMAL) - Tax amount
- `currency` (VARCHAR) - Currency code (default: USD)
- `payment_method` (VARCHAR) - Payment method
- `status` (VARCHAR) - Status (unreviewed, reviewed, synced)
- `image_url` (TEXT) - URL to stored receipt image
- `full_text` (TEXT) - Raw OCR text from Textract
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

#### `line_items`
- `id` (UUID, PK) - Unique identifier
- `receipt_id` (UUID, FK) - Reference to parent receipt
- `description` (TEXT) - Item description
- `amount` (DECIMAL) - Item amount
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

#### `confidence_scores`
- `id` (UUID, PK) - Unique identifier
- `receipt_id` (UUID, FK) - Reference to parent receipt
- `merchant` (INTEGER) - Confidence score for merchant field
- `date` (INTEGER) - Confidence score for date field
- `total` (INTEGER) - Confidence score for total field
- `tax` (INTEGER) - Confidence score for tax field
- `line_items` (INTEGER) - Confidence score for line items
- `payment_method` (INTEGER) - Confidence score for payment method
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

### Storage Buckets

- `Receipt Images` - Storage for receipt image files

## API Endpoints

### Receipt Processing

#### Upload & Process Receipt
- **Endpoint**: `POST /api/receipts/upload`
- **Function**: Upload and process receipt image
- **Parameters**: Image file (JPEG, PNG, PDF)
- **Returns**: Receipt ID and processing status

#### Process Receipt
- **Endpoint**: `POST /api/receipts/:id/process`
- **Function**: Process existing receipt with OCR
- **Returns**: Extracted data with confidence scores

#### Get Receipt
- **Endpoint**: `GET /api/receipts/:id`
- **Function**: Retrieve receipt details
- **Returns**: Receipt data with line items and confidence scores

#### Update Receipt
- **Endpoint**: `PUT /api/receipts/:id`
- **Function**: Update receipt information
- **Parameters**: Updated receipt fields
- **Returns**: Updated receipt data

#### Delete Receipt
- **Endpoint**: `DELETE /api/receipts/:id`
- **Function**: Delete receipt and associated data
- **Returns**: Success status

### Zoho Integration

#### Connect Zoho
- **Endpoint**: `GET /api/zoho/connect`
- **Function**: Initiate OAuth flow with Zoho
- **Returns**: OAuth authorization URL

#### Zoho Callback
- **Endpoint**: `GET /api/zoho/callback`
- **Function**: Handle OAuth callback from Zoho
- **Parameters**: OAuth code
- **Returns**: Success status and tokens

#### Sync Receipt to Zoho
- **Endpoint**: `POST /api/receipts/:id/sync-to-zoho`
- **Function**: Sync receipt data to Zoho Expense
- **Returns**: Sync status and Zoho expense ID

## Component Structure

### Pages

#### Dashboard (`/dashboard`)
- Receipt list and filtering
- Upload button
- Summary statistics

#### Receipt View (`/receipt/:id`)
- Advanced image viewer with zoom, rotate, and fullscreen
- Side-by-side receipt image and data editor
- Confidence score indicators
- Raw OCR text viewing
- Reprocess with OCR option
- Sync to Zoho button

#### Authentication (`/auth`)
- Login/Signup form
- Zoho connection management

### Core Components

#### `UploadZone`
- Drag & drop or file select interface
- Upload progress indicator
- File validation

#### `ImageViewer`
- Enhanced image viewing capabilities
- Zoom, rotate, pan, and fullscreen options
- Error handling for missing images

#### `ReceiptViewer`
- Side-by-side layout for image and data
- Data editing interface with confidence indicators
- Raw OCR text display option

#### `ReceiptCard`
- Summary display of receipt for listings
- Status indicator
- Quick actions

#### `ConfidenceIndicator`
- Visual display of confidence scores
- Color-coded indicators (green/yellow/red)

## External Integrations

### Amazon Textract

The application uses Amazon Textract for OCR processing and data extraction.

#### Implementation

1. **Edge Function**: `process-receipt`
   - Receives image from storage
   - Sends to Amazon Textract API
   - Processes raw results and extracts structured data
   - Stores results with confidence scores

#### Required Configuration

- AWS credentials stored as Supabase secrets:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`

### Zoho Integration

The application integrates with Zoho Expense for expense tracking.

#### Implementation

1. **OAuth Flow**:
   - Edge Function: `zoho-connect` - Initiates OAuth connection
   - Edge Function: `zoho-callback` - Handles OAuth response

2. **Data Sync**:
   - Edge Function: `sync-to-zoho` - Sends receipt data to Zoho API
   - Attaches receipt image to expense record
   - Updates local status after successful sync

#### Required Configuration

- Zoho API credentials stored as Supabase secrets:
  - `ZOHO_CLIENT_ID`
  - `ZOHO_CLIENT_SECRET`
  - `ZOHO_REDIRECT_URI`

## Development Guide

### Prerequisites

- Node.js & npm installed
- Supabase account
- Amazon AWS account with Textract access
- Zoho developer account

### Local Development

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm i

# Start development server
npm run dev
```

### Required Environment Variables

These will be stored as Supabase secrets:

- `AWS_ACCESS_KEY_ID` - Amazon AWS access key
- `AWS_SECRET_ACCESS_KEY` - Amazon AWS secret key
- `AWS_REGION` - Amazon AWS region
- `ZOHO_CLIENT_ID` - Zoho API client ID
- `ZOHO_CLIENT_SECRET` - Zoho API client secret
- `ZOHO_REDIRECT_URI` - OAuth redirect URI

### Deployment

Automated deployment is available through Lovable's publishing feature:

1. Open [Lovable](https://lovable.dev/projects/c42ed42a-b743-487c-bea8-278f04f52631)
2. Click on Share -> Publish
