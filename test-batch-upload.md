# Batch Upload Testing Guide

## Overview

This document provides a step-by-step guide for testing the batch upload functionality in the application.

## Prerequisites

- Multiple receipt images or PDFs for testing (at least 5-10 files)
- A user account in the application

## Test Cases

### 1. Basic Batch Upload Flow

1. **Open the Dashboard**
   - Navigate to the dashboard page
   - Verify that the "Batch Upload" button is visible

2. **Open Batch Upload Modal**
   - Click on the "Batch Upload" button
   - Verify that the batch upload modal opens
   - Verify that the drag-and-drop area is visible

3. **Add Files to Queue**
   - Click the "Select Files" button
   - Select multiple receipt files (mix of JPG, PNG, and PDF)
   - Verify that all files appear in the queue
   - Verify that each file shows its name, size, and status

4. **Start Processing**
   - Click the "Start Processing" button
   - Verify that processing starts
   - Verify that the progress bar updates
   - Verify that each file's status updates as it progresses

5. **Completion**
   - Wait for all files to complete processing
   - Verify that the status shows as complete
   - Verify that each file shows a "View" button
   - Click on a "View" button to verify it navigates to the receipt view

### 2. Queue Management

1. **Add Files**
   - Add multiple files to the queue
   - Verify that all files are listed

2. **Remove Files**
   - Click the remove button on a pending file
   - Verify that the file is removed from the queue

3. **Clear Queue**
   - Add multiple files to the queue
   - Click the "Clear Queue" button
   - Verify that all pending files are removed
   - Verify that active, completed, and failed files remain

4. **Clear All**
   - Add multiple files to the queue
   - Process some files
   - Click the "Clear All" button
   - Verify that all files are removed

### 3. Pause and Resume

1. **Pause Processing**
   - Add multiple files to the queue
   - Start processing
   - Click the "Pause" button
   - Verify that processing pauses (active uploads complete, but no new ones start)

2. **Resume Processing**
   - With processing paused
   - Click the "Resume" button
   - Verify that processing resumes

### 4. Error Handling

1. **Cancel Upload**
   - Add files to the queue
   - Start processing
   - Click the cancel button on an active upload
   - Verify that the upload is cancelled and marked as failed

2. **Retry Failed Upload**
   - Have a failed upload in the queue
   - Click the retry button
   - Verify that the upload is retried

### 5. Edge Cases

1. **Empty Queue**
   - Open the batch upload modal
   - Verify that the "Start Processing" button is disabled when the queue is empty

2. **Invalid Files**
   - Try to add invalid file types (e.g., .txt, .doc)
   - Verify that an error message is shown
   - Verify that invalid files are not added to the queue

3. **Large Batch**
   - Add a large number of files (10+)
   - Verify that all files are processed correctly
   - Verify that the UI remains responsive

## Expected Results

- All files should be uploaded and processed successfully
- The UI should provide clear feedback on the status of each file
- Users should be able to manage the queue (add, remove, clear)
- Users should be able to pause and resume processing
- Error handling should work correctly
- The application should handle edge cases gracefully

## Notes

- If any issues are found, document them with:
  - Steps to reproduce
  - Expected behavior
  - Actual behavior
  - Screenshots if applicable
