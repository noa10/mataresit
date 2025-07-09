# Automated Receipt Processing Application - Detailed Documentation

A web-based application for automating receipt data extraction using OCR technology with Amazon Textract.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Component Structure](#component-structure)
6. [External Integrations](#external-integrations)
7. [Development Guide](#development-guide)
8. [Confidence Scoring](#confidence-scoring)
9. [Data Normalization & Validation](#data-normalization--validation)
10. [Troubleshooting](#troubleshooting)
11. [Future Enhancements](#future-enhancements)

## Overview

The Automated Receipt Processing Application streamlines the digitization and management of paper receipts through a complete workflow:

1.  **Upload** - Users upload receipt images (JPEG, PNG, PDF). The UI provides real-time feedback on upload progress and backend processing stages. **Supports single and batch uploads.**
2.  **Process** - Amazon Textract performs OCR, extracting text and structured data.
3.  **Enhance** - AI models (currently Google Gemini) enhance the data, validate formats, normalize fields (merchant, payment method), suggest corrections, predict categories, and calculate confidence scores.
4.  **Verify** - A side-by-side interface allows users to review OCR data alongside the receipt image, accept AI suggestions, and make corrections. Confidence indicators highlight potentially inaccurate fields.
5.  **Feedback & Store** - User corrections are logged to a `corrections` table, creating a feedback loop for future AI improvements. Final data is stored in the Supabase database.
6.  **Sync** - Verified expenses can be optionally synced to an external service.

### Key Features

-   **OCR Data Extraction**: Utilizes Amazon Textract for robust text and data extraction.
-   **AI-Powered Data Enhancement (Gemini)**:
    -   **Normalization**: Standardizes merchant names and payment methods.
    -   **Validation**: Checks date formats and flags inconsistencies.
    -   **Categorization**: Predicts expense categories (e.g., Groceries, Dining, Travel).
    -   **Suggestions**: Provides field-level correction suggestions for potential OCR errors.
    -   **Currency Identification**: Detects currency (with basic USD->MYR conversion).
-   **Confidence Scoring**:
    -   Multi-stage scoring (OCR -> AI -> User Verification).
    -   Scores assigned to key fields (merchant, date, total, etc.).
    -   UI indicators (color-coded) highlight low-confidence fields.
    -   User edits automatically set score to 100%.
-   **User Feedback Loop**: Logs user corrections vs. original/AI values to the `corrections` table, enabling future model tuning.
-   **Interactive Review UI**:
    -   Side-by-side image viewer and data editor.
    -   Image manipulation (zoom, rotate).
    -   "Accept Suggestion" buttons for quick AI correction application.
-   **Real-time Processing Feedback**:
    -   Detailed upload status tracking (`ReceiptUpload` state).
    -   Live updates on backend processing stages (OCR, AI Enhancement, Thumbnail Generation) via Supabase Realtime.
    -   Displays final processing time.
    -   **Detailed processing logs are recorded and viewable.**
-   **Secure Authentication**: Managed by Supabase Auth.
-   **Multi-currency Support**: Handles different currencies, primarily MYR and USD.
-   **Batch Uploading**: Allows uploading and processing multiple receipts concurrently with control over concurrency and auto-start. Includes a review step for batch results.
-   **Thumbnail Generation**: Creates smaller thumbnail images for faster loading in lists and previews.
-   **Theme Toggle**: Allows switching between light and dark modes with persistent preferences stored in localStorage.
-   **User Menu**: Enhanced navigation with a dropdown user menu showing profile information and quick access to key functions.
-   **Responsive Design**: Modern navigation that works well on both desktop and mobile devices.
-   **Daily PDF Report Generation**: Allows generating PDF reports for a selected day's expenses, summarized by payer or category.
-   **Role-Based Access Control (RBAC)**: Basic admin role implemented, allowing for future admin-specific features (e.g., Admin Panel link in user menu).

> **Note**: This is a detailed technical documentation. For a quick overview, see the main [README.md](../README.md) in the project root.

For complete documentation including architecture diagrams, database schema, API endpoints, and more, please refer to the individual documentation files in this directory and its subdirectories.

## Quick Links

- [Development Guide](./development/LOCAL_DEVELOPMENT_GUIDE.md)
- [Project Guidelines](./development/MATARESIT_PROJECT_GUIDELINES.md)
- [API Documentation](./api/)
- [Architecture Overview](./architecture/)
- [Troubleshooting Guide](./troubleshooting/)
