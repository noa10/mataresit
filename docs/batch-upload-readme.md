# Batch Upload Functionality

## Overview

The batch upload functionality allows users to upload and process multiple receipt files at once. This feature is designed to improve efficiency when dealing with large numbers of receipts.

## Features

- **Multiple File Selection**: Upload multiple receipt files (JPG, PNG, PDF) at once
- **Queue Management**: Add, remove, and manage files in the upload queue
- **Parallel Processing**: Process multiple receipts simultaneously
- **Real-time Progress Tracking**: Track the progress of each file in the queue
- **Pause and Resume**: Pause and resume batch processing
- **Error Handling**: Retry failed uploads and cancel pending uploads

## How to Use

### Accessing Batch Upload

1. Navigate to the Dashboard
2. Click the "Batch Upload" button in the top-right corner
3. The batch upload modal will open

### Adding Files

1. Click the "Select Files" button or drag and drop files into the upload zone
2. Files will be added to the queue
3. You can add more files by clicking the "Add More Files" button

### Processing Files

1. Click the "Start Processing" button to begin processing the queue
2. The progress of each file will be displayed
3. You can pause processing by clicking the "Pause" button
4. You can resume processing by clicking the "Resume" button

### Managing the Queue

1. Remove a pending file by clicking the remove button (trash icon)
2. Cancel an active upload by clicking the cancel button (X icon)
3. Retry a failed upload by clicking the retry button (rotate icon)
4. Clear all pending files by clicking the "Clear Queue" button
5. Clear all files by clicking the "Clear All" button

### Viewing Processed Receipts

1. Once a file is processed, a view button (external link icon) will appear
2. Click the view button to navigate to the receipt view

## Technical Details

### Implementation

The batch upload functionality is implemented using the following components:

- **useBatchFileUpload Hook**: Manages the state and logic for batch file uploads
- **BatchUploadZone Component**: Provides the user interface for batch uploads
- **UploadQueueItem Component**: Displays individual files in the queue
- **BatchProcessingControls Component**: Provides controls for managing the batch process
- **BatchUploadModal Component**: Displays the batch upload interface in a modal

### Concurrency

By default, the batch upload functionality processes up to 3 files concurrently. This limit helps to:

1. Prevent overwhelming the server
2. Ensure stable and reliable processing
3. Provide a better user experience

### Error Handling

The batch upload functionality includes robust error handling:

1. **Failed Uploads**: Files that fail to upload or process are marked as failed
2. **Retry Mechanism**: Failed uploads can be retried
3. **Cancel Option**: Active uploads can be cancelled
4. **Error Messages**: Clear error messages are provided for each failure

## Best Practices

1. **File Types**: Upload only supported file types (JPG, PNG, PDF)
2. **File Size**: Keep file sizes reasonable (under 10MB per file)
3. **Batch Size**: For optimal performance, process batches of 10-20 files at a time
4. **Network Connection**: Ensure a stable internet connection for reliable uploads

## Troubleshooting

### Common Issues

1. **Upload Fails**: Check your internet connection and try again
2. **Processing Fails**: The receipt image may be unclear or in an unsupported format
3. **Slow Processing**: Large batches or complex receipts may take longer to process

### Solutions

1. **Retry Failed Uploads**: Click the retry button on failed uploads
2. **Reduce Concurrency**: Process fewer files at once if experiencing issues
3. **Check File Quality**: Ensure receipt images are clear and readable
