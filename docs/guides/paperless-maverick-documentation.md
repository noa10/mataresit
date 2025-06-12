# Mataresit: Automated Receipt Processing

A web-based application for automating receipt data extraction using OCR technology with Amazon Textract.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Component Structure](#component-structure)
6. [External Integrations](#external-integrations)
7. [Development Guide](#development-guide)

## Overview

Mataresit streamlines the digitization and management of paper receipts through a complete workflow:

1. **Upload** - Users upload receipt images (JPEG, PNG, PDF). The UI provides real-time feedback on upload progress and backend processing stages.
2. **Process** - Amazon Textract performs OCR, extracting text and structured data.
3. **Enhance** - Google Gemini enhances the data, validates formats, normalizes fields (merchant, payment method), suggests corrections, predicts categories, and calculates confidence scores.
4. **Verify** - A side-by-side interface allows users to review OCR data alongside the receipt image, accept AI suggestions, and make corrections. Confidence indicators highlight potentially inaccurate fields.
5. **Feedback & Store** - User corrections are logged to a `corrections` table, creating a feedback loop for future AI improvements. Final data is stored in the Supabase database.
6. **Sync** - Verified expenses can be optionally synced to an external service.

### Key Features

- **OCR Data Extraction**: Utilizes Amazon Textract for robust text and data extraction.
- **AI-Powered Data Enhancement (Gemini)**:
    - **Normalization**: Standardizes merchant names and payment methods.
    - **Validation**: Checks date formats and flags inconsistencies.
    - **Categorization**: Predicts expense categories (e.g., Groceries, Dining, Travel).
    - **Suggestions**: Provides field-level correction suggestions for potential OCR errors.
    - **Currency Identification**: Detects currency (with basic USD->MYR conversion).
- **Confidence Scoring**:
    - Multi-stage scoring (OCR -> AI -> User Verification).
    - Scores assigned to key fields (merchant, date, total, etc.).
    - UI indicators (color-coded) highlight low-confidence fields.
    - User edits automatically set score to 100%.
- **User Feedback Loop**: Logs user corrections vs. original/AI values to the `corrections` table, enabling future model tuning.
- **Interactive Review UI**:
    - Side-by-side image viewer and data editor.
    - Image manipulation (zoom, rotate).
    - "Accept Suggestion" buttons for quick AI correction application.
- **Real-time Processing Feedback**:
    - Detailed upload status tracking (`ReceiptUpload` state).
    - Live updates on backend processing stages (OCR, AI Enhancement) via Supabase Realtime.
    - Displays final processing time.
- **Secure Authentication**: Managed by Supabase Auth.
- **Multi-currency Support**: Handles different currencies, primarily MYR and USD.

## Architecture

The application follows a modern web architecture, integrating cloud services for specialized tasks:

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
        Func_GenerateReport[generate-pdf-report (Edge Fn)] %% Added Node %%
    end

    subgraph External Services
        Textract[Amazon Textract]
        Gemini[Google Gemini]
      end

    FE -- Upload Image --> Store
    FE -- Trigger Process --> Func_Process
    Func_Process -- Image URL --> Textract
    Textract -- OCR Data --> Func_Process
    Func_Process -- Textract Data --> Func_Enhance
    Func_Enhance -- Prompt --> Gemini
    Gemini -- Enhanced Data --> Func_Enhance
    Func_Enhance -- AI Suggestions, Category --> Func_Process
    Func_Process -- Save Combined Data --> DB(receipts, line_items) %% Updated Table Refs %%
    FE -- Fetch Receipt --> DB
    FE -- Display Data + AI --> FE
    FE -- Save Edits --> DB(UPDATE receipts, DELETE/INSERT line_items)
    FE -- Log Correction --> DB(INSERT corrections)
    FE -- Login/Signup --> Auth
    FE -- Trigger Report --> Func_GenerateReport %% Added Interaction %%
    Func_GenerateReport -- Fetch Data --> DB %% Added Interaction %%
```

### Data Flow

1. User uploads a receipt image via the React frontend (`UploadZone`). Frontend tracks upload state (`ReceiptUpload`).
2. Image is stored in Supabase Storage.
3. An initial `receipts` record is created/updated in Supabase DB.
4. Edge Function `process-receipt` is triggered (records start time).
5. `process-receipt` sends the image URL to Amazon Textract for OCR.
6. Textract returns OCR data (text, fields) to `process-receipt`.
7. `process-receipt` calls the `enhance-receipt-data` Edge Function with OCR data.
8. `enhance-receipt-data`:
    - Constructs a prompt for Google Gemini, requesting normalization, validation, categorization, suggestions, and confidence scores.
    - Sends prompt to Gemini API.
    - Receives structured JSON response (enhanced data, `ai_suggestions`, `predicted_category`, potentially refined confidence scores).
    - Returns enhanced data to `process-receipt`.
9. `process-receipt` combines OCR and AI data. It calculates the total `processing_time` (end time - start time).
11. `process-receipt` saves the final data, including `ai_suggestions`, `predicted_category`, `processing_time`, and the `confidence_scores` JSON object, to the Supabase Database (`receipts`, `line_items` tables). Updates `processing_status`.
12. User can trigger PDF report generation from the Analysis Page. The `generate-pdf-report` Edge Function fetches relevant data from the database and generates the PDF.
13. User reviews, accepts suggestions, or manually edits data.
13. On save, frontend compares initial vs. final data and logs differences to the `corrections` table via `receiptService.logCorrections`.
14. Final, user-verified data is updated in the `receipts` and related tables.
15. Verified data can optionally be synced to an external service.

## Database Schema

### Tables

#### `receipts`
- `id` (UUID, PK) - Unique identifier
- `user_id` (UUID, FK `auth.users`) - Reference to the user
- `merchant` (VARCHAR) - Original merchant name from OCR/user
- `normalized_merchant` (TEXT) - Standardized merchant name (optional, added via migration)
- `date` (DATE) - Receipt date
- `total` (DECIMAL) - Total amount
- `tax` (DECIMAL) - Tax amount (optional)
- `currency` (VARCHAR) - Currency code (e.g., MYR, USD)
- `currency_converted` (BOOLEAN, DEFAULT FALSE) - Flag indicating if currency was converted (e.g., USD to MYR) (optional, added via migration)
- `payment_method` (VARCHAR) - Payment method (standardized)
- `predicted_category` (TEXT) - AI-predicted expense category
- `ai_suggestions` (JSONB) - AI-generated suggestions (e.g., `{"merchant": "Suggestion A", "total": "Suggestion B"}`)
- `confidence_scores` (JSONB) - Stores confidence scores for fields like merchant, date, total, etc., as a JSON object.
- `status` (VARCHAR) - Review status (e.g., `unreviewed`, `reviewed`, `synced`)
- `processing_status` (TEXT) - Live status of backend processing (e.g., 'uploading', 'processing_ocr', 'processing_ai', 'failed_ai', 'complete')
- `processing_error` (TEXT) - Stores error messages if processing fails
- `processing_time` (FLOAT) - Time taken for backend processing in seconds (optional, added via migration)
- `image_url` (TEXT) - URL to stored receipt image in Supabase Storage
- `fullText` (TEXT) - Raw text extracted by OCR (optional)
- `created_at` (TIMESTAMP WITH TIME ZONE) - Creation timestamp
- `updated_at` (TIMESTAMP WITH TIME ZONE) - Last update timestamp

#### `line_items`
- `id` (UUID, PK) - Unique identifier
- `receipt_id` (UUID, FK) - Reference to parent receipt
- `description` (TEXT) - Item description
- `amount` (DECIMAL) - Item amount
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp


#### `processing_logs`
- `id` (UUID, PK) - Unique identifier for the log entry
- `receipt_id` (UUID, FK) - Reference to the associated receipt
- `created_at` (TIMESTAMPTZ) - Timestamp when the log was created
- `status_message` (TEXT) - Description of the processing step or status
- `step_name` (TEXT) - Name of the processing step (e.g., UPLOAD, OCR, AI_ENHANCE, SAVE)

#### `corrections`
- `id` (SERIAL, PK) - Unique identifier for the correction entry
- `receipt_id` (UUID, FK `receipts.id` ON DELETE CASCADE) - Reference to the receipt being corrected
- `field_name` (TEXT NOT NULL) - Name of the field that was corrected (e.g., 'merchant', 'total')
- `original_value` (TEXT) - The original value extracted by OCR
- `ai_suggestion` (TEXT) - The suggestion provided by the AI for this field, if any
- `corrected_value` (TEXT NOT NULL) - The final value saved by the user
- `created_at` (TIMESTAMP WITH TIME ZONE DEFAULT NOW()) - Timestamp when the correction was made
- **Row-Level Security (RLS)**: Enabled. Policies ensure users can only INSERT, SELECT, UPDATE, and DELETE their own correction records, enforced by matching `receipt.user_id` to `auth.uid()`.

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

#### Analysis (`/analysis`)
- Receipt list and filtering with summary statistics
- Charts and visualizations of expense data
- Option to generate PDF reports for a selected day

#### Settings (`/settings`)
- User profile management
- Application settings (e.g., currency preferences, integration settings)

#### Authentication (`/auth`)
- Login/Signup form

### Core Components

#### `UploadZone`
- Drag & drop or file select interface.
- File validation (JPEG, PNG, PDF).
- **Real-time Detailed Status**: Uses `ReceiptUpload` interface to track and display:
    - Overall status (`pending`, `uploading`, `processing`, `completed`, `error`).
    - Upload progress percentage.
    - Current backend processing stage (`queueing`, `ocr`, `ai_enhancement`).
    - Specific error details if failure occurs.
- Leverages Supabase Realtime for live updates on `processing_status` from the `receipts` table.
- Can display processing logs (`ProcessingLogs`) and error states (`ErrorState`).

#### `ReceiptViewer`
- Side-by-side layout for image and data.
- Image manipulation controls (zoom, rotate).
- Data editing interface.
- **Confidence Indicators**: Displays color-coded indicators next to fields based on `confidence_scores`.
- **AI Features**:
    - Displays AI-predicted category (e.g., in a dropdown).
    - Shows AI field suggestions (`ai_suggestions`) alongside relevant fields with "Accept" buttons.
- **Real-time Processing Status**: Shows indicator during active processing or if processing failed.
- **Feedback Logging**: Triggers `logCorrections` on save to record user changes in the `corrections` table.

#### `ReceiptCard`
- Summary display of receipt for listings
- Status indicator (unreviewed/reviewed/synced)
- **Processing Status**: Displays a badge indicating the current processing status (e.g., 'Uploading...', 'OCR Failed') if not 'complete'. Shows an overlay during active processing.
- Quick actions

#### `DailyPDFReportGenerator`
- Component used on the AnalysisPage to select a date and trigger the generation and download of a daily expense report PDF via the `generate-pdf-report` Edge Function.

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

## Development Guide

### Prerequisites

- Node.js & npm installed
- Supabase account
- Amazon AWS account with Textract access
- Google Cloud account with Gemini API enabled

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

### Deployment

Automated deployment is available through Lovable's publishing feature:

1. Open [Lovable](https://lovable.dev/projects/c42ed42a-b743-487c-bea8-278f04f52631)
2. Click on Share -> Publish

## Confidence Scoring

The application employs a multi-stage confidence scoring system:
1. **Initial OCR Scores**: Textract provides baseline confidence scores. (Note: Plans mention enhancing this, e.g., with a base 50% + validation bonuses/penalties, but current implementation might rely directly on Textract).
2. **AI Enhancement**: Gemini may refine scores based on its analysis, format validation, and pattern matching (e.g., known merchants, valid date formats). Confidence for `predicted_category` is also generated.
3. **User Verification**: When a user manually edits and saves a field, its confidence score is implicitly set to 100%.
4. **Display**: Scores are visualized in the `ReceiptViewer` using color-coded indicators (e.g., Green >80%, Yellow 60-80%, Red <60%) to guide user review.

## Data Normalization & Validation

To improve data consistency and quality, the backend process (primarily within the `enhance-receipt-data` function via Gemini prompts, potentially some logic in `process-receipt`) performs:
- **Merchant Name Normalization**: Removes extra whitespace/line breaks, standardizes casing (e.g., to uppercase), and potentially maps known aliases.
- **Payment Method Normalization**: Maps variations (e.g., "MASTER", "MASTERCARD") to standard terms (e.g., "Mastercard"). Defaults to "Unknown" if missing.
- **Date Validation**: Checks for valid date formats (YYYY-MM-DD preferred). Invalid or far-future dates might be flagged or rejected.
- **Currency Handling**: Standardizes currency codes (e.g., "MYR", "USD"). Includes basic logic to convert USD to MYR if detected (using a fixed rate - requires updating for production).

## Troubleshooting

Based on implementation experiences, common issues and resolutions include:
- **Database Migrations Out of Sync**:
    - **Symptom**: Local migrations fail because the remote schema differs (e.g., missing initial table creations).
    - **Resolution**:
        1. Use `supabase db pull --schema public > supabase/migrations/YYYYMMDDHHMMSS_remote_schema.sql` to capture the current remote schema as a new migration file. Ensure this file has the *earliest* timestamp if it contains foundational `CREATE TABLE` statements missing locally.
        2. Use `supabase migration repair --status <failed_migration_version>` to mark problematic remote migrations as resolved if they were manually applied or are inconsistent.
        3. Use `supabase migration list` to check the status locally and remotely.
        4. Run `supabase migration up` again.
- **Row-Level Security (RLS) Violations on `corrections` Table**:
    - **Symptom**: Users receive "new row violates row-level security policy" errors when trying to save corrections after editing a receipt.
    - **Cause**: RLS policies were missing or incorrect for the `corrections` table.
    - **Resolution**: Ensure RLS is enabled on the `corrections` table and appropriate policies exist (via migrations `add_corrections_rls_policy.sql`, `add_corrections_additional_policies.sql`) allowing authenticated users `INSERT`, `SELECT`, `UPDATE`, `DELETE` based on `auth.uid() == (SELECT user_id FROM receipts WHERE id = receipt_id)`.

## Future Enhancements

Potential improvements based on planning documents:
- **Advanced Currency Conversion**: Integrate a live exchange rate API (e.g., via a scheduled Supabase Edge Function).
- **Improved AI Prompting**: Refine Gemini prompts with more few-shot examples and fine-tuning based on `corrections` data analysis.
- **AI Prediction for Missing Fields**: Train models or enhance prompts to predict missing data (e.g., payment method if not found).
- **Line Item Extraction & Categorization**: Expand AI capabilities to extract and categorize individual line items.
- **Duplicate Detection**: Implement logic to flag potential duplicate receipts based on merchant, date, and total.
- **Batch Processing**: Enhance backend functions to process multiple receipts in parallel.
- **Reporting Dashboard**: A basic UI dashboard showing expense trends and spending by category/merchant has been implemented (`AnalysisPage`). Further enhancements could include AI confidence metrics and more detailed reporting options.
- **Enhanced Confidence Scoring Algorithm**: Implement more granular scoring logic with explicit bonuses/penalties for format validation, pattern matching, etc., as outlined in `SCORING_ALGORITHM_IMPROVEMENTS.md`.
