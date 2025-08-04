# Batch Processing - User Guide

## 📋 Overview

Mataresit's batch processing feature allows you to upload and process multiple receipts simultaneously, dramatically improving efficiency for users with large volumes of receipts. The system intelligently manages concurrent processing, rate limiting, and progress tracking to ensure optimal performance.

**Key Benefits:**
- Process up to 50 receipts simultaneously
- Intelligent queue management with rate limiting
- Real-time progress tracking and ETA calculations
- Automatic retry for failed uploads
- Session-based processing with pause/resume capabilities

## 🎯 Prerequisites

**Account Requirements:**
- Free tier: Up to 5 concurrent uploads
- Pro tier: Up to 20 concurrent uploads  
- Max tier: Up to 50 concurrent uploads

**File Requirements:**
- **Supported formats:** JPEG, PNG, PDF, HEIC, WebP
- **File size:** Up to 10MB per file
- **Batch size:** Up to 100 files per batch session
- **Total size:** Up to 500MB per batch session

## 🚀 Getting Started

### Step 1: Access Batch Upload
Navigate to the batch upload interface from your dashboard.

![Batch Upload Access](../../assets/screenshots/core-features/batch-processing/01_batch-upload-access_desktop_en.png)

**How to Access:**
1. Go to your main dashboard
2. Click "Batch Upload" button or drag multiple files to the upload zone
3. The interface automatically switches to batch mode when multiple files are detected

### Step 2: Select Multiple Files
Choose all the receipts you want to process in one batch.

![File Selection](../../assets/screenshots/core-features/batch-processing/02_file-selection_desktop_en.png)

**Selection Methods:**
- **Drag & Drop Multiple Files** - Select and drag multiple files from your file explorer
- **Browse and Multi-Select** - Click "Browse Files" and use Ctrl/Cmd+Click to select multiple files
- **Folder Upload** - Drag an entire folder containing receipt images
- **Add to Existing Batch** - Add more files to an existing batch queue

**File Validation:**
- Green checkmarks indicate valid files
- Yellow warnings show potential issues (large file size, unusual format)
- Red errors indicate invalid files that will be excluded

### Step 3: Review Batch Queue
Examine your batch queue before starting processing.

![Batch Queue Review](../../assets/screenshots/core-features/batch-processing/03_batch-queue-review_desktop_en.png)

**Queue Information:**
- **Total Files** - Number of files in the batch
- **Total Size** - Combined size of all files
- **Estimated Processing Time** - Based on current system load
- **Processing Strategy** - Concurrent vs sequential processing options

**Queue Management:**
- **Remove Files** - Click the X button to remove individual files
- **Reorder Files** - Drag files to change processing order
- **Add More Files** - Continue adding files to the existing queue
- **Clear Queue** - Remove all files and start over

### Step 4: Configure Processing Settings
Optimize processing settings for your batch.

![Processing Settings](../../assets/screenshots/core-features/batch-processing/04_processing-settings_desktop_en.png)

**Processing Options:**
- **Concurrent Processing** - Process multiple files simultaneously (recommended)
- **Sequential Processing** - Process files one at a time (for slower connections)
- **Max Concurrent** - Number of simultaneous uploads (based on subscription tier)
- **AI Processing Mode** - AI Vision (recommended) or OCR+AI

**Advanced Settings:**
- **Auto-Retry Failed Uploads** - Automatically retry failed processing
- **Pause on Errors** - Stop batch processing if errors occur
- **Priority Processing** - Process important receipts first
- **Notification Preferences** - How to be notified of completion

### Step 5: Start Batch Processing
Begin processing your batch of receipts.

![Start Processing](../../assets/screenshots/core-features/batch-processing/05_start-processing_desktop_en.png)

**Processing Initiation:**
1. Review your batch queue and settings
2. Click "Start Batch Processing" button
3. Processing begins immediately with real-time progress updates
4. You can continue using Mataresit while processing runs in the background

**What Happens:**
- Files are uploaded to secure cloud storage
- AI vision analysis begins for each receipt
- Progress updates appear in real-time
- Completed receipts become available immediately

## 📊 Monitoring Progress

### Real-Time Progress Tracking
Monitor your batch processing with detailed progress information.

![Progress Tracking](../../assets/screenshots/core-features/batch-processing/06_progress-tracking_desktop_en.png)

**Progress Indicators:**
- **Overall Progress Bar** - Total batch completion percentage
- **Individual File Status** - Status of each file in the batch
- **Processing Speed** - Files processed per minute
- **ETA Calculation** - Estimated time to completion
- **Success/Failure Counts** - Running totals of processed files

**Status Types:**
- **⏳ Queued** - Waiting to be processed
- **🔄 Uploading** - File upload in progress
- **🤖 Processing** - AI analysis in progress
- **✅ Complete** - Successfully processed
- **❌ Failed** - Processing failed (with retry option)
- **⏸️ Paused** - Processing temporarily paused

### Batch Session Management
Control your batch processing session with advanced management options.

![Session Management](../../assets/screenshots/core-features/batch-processing/07_session-management_desktop_en.png)

**Session Controls:**
- **Pause Processing** - Temporarily stop processing (resume anytime)
- **Cancel Batch** - Stop processing and remove remaining files
- **Add More Files** - Add additional files to the current session
- **Priority Adjustment** - Move important files to the front of the queue

**Session Information:**
- **Session ID** - Unique identifier for tracking
- **Start Time** - When processing began
- **Elapsed Time** - Total processing duration
- **Files Remaining** - Number of files still to process
- **Rate Limiting Status** - Current rate limiting information

## ⚙️ Advanced Configuration

### Processing Strategy Options
Choose the optimal processing strategy for your needs.

**Concurrent Processing (Recommended):**
- Processes multiple files simultaneously
- Faster overall completion time
- Uses more system resources
- Best for stable internet connections

**Sequential Processing:**
- Processes files one at a time
- Slower but more reliable
- Uses fewer system resources
- Best for slower or unstable connections

**Hybrid Processing:**
- Combines concurrent and sequential approaches
- Adapts based on system performance
- Automatically adjusts concurrent limits
- Optimal for varying network conditions

### Rate Limiting and Performance
Understand how rate limiting affects your batch processing.

![Rate Limiting](../../assets/screenshots/core-features/batch-processing/08_rate-limiting_desktop_en.png)

**Rate Limiting Factors:**
- **Subscription Tier** - Higher tiers allow more concurrent processing
- **System Load** - Processing speed adjusts based on overall system usage
- **File Complexity** - Complex receipts may take longer to process
- **Network Speed** - Upload speed affects overall processing time

**Performance Optimization:**
- **Optimal File Sizes** - Files under 5MB process faster
- **Image Quality** - Clear, well-lit images process more accurately
- **Batch Size** - Smaller batches (10-20 files) often process more efficiently
- **Processing Time** - Off-peak hours may offer faster processing

### Error Handling and Recovery
Manage errors and failed uploads effectively.

![Error Handling](../../assets/screenshots/core-features/batch-processing/09_error-handling_desktop_en.png)

**Common Error Types:**
- **Upload Failures** - Network issues or file corruption
- **Processing Errors** - AI analysis failures or unsupported formats
- **Rate Limit Exceeded** - Too many concurrent requests
- **Storage Errors** - Insufficient storage space or permissions

**Recovery Options:**
- **Automatic Retry** - System automatically retries failed uploads
- **Manual Retry** - Click retry button for individual failed files
- **Skip and Continue** - Skip failed files and continue with the batch
- **Download Error Report** - Get detailed information about failures

## 💡 Best Practices

### Preparation Tips
Optimize your receipts before batch processing.

**File Organization:**
- **Group Similar Receipts** - Process receipts from the same time period together
- **Check File Quality** - Ensure images are clear and well-lit
- **Remove Duplicates** - Avoid processing the same receipt multiple times
- **Organize by Priority** - Process important receipts first

**File Optimization:**
- **Resize Large Images** - Compress images over 5MB for faster processing
- **Crop Unnecessary Areas** - Remove backgrounds and focus on receipt content
- **Ensure Proper Orientation** - Rotate images so text is readable
- **Use Supported Formats** - Convert unsupported formats before upload

### Processing Efficiency
Maximize your batch processing efficiency.

**Timing Strategies:**
- **Off-Peak Processing** - Process during off-peak hours for faster speeds
- **Smaller Batches** - Break large batches into smaller groups
- **Regular Processing** - Process receipts regularly rather than accumulating large batches
- **Priority Processing** - Process urgent receipts in separate, smaller batches

**System Optimization:**
- **Stable Internet** - Use reliable internet connection for batch processing
- **Close Other Applications** - Free up system resources during processing
- **Monitor Progress** - Keep the browser tab active for optimal performance
- **Regular Breaks** - Allow system to cool down between large batches

## 🚨 Troubleshooting

### Common Issues

**Batch Processing Stuck:**
- **Symptoms:** Progress bar not moving, files stuck in "Processing" status
- **Cause:** Network connectivity issues or system overload
- **Solution:** Pause and resume processing, check internet connection
- **Prevention:** Use smaller batch sizes, process during off-peak hours

**High Failure Rate:**
- **Symptoms:** Many files failing to process successfully
- **Cause:** Poor image quality, unsupported formats, or system issues
- **Solution:** Review failed files, improve image quality, retry processing
- **Prevention:** Pre-validate files, use supported formats, optimize images

**Slow Processing Speed:**
- **Symptoms:** Processing taking much longer than estimated
- **Cause:** Large file sizes, complex receipts, or high system load
- **Solution:** Reduce concurrent processing, optimize file sizes
- **Prevention:** Process smaller batches, use optimal file sizes

### Error Messages

**"Rate Limit Exceeded":**
- **Meaning:** Too many concurrent requests for your subscription tier
- **Solution:** Reduce concurrent processing limit or upgrade subscription
- **When to Contact Support:** If error persists with appropriate limits

**"Processing Failed - Retry Available":**
- **Meaning:** AI processing failed but can be retried
- **Solution:** Click retry button or check file quality
- **When to Contact Support:** If retry fails multiple times

**"Invalid File Format":**
- **Meaning:** File format not supported by the system
- **Solution:** Convert to supported format (JPEG, PNG, PDF)
- **When to Contact Support:** If supported format is rejected

## 🔗 Related Features

### Complementary Features
- **[AI Vision Processing](ai-vision-processing.md)** - Understand how AI analyzes your receipts
- **[Semantic Search](semantic-search.md)** - Find processed receipts using natural language
- **[Receipt Verification](receipt-verification.md)** - Review and correct AI-extracted data
- **[Export Options](../export-reporting/export-options.md)** - Export your processed receipts

### Next Steps
Suggested features to explore after mastering batch processing:
1. [Advanced Analytics](../export-reporting/advanced-analytics.md) - Analyze your processed receipts
2. [Team Collaboration](../team-collaboration/team-setup.md) - Share batch processing with team members
3. [API Integration](../advanced-features/api-documentation.md) - Automate batch processing via API

## ❓ Frequently Asked Questions

**Q: How many files can I process in one batch?**
A: Up to 100 files per batch session, with total size limit of 500MB. Subscription tier affects concurrent processing limits.

**Q: Can I add more files to a batch that's already processing?**
A: Yes, you can add files to an active batch session. New files will be queued and processed after current files complete.

**Q: What happens if I close my browser during batch processing?**
A: Processing continues on our servers. When you return, you'll see updated progress and can resume monitoring.

**Q: Can I process different types of receipts in the same batch?**
A: Yes, you can mix different receipt types, formats, and sizes in a single batch. The AI will handle each appropriately.

## 📞 Need Help?

### Self-Service Resources
- **[Help Center](/help)** - Browse all documentation
- **[Video Tutorials](/help/videos)** - Visual batch processing guides
- **[Community Forum](/help/community)** - User discussions and tips

### Contact Support
- **Email Support:** support@mataresit.com
- **Live Chat:** Available in-app during business hours
- **Priority Support:** Available for Pro and Max tier users
- **Batch Processing Assistance:** Specialized support for large volume users

### Feedback
Help us improve batch processing:
- **[Feature Requests](/help/feedback)** - Suggest batch processing improvements
- **[Bug Reports](/help/bugs)** - Report batch processing issues
- **[Performance Feedback](/help/performance)** - Share processing speed experiences

---

**Last Updated:** January 2025  
**Version:** 1.0  
**Applies to:** All subscription tiers (with tier-specific limits)
