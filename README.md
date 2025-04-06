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
- **AI-powered data enhancement (Gemini)**:
  - Suggests corrections for OCR-extracted fields
  - Predicts expense categories
  - Identifies payment methods and currency
- Receipt image manipulation (zoom, rotate)
- Side-by-side editing with original image
- **User Feedback Loop**: Logs corrections to improve AI suggestions over time
- Reimbursement tracking
- Multi-currency support
- Secure Zoho OAuth integration
- Real-time processing logs during upload and OCR

## Architecture

The application follows a modern web architecture, now incorporating AI enhancement:

```mermaid
graph TD
    subgraph User Interaction
        FE[React Frontend]
    end

    subgraph Supabase Backend
        Auth[Supabase Auth]
        DB[(Supabase DB)]
        Store[(Supabase Storage)]
        Func_Process[process-receipt (Edge Fn)]
        Func_Enhance[enhance-receipt-data (Edge Fn)]
        Func_Zoho[Zoho Functions (Edge Fn)]
    end

    subgraph External Services
        Textract[Amazon Textract]
        Gemini[Google Gemini]
        Zoho[Zoho Expense]
    end

    FE -- Upload Image --> Store
    FE -- Trigger Process --> Func_Process
    Func_Process -- Image URL --> Textract
    Textract -- OCR Data --> Func_Process
    Func_Process -- Textract Data --> Func_Enhance
    Func_Enhance -- Prompt --> Gemini
    Gemini -- Enhanced Data --> Func_Enhance
    Func_Enhance -- AI Suggestions, Category --> Func_Process
    Func_Process -- Save Combined Data --> DB(receipts, line_items, confidence_scores)
    FE -- Fetch Receipt --> DB
    FE -- Display Data + AI --> FE
    FE -- Save Edits --> DB(UPDATE receipts, DELETE/INSERT line_items)
    FE -- Log Correction --> DB(INSERT corrections)
    FE -- Trigger Sync --> Func_Zoho
    Func_Zoho -- Data --> Zoho
    FE -- Login/Signup --> Auth
```

### Data Flow

1. User uploads a receipt image through the React frontend
2. Image is stored in Supabase Storage
3. Edge Function `process-receipt` triggers:
   - Sends image to Amazon Textract for OCR
   - Receives OCR data
   - Calls `enhance-receipt-data` Edge Function with OCR data
4. Edge Function `enhance-receipt-data`:
   - Sends data to Google Gemini API for analysis
   - Receives AI suggestions (corrections, category)
   - Returns enhanced data to `process-receipt`
5. `process-receipt` combines OCR and AI data, saves to Supabase Database (`receipts`, `line_items`, `confidence_scores`)
6. Frontend displays combined data, AI suggestions, and category for user verification
7. User edits data; corrections are logged to `corrections` table (Feedback Loop)
8. Verified data can be synced to Zoho Expense

## Database Schema

### Tables

#### `receipts`
- `id` (UUID, PK) - Unique identifier
- `user_id` (UUID, FK) - Reference to the user
- `merchant` (VARCHAR) - Store/vendor name
- `date` (DATE) - Receipt date
- `total` (DECIMAL) - Total amount
- `tax` (DECIMAL) - Tax amount
- `currency` (VARCHAR) - Currency code (e.g., MYR, USD)
- `payment_method` (VARCHAR) - Payment method
- `predicted_category` (TEXT) - AI-predicted expense category
- `ai_suggestions` (JSONB) - AI-generated suggestions for field corrections
- `status` (VARCHAR) - Status (unreviewed, reviewed, synced)
- `image_url` (TEXT) - URL to stored receipt image
- `fullText` (TEXT) - Raw text extracted by OCR
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
- `payment_method` (INTEGER) - Confidence score for payment method field
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

#### `processing_logs`
- `id` (UUID, PK) - Unique identifier for the log entry
- `receipt_id` (UUID, FK) - Reference to the associated receipt
- `created_at` (TIMESTAMPTZ) - Timestamp when the log was created
- `status_message` (TEXT) - Description of the processing step or status
- `step_name` (TEXT) - Name of the processing step (e.g., FETCH, OCR, GEMINI, SAVE)

#### `corrections`
- `id` (SERIAL, PK) - Unique identifier for the correction entry
- `receipt_id` (UUID, FK) - Reference to the receipt being corrected
- `field_name` (TEXT) - Name of the field that was corrected (e.g., 'merchant', 'total')
- `original_value` (TEXT) - The original value extracted by OCR/AI
- `ai_suggestion` (TEXT) - The suggestion provided by the AI for this field
- `corrected_value` (TEXT) - The final value saved by the user
- `created_at` (TIMESTAMP WITH TIME ZONE) - Timestamp when the correction was made
- **Note**: This table has Row-Level Security (RLS) enabled, allowing users to insert, view, update, and delete only their own correction records.

### Storage Buckets

- `receipt_images` - Storage for receipt image files

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
- Side-by-side receipt image and data editor
- Confidence score indicators
- Zoom and rotate controls
- Sync to Zoho button

#### Authentication (`/auth`)
- Login/Signup form
- Zoho connection management

### Core Components

#### `UploadZone`
- Drag & drop or file select interface
- Designed for use within a modal dialog.
- File validation for JPEG, PNG, PDF.
- Real-time display of detailed backend processing stages (e.g., Queued, Fetching, OCR, Analyzing, Saving, Complete, Error) using a visual timeline.
- Leverages Supabase Realtime for live updates on processing status.
- Shows detailed processing logs.
- Clear error state display with retry option.

#### `ReceiptViewer`
- Side-by-side layout for image and data
- Image manipulation controls
- Data editing interface with confidence indicators
- **AI Features**: Displays AI-predicted category and field suggestions with "Accept" buttons
- Real-time display of processing logs for the viewed receipt (toggleable)

#### `ReceiptCard`
- Summary display of receipt for listings
- Status indicator
- Quick actions

#### `ConfidenceIndicator`
- Visual display of confidence scores
- Color-coded indicators (green/yellow/red)

## External Integrations

### Amazon Textract

The application uses Amazon Textract for initial OCR processing and data extraction.

#### Implementation

1. **Edge Function**: `process-receipt`
   - Receives image from storage
   - Sends to Amazon Textract API
   - Processes raw results and extracts structured data
   - **Passes data to `enhance-receipt-data` function**

#### Required Configuration

- AWS credentials stored as Supabase secrets:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`

### Google Gemini

The application uses the Google Gemini API via the `enhance-receipt-data` Edge Function to provide AI-powered suggestions and categorization.

#### Implementation

1. **Edge Function**: `enhance-receipt-data`
   - Receives Textract data and full text from `process-receipt`
   - Constructs a prompt for Gemini asking for currency, payment method, category, and field suggestions
   - Calls the Gemini API
   - Parses the JSON response containing AI enhancements
   - Returns the enhanced data back to `process-receipt`

#### Required Configuration

- Gemini API Key stored as a Supabase secret:
  - `GEMINI_API_KEY`

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
- Google Cloud account with Gemini API enabled
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
- `GEMINI_API_KEY` - Google Gemini API Key
- `ZOHO_CLIENT_ID` - Zoho API client ID
- `ZOHO_CLIENT_SECRET` - Zoho API client secret
- `ZOHO_REDIRECT_URI` - OAuth redirect URI

### Deployment

Automated deployment is available through Lovable's publishing feature:

1. Open [Lovable](https://lovable.dev/projects/c42ed42a-b743-487c-bea8-278f04f52631)
2. Click on Share -> Publish
