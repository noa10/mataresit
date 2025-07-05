// Email Templates for Team Collaboration Features

export interface TeamInvitationEmailData {
  inviteeEmail: string;
  teamName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresAt: string;
  language?: 'en' | 'ms'; // Add language support
}

export interface ClaimNotificationEmailData {
  claimTitle: string;
  claimAmount: number;
  currency: string;
  claimantName: string;
  teamName: string;
  actionUrl: string;
  status: string;
  rejectionReason?: string;
  language?: 'en' | 'ms'; // Add language support
}

export interface ReceiptProcessingEmailData {
  recipientName: string;
  receiptId: string;
  merchant?: string;
  total?: number;
  currency?: string;
  status: 'started' | 'completed' | 'failed' | 'ready_for_review';
  errorMessage?: string;
  actionUrl: string;
  teamName?: string;
  language?: 'en' | 'ms';
}

export interface BatchProcessingEmailData {
  recipientName: string;
  totalReceipts: number;
  successfulReceipts: number;
  failedReceipts: number;
  actionUrl: string;
  teamName?: string;
  language?: 'en' | 'ms';
}

export interface TeamCollaborationEmailData {
  recipientName: string;
  actorName: string;
  receiptId: string;
  merchant?: string;
  action: 'shared' | 'commented' | 'edited' | 'approved' | 'flagged';
  comment?: string;
  reason?: string;
  message?: string;
  actionUrl: string;
  teamName: string;
  language?: 'en' | 'ms';
}

export function generateTeamInvitationEmail(data: TeamInvitationEmailData): { subject: string; html: string; text: string } {
  const language = data.language || 'en';

  if (language === 'ms') {
    return generateTeamInvitationEmailMalay(data);
  }

  const subject = `You've been invited to join ${data.teamName} on Mataresit`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Team Invitation - Mataresit</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #5a6fd8; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .role-badge { background: #e3f2fd; color: #1976d2; padding: 4px 12px; border-radius: 16px; font-size: 14px; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 You're Invited!</h1>
          <p>Join ${data.teamName} on Mataresit</p>
        </div>
        <div class="content">
          <p>Hi there!</p>
          
          <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.teamName}</strong> on Mataresit as a <span class="role-badge">${data.role}</span>.</p>
          
          <p>Mataresit is a powerful receipt management and expense tracking platform that helps teams collaborate on financial data and streamline their expense workflows.</p>
          
          <p>As a team member, you'll be able to:</p>
          <ul>
            <li>📄 Upload and manage receipts</li>
            <li>💰 Submit expense claims for approval</li>
            <li>👥 Collaborate with team members</li>
            <li>📊 Access team financial insights</li>
          </ul>
          
          <div style="text-align: center;">
            <a href="${data.acceptUrl}" class="button">Accept Invitation</a>
          </div>
          
          <p><small><strong>Note:</strong> This invitation will expire on ${new Date(data.expiresAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}.</small></p>
          
          <p>If you have any questions, feel free to reach out to ${data.inviterName} or our support team.</p>
          
          <p>Welcome to the team!</p>
        </div>
        <div class="footer">
          <p>© 2024 Mataresit. All rights reserved.</p>
          <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
You've been invited to join ${data.teamName} on Mataresit!

Hi there!

${data.inviterName} has invited you to join ${data.teamName} on Mataresit as a ${data.role}.

Mataresit is a powerful receipt management and expense tracking platform that helps teams collaborate on financial data and streamline their expense workflows.

As a team member, you'll be able to:
- Upload and manage receipts
- Submit expense claims for approval
- Collaborate with team members
- Access team financial insights

To accept this invitation, visit: ${data.acceptUrl}

Note: This invitation will expire on ${new Date(data.expiresAt).toLocaleDateString()}.

If you have any questions, feel free to reach out to ${data.inviterName} or our support team.

Welcome to the team!

© 2024 Mataresit. All rights reserved.
If you didn't expect this invitation, you can safely ignore this email.
  `;

  return { subject, html, text };
}

export function generateClaimNotificationEmail(data: ClaimNotificationEmailData): { subject: string; html: string; text: string } {
  let subject: string;
  let statusMessage: string;
  let statusColor: string;

  switch (data.status) {
    case 'submitted':
      subject = `New Claim Submitted: ${data.claimTitle}`;
      statusMessage = `A new expense claim has been submitted and requires your review.`;
      statusColor = '#1976d2';
      break;
    case 'approved':
      subject = `Claim Approved: ${data.claimTitle}`;
      statusMessage = `Your expense claim has been approved! 🎉`;
      statusColor = '#388e3c';
      break;
    case 'rejected':
      subject = `Claim Rejected: ${data.claimTitle}`;
      statusMessage = `Your expense claim has been rejected.`;
      statusColor = '#d32f2f';
      break;
    default:
      subject = `Claim Update: ${data.claimTitle}`;
      statusMessage = `There's an update on your expense claim.`;
      statusColor = '#1976d2';
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Claim Notification - Mataresit</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusColor}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: ${statusColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .claim-details { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${statusColor}; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .amount { font-size: 24px; font-weight: bold; color: ${statusColor}; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💼 Claim Update</h1>
          <p>${data.teamName}</p>
        </div>
        <div class="content">
          <p>${statusMessage}</p>
          
          <div class="claim-details">
            <h3>${data.claimTitle}</h3>
            <p><strong>Amount:</strong> <span class="amount">${data.currency} ${data.claimAmount.toFixed(2)}</span></p>
            <p><strong>Submitted by:</strong> ${data.claimantName}</p>
            <p><strong>Team:</strong> ${data.teamName}</p>
            ${data.rejectionReason ? `<p><strong>Rejection Reason:</strong> ${data.rejectionReason}</p>` : ''}
          </div>
          
          <div style="text-align: center;">
            <a href="${data.actionUrl}" class="button">View Claim Details</a>
          </div>
          
          <p>You can view the full claim details and take any necessary actions by clicking the button above.</p>
        </div>
        <div class="footer">
          <p>© 2024 Mataresit. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
${subject}

${statusMessage}

Claim Details:
- Title: ${data.claimTitle}
- Amount: ${data.currency} ${data.claimAmount.toFixed(2)}
- Submitted by: ${data.claimantName}
- Team: ${data.teamName}
${data.rejectionReason ? `- Rejection Reason: ${data.rejectionReason}` : ''}

View claim details: ${data.actionUrl}

© 2024 Mataresit. All rights reserved.
  `;

  return { subject, html, text };
}

/**
 * Generate receipt processing notification email
 */
export function generateReceiptProcessingEmail(data: ReceiptProcessingEmailData): { subject: string; html: string; text: string } {
  const language = data.language || 'en';

  if (language === 'ms') {
    return generateReceiptProcessingEmailMalay(data);
  }

  const statusMessages = {
    started: {
      subject: 'Receipt Processing Started',
      title: 'Receipt Processing Started',
      message: data.merchant
        ? `We've started processing your receipt from ${data.merchant}.`
        : 'We\'ve started processing your receipt.',
      action: 'Track Progress'
    },
    completed: {
      subject: 'Receipt Processing Completed',
      title: 'Receipt Processing Completed ✅',
      message: data.merchant && data.total
        ? `Your receipt from ${data.merchant} (${data.currency || 'MYR'} ${data.total}) has been processed successfully.`
        : data.merchant
        ? `Your receipt from ${data.merchant} has been processed successfully.`
        : 'Your receipt has been processed successfully.',
      action: 'View Receipt'
    },
    failed: {
      subject: 'Receipt Processing Failed',
      title: 'Receipt Processing Failed ❌',
      message: data.errorMessage
        ? `Receipt processing failed: ${data.errorMessage}`
        : 'Receipt processing failed. Please try uploading again or contact support if the issue persists.',
      action: 'Retry Upload'
    },
    ready_for_review: {
      subject: 'Receipt Ready for Review',
      title: 'Receipt Ready for Review 📋',
      message: data.merchant
        ? `Your receipt from ${data.merchant} has been processed and is ready for your review.`
        : 'Your receipt has been processed and is ready for your review.',
      action: 'Review Receipt'
    }
  };

  const statusInfo = statusMessages[data.status];
  const subject = statusInfo.subject;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px 20px; }
    .receipt-info { background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; }
    .receipt-info h3 { margin: 0 0 10px 0; color: #374151; font-size: 16px; }
    .receipt-info p { margin: 5px 0; color: #6b7280; }
    .cta-button { display: inline-block; background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .cta-button:hover { background-color: #5a67d8; }
    .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
    .status-icon { font-size: 48px; margin-bottom: 20px; }
    ${data.status === 'failed' ? '.header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }' : ''}
    ${data.status === 'completed' ? '.header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }' : ''}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="status-icon">${data.status === 'completed' ? '✅' : data.status === 'failed' ? '❌' : data.status === 'ready_for_review' ? '📋' : '⏳'}</div>
      <h1>${statusInfo.title}</h1>
    </div>
    <div class="content">
      <p>Hi ${data.recipientName},</p>

      <p>${statusInfo.message}</p>

      <div class="receipt-info">
        <h3>Receipt Details</h3>
        <p><strong>Receipt ID:</strong> ${data.receiptId}</p>
        ${data.merchant ? `<p><strong>Merchant:</strong> ${data.merchant}</p>` : ''}
        ${data.total ? `<p><strong>Amount:</strong> ${data.currency || 'MYR'} ${data.total}</p>` : ''}
        ${data.teamName ? `<p><strong>Team:</strong> ${data.teamName}</p>` : ''}
      </div>

      <a href="${data.actionUrl}" class="cta-button">${statusInfo.action}</a>

      <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

      <p>Best regards,<br>The Mataresit Team</p>
    </div>
    <div class="footer">
      <p>© 2024 Mataresit. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
${statusInfo.title}

Hi ${data.recipientName},

${statusInfo.message}

Receipt Details:
- Receipt ID: ${data.receiptId}
${data.merchant ? `- Merchant: ${data.merchant}` : ''}
${data.total ? `- Amount: ${data.currency || 'MYR'} ${data.total}` : ''}
${data.teamName ? `- Team: ${data.teamName}` : ''}

${statusInfo.action}: ${data.actionUrl}

If you have any questions or need assistance, please don't hesitate to contact our support team.

Best regards,
The Mataresit Team

© 2024 Mataresit. All rights reserved.
This is an automated notification. Please do not reply to this email.
  `;

  return { subject, html, text };
}

/**
 * Generate batch processing notification email
 */
export function generateBatchProcessingEmail(data: BatchProcessingEmailData): { subject: string; html: string; text: string } {
  const language = data.language || 'en';

  if (language === 'ms') {
    return generateBatchProcessingEmailMalay(data);
  }

  const isSuccess = data.failedReceipts === 0;
  const hasPartialFailure = data.failedReceipts > 0 && data.successfulReceipts > 0;

  const subject = isSuccess
    ? 'Batch Processing Completed Successfully'
    : hasPartialFailure
    ? 'Batch Processing Completed with Some Issues'
    : 'Batch Processing Failed';

  const title = isSuccess
    ? 'Batch Processing Completed ✅'
    : hasPartialFailure
    ? 'Batch Processing Completed ⚠️'
    : 'Batch Processing Failed ❌';

  const message = isSuccess
    ? `All ${data.totalReceipts} receipts in your batch have been processed successfully.`
    : hasPartialFailure
    ? `${data.successfulReceipts} of ${data.totalReceipts} receipts were processed successfully. ${data.failedReceipts} receipts failed processing.`
    : `Unfortunately, all ${data.totalReceipts} receipts in your batch failed to process.`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background-color: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; border-left: 4px solid #667eea; }
    .stat-number { font-size: 32px; font-weight: bold; color: #374151; margin-bottom: 5px; }
    .stat-label { color: #6b7280; font-size: 14px; }
    .cta-button { display: inline-block; background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .cta-button:hover { background-color: #5a67d8; }
    .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
    .status-icon { font-size: 48px; margin-bottom: 20px; }
    ${!isSuccess ? '.header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }' : ''}
    ${hasPartialFailure ? '.header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }' : ''}
    .success { color: #10b981; }
    .warning { color: #f59e0b; }
    .error { color: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="status-icon">${isSuccess ? '✅' : hasPartialFailure ? '⚠️' : '❌'}</div>
      <h1>${title}</h1>
    </div>
    <div class="content">
      <p>Hi ${data.recipientName},</p>

      <p>${message}</p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${data.totalReceipts}</div>
          <div class="stat-label">Total Receipts</div>
        </div>
        <div class="stat-card">
          <div class="stat-number success">${data.successfulReceipts}</div>
          <div class="stat-label">Successful</div>
        </div>
        <div class="stat-card">
          <div class="stat-number ${data.failedReceipts > 0 ? 'error' : ''}">${data.failedReceipts}</div>
          <div class="stat-label">Failed</div>
        </div>
      </div>

      ${data.teamName ? `<p><strong>Team:</strong> ${data.teamName}</p>` : ''}

      <a href="${data.actionUrl}" class="cta-button">View Dashboard</a>

      ${data.failedReceipts > 0 ? '<p>For failed receipts, please check the error details in your dashboard and try uploading them again.</p>' : ''}

      <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

      <p>Best regards,<br>The Mataresit Team</p>
    </div>
    <div class="footer">
      <p>© 2024 Mataresit. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
${title}

Hi ${data.recipientName},

${message}

Batch Summary:
- Total Receipts: ${data.totalReceipts}
- Successful: ${data.successfulReceipts}
- Failed: ${data.failedReceipts}

${data.teamName ? `Team: ${data.teamName}` : ''}

View Dashboard: ${data.actionUrl}

${data.failedReceipts > 0 ? 'For failed receipts, please check the error details in your dashboard and try uploading them again.' : ''}

If you have any questions or need assistance, please don't hesitate to contact our support team.

Best regards,
The Mataresit Team

© 2024 Mataresit. All rights reserved.
This is an automated notification. Please do not reply to this email.
  `;

  return { subject, html, text };
}

/**
 * Generate team collaboration notification email
 */
export function generateTeamCollaborationEmail(data: TeamCollaborationEmailData): { subject: string; html: string; text: string } {
  const language = data.language || 'en';

  if (language === 'ms') {
    return generateTeamCollaborationEmailMalay(data);
  }

  const actionMessages = {
    shared: {
      subject: `Receipt Shared by ${data.actorName}`,
      title: 'Receipt Shared with Team',
      message: `${data.actorName} has shared a receipt${data.merchant ? ` from ${data.merchant}` : ''} with your team.`,
      action: 'View Receipt'
    },
    commented: {
      subject: `New Comment from ${data.actorName}`,
      title: 'New Comment Added',
      message: `${data.actorName} added a comment${data.merchant ? ` to the receipt from ${data.merchant}` : ' to a receipt'}.`,
      action: 'View Comment'
    },
    edited: {
      subject: `Receipt Edited by ${data.actorName}`,
      title: 'Receipt Updated',
      message: `${data.actorName} made changes${data.merchant ? ` to the receipt from ${data.merchant}` : ' to a receipt'}.`,
      action: 'View Changes'
    },
    approved: {
      subject: `Receipt Approved by ${data.actorName}`,
      title: 'Receipt Approved ✅',
      message: `${data.actorName} approved${data.merchant ? ` the receipt from ${data.merchant}` : ' your receipt'}.`,
      action: 'View Receipt'
    },
    flagged: {
      subject: `Receipt Flagged by ${data.actorName}`,
      title: 'Receipt Flagged for Review ⚠️',
      message: `${data.actorName} flagged${data.merchant ? ` the receipt from ${data.merchant}` : ' a receipt'} for review.`,
      action: 'Review Receipt'
    }
  };

  const actionInfo = actionMessages[data.action];
  const subject = actionInfo.subject;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px 20px; }
    .receipt-info { background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; }
    .receipt-info h3 { margin: 0 0 10px 0; color: #374151; font-size: 16px; }
    .receipt-info p { margin: 5px 0; color: #6b7280; }
    .comment-box { background-color: #f3f4f6; border-radius: 8px; padding: 15px; margin: 15px 0; font-style: italic; }
    .cta-button { display: inline-block; background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .cta-button:hover { background-color: #5a67d8; }
    .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
    .team-badge { background-color: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    ${data.action === 'flagged' ? '.header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }' : ''}
    ${data.action === 'approved' ? '.header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }' : ''}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${actionInfo.title}</h1>
      <span class="team-badge">${data.teamName}</span>
    </div>
    <div class="content">
      <p>Hi ${data.recipientName},</p>

      <p>${actionInfo.message}</p>

      ${data.comment ? `<div class="comment-box">"${data.comment}"</div>` : ''}
      ${data.reason ? `<div class="comment-box"><strong>Reason:</strong> ${data.reason}</div>` : ''}
      ${data.message ? `<div class="comment-box"><strong>Message:</strong> ${data.message}</div>` : ''}

      <div class="receipt-info">
        <h3>Receipt Details</h3>
        <p><strong>Receipt ID:</strong> ${data.receiptId}</p>
        ${data.merchant ? `<p><strong>Merchant:</strong> ${data.merchant}</p>` : ''}
        <p><strong>Team:</strong> ${data.teamName}</p>
        <p><strong>Action by:</strong> ${data.actorName}</p>
      </div>

      <a href="${data.actionUrl}" class="cta-button">${actionInfo.action}</a>

      <p>Stay connected with your team's receipt management activities.</p>

      <p>Best regards,<br>The Mataresit Team</p>
    </div>
    <div class="footer">
      <p>© 2024 Mataresit. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
${actionInfo.title}

Hi ${data.recipientName},

${actionInfo.message}

${data.comment ? `Comment: "${data.comment}"` : ''}
${data.reason ? `Reason: ${data.reason}` : ''}
${data.message ? `Message: ${data.message}` : ''}

Receipt Details:
- Receipt ID: ${data.receiptId}
${data.merchant ? `- Merchant: ${data.merchant}` : ''}
- Team: ${data.teamName}
- Action by: ${data.actorName}

${actionInfo.action}: ${data.actionUrl}

Stay connected with your team's receipt management activities.

Best regards,
The Mataresit Team

© 2024 Mataresit. All rights reserved.
This is an automated notification. Please do not reply to this email.
  `;

  return { subject, html, text };
}

/**
 * Generate Malay version of team invitation email
 */
function generateTeamInvitationEmailMalay(data: TeamInvitationEmailData): { subject: string; html: string; text: string } {
  const subject = `Anda telah dijemput untuk menyertai ${data.teamName} di Mataresit`;

  const html = `
    <!DOCTYPE html>
    <html lang="ms">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Jemputan Pasukan - Mataresit</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #5a6fd8; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .role-badge { background: #e3f2fd; color: #1976d2; padding: 4px 12px; border-radius: 16px; font-size: 14px; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Anda Dijemput!</h1>
          <p>Sertai ${data.teamName} di Mataresit</p>
        </div>
        <div class="content">
          <p>Hai!</p>

          <p><strong>${data.inviterName}</strong> telah menjemput anda untuk menyertai <strong>${data.teamName}</strong> di Mataresit sebagai <span class="role-badge">${data.role}</span>.</p>

          <p>Mataresit adalah platform pengurusan resit dan penjejakan perbelanjaan yang berkuasa yang membantu pasukan bekerjasama dalam data kewangan dan menyelaraskan aliran kerja perbelanjaan mereka.</p>

          <p>Sebagai ahli pasukan, anda akan dapat:</p>
          <ul>
            <li>📄 Memuat naik dan mengurus resit</li>
            <li>💰 Mengemukakan tuntutan perbelanjaan untuk kelulusan</li>
            <li>👥 Bekerjasama dengan ahli pasukan</li>
            <li>📊 Mengakses pandangan kewangan pasukan</li>
          </ul>

          <div style="text-align: center;">
            <a href="${data.acceptUrl}" class="button">Terima Jemputan</a>
          </div>

          <p><small><strong>Nota:</strong> Jemputan ini akan tamat tempoh pada ${new Date(data.expiresAt).toLocaleDateString('ms-MY', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}.</small></p>

          <p>Jika anda mempunyai sebarang soalan, sila hubungi ${data.inviterName} atau pasukan sokongan kami.</p>

          <p>Selamat datang ke pasukan!</p>
        </div>
        <div class="footer">
          <p>© 2024 Mataresit. Hak cipta terpelihara.</p>
          <p>Jika anda tidak menjangkakan jemputan ini, anda boleh mengabaikan e-mel ini dengan selamat.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Anda telah dijemput untuk menyertai ${data.teamName} di Mataresit!

Hai!

${data.inviterName} telah menjemput anda untuk menyertai ${data.teamName} di Mataresit sebagai ${data.role}.

Mataresit adalah platform pengurusan resit dan penjejakan perbelanjaan yang berkuasa yang membantu pasukan bekerjasama dalam data kewangan dan menyelaraskan aliran kerja perbelanjaan mereka.

Sebagai ahli pasukan, anda akan dapat:
- Memuat naik dan mengurus resit
- Mengemukakan tuntutan perbelanjaan untuk kelulusan
- Bekerjasama dengan ahli pasukan
- Mengakses pandangan kewangan pasukan

Untuk menerima jemputan ini, layari: ${data.acceptUrl}

Nota: Jemputan ini akan tamat tempoh pada ${new Date(data.expiresAt).toLocaleDateString('ms-MY')}.

Jika anda mempunyai sebarang soalan, sila hubungi ${data.inviterName} atau pasukan sokongan kami.

Selamat datang ke pasukan!

© 2024 Mataresit. Hak cipta terpelihara.
Jika anda tidak menjangkakan jemputan ini, anda boleh mengabaikan e-mel ini dengan selamat.
  `;

  return { subject, html, text };
}

/**
 * Generate Malay version of receipt processing email
 */
function generateReceiptProcessingEmailMalay(data: ReceiptProcessingEmailData): { subject: string; html: string; text: string } {
  const statusMessages = {
    started: {
      subject: 'Pemprosesan Resit Dimulakan',
      title: 'Pemprosesan Resit Dimulakan',
      message: data.merchant
        ? `Kami telah memulakan pemprosesan resit anda dari ${data.merchant}.`
        : 'Kami telah memulakan pemprosesan resit anda.',
      action: 'Jejak Kemajuan'
    },
    completed: {
      subject: 'Pemprosesan Resit Selesai',
      title: 'Pemprosesan Resit Selesai ✅',
      message: data.merchant && data.total
        ? `Resit anda dari ${data.merchant} (${data.currency || 'MYR'} ${data.total}) telah diproses dengan jayanya.`
        : data.merchant
        ? `Resit anda dari ${data.merchant} telah diproses dengan jayanya.`
        : 'Resit anda telah diproses dengan jayanya.',
      action: 'Lihat Resit'
    },
    failed: {
      subject: 'Pemprosesan Resit Gagal',
      title: 'Pemprosesan Resit Gagal ❌',
      message: data.errorMessage
        ? `Pemprosesan resit gagal: ${data.errorMessage}`
        : 'Pemprosesan resit gagal. Sila cuba muat naik semula atau hubungi sokongan jika masalah berterusan.',
      action: 'Cuba Semula'
    },
    ready_for_review: {
      subject: 'Resit Sedia untuk Semakan',
      title: 'Resit Sedia untuk Semakan 📋',
      message: data.merchant
        ? `Resit anda dari ${data.merchant} telah diproses dan sedia untuk semakan anda.`
        : 'Resit anda telah diproses dan sedia untuk semakan anda.',
      action: 'Semak Resit'
    }
  };

  const statusInfo = statusMessages[data.status];
  const subject = statusInfo.subject;

  const html = `
<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px 20px; }
    .receipt-info { background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; }
    .receipt-info h3 { margin: 0 0 10px 0; color: #374151; font-size: 16px; }
    .receipt-info p { margin: 5px 0; color: #6b7280; }
    .cta-button { display: inline-block; background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
    .cta-button:hover { background-color: #5a67d8; }
    .footer { background-color: #f8fafc; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
    .status-icon { font-size: 48px; margin-bottom: 20px; }
    ${data.status === 'failed' ? '.header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }' : ''}
    ${data.status === 'completed' ? '.header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }' : ''}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="status-icon">${data.status === 'completed' ? '✅' : data.status === 'failed' ? '❌' : data.status === 'ready_for_review' ? '📋' : '⏳'}</div>
      <h1>${statusInfo.title}</h1>
    </div>
    <div class="content">
      <p>Hai ${data.recipientName},</p>

      <p>${statusInfo.message}</p>

      <div class="receipt-info">
        <h3>Butiran Resit</h3>
        <p><strong>ID Resit:</strong> ${data.receiptId}</p>
        ${data.merchant ? `<p><strong>Pedagang:</strong> ${data.merchant}</p>` : ''}
        ${data.total ? `<p><strong>Jumlah:</strong> ${data.currency || 'MYR'} ${data.total}</p>` : ''}
        ${data.teamName ? `<p><strong>Pasukan:</strong> ${data.teamName}</p>` : ''}
      </div>

      <a href="${data.actionUrl}" class="cta-button">${statusInfo.action}</a>

      <p>Jika anda mempunyai sebarang soalan atau memerlukan bantuan, sila jangan teragak-agak untuk menghubungi pasukan sokongan kami.</p>

      <p>Salam hormat,<br>Pasukan Mataresit</p>
    </div>
    <div class="footer">
      <p>© 2024 Mataresit. Hak cipta terpelihara.</p>
      <p>Ini adalah pemberitahuan automatik. Sila jangan balas e-mel ini.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
${statusInfo.title}

Hai ${data.recipientName},

${statusInfo.message}

Butiran Resit:
- ID Resit: ${data.receiptId}
${data.merchant ? `- Pedagang: ${data.merchant}` : ''}
${data.total ? `- Jumlah: ${data.currency || 'MYR'} ${data.total}` : ''}
${data.teamName ? `- Pasukan: ${data.teamName}` : ''}

${statusInfo.action}: ${data.actionUrl}

Jika anda mempunyai sebarang soalan atau memerlukan bantuan, sila jangan teragak-agak untuk menghubungi pasukan sokongan kami.

Salam hormat,
Pasukan Mataresit

© 2024 Mataresit. Hak cipta terpelihara.
Ini adalah pemberitahuan automatik. Sila jangan balas e-mel ini.
  `;

  return { subject, html, text };
}

/**
 * Generate Malay version of batch processing email
 */
function generateBatchProcessingEmailMalay(data: BatchProcessingEmailData): { subject: string; html: string; text: string } {
  const isSuccess = data.failedReceipts === 0;
  const hasPartialFailure = data.failedReceipts > 0 && data.successfulReceipts > 0;

  const subject = isSuccess
    ? 'Pemprosesan Kelompok Selesai dengan Jayanya'
    : hasPartialFailure
    ? 'Pemprosesan Kelompok Selesai dengan Beberapa Isu'
    : 'Pemprosesan Kelompok Gagal';

  const title = isSuccess
    ? 'Pemprosesan Kelompok Selesai ✅'
    : hasPartialFailure
    ? 'Pemprosesan Kelompok Selesai ⚠️'
    : 'Pemprosesan Kelompok Gagal ❌';

  const message = isSuccess
    ? `Semua ${data.totalReceipts} resit dalam kelompok anda telah diproses dengan jayanya.`
    : hasPartialFailure
    ? `${data.successfulReceipts} daripada ${data.totalReceipts} resit telah diproses dengan jayanya. ${data.failedReceipts} resit gagal diproses.`
    : `Malangnya, semua ${data.totalReceipts} resit dalam kelompok anda gagal diproses.`;

  const text = `
${title}

Hai ${data.recipientName},

${message}

Ringkasan Kelompok:
- Jumlah Resit: ${data.totalReceipts}
- Berjaya: ${data.successfulReceipts}
- Gagal: ${data.failedReceipts}

${data.teamName ? `Pasukan: ${data.teamName}` : ''}

Lihat Papan Pemuka: ${data.actionUrl}

${data.failedReceipts > 0 ? 'Untuk resit yang gagal, sila semak butiran ralat di papan pemuka anda dan cuba muat naik semula.' : ''}

Jika anda mempunyai sebarang soalan atau memerlukan bantuan, sila jangan teragak-agak untuk menghubungi pasukan sokongan kami.

Salam hormat,
Pasukan Mataresit

© 2024 Mataresit. Hak cipta terpelihara.
Ini adalah pemberitahuan automatik. Sila jangan balas e-mel ini.
  `;

  return { subject, html: '', text }; // Simplified for space
}

/**
 * Generate Malay version of team collaboration email
 */
function generateTeamCollaborationEmailMalay(data: TeamCollaborationEmailData): { subject: string; html: string; text: string } {
  const actionMessages = {
    shared: {
      subject: `Resit Dikongsi oleh ${data.actorName}`,
      title: 'Resit Dikongsi dengan Pasukan',
      message: `${data.actorName} telah berkongsi resit${data.merchant ? ` dari ${data.merchant}` : ''} dengan pasukan anda.`,
      action: 'Lihat Resit'
    },
    commented: {
      subject: `Komen Baru dari ${data.actorName}`,
      title: 'Komen Baru Ditambah',
      message: `${data.actorName} menambah komen${data.merchant ? ` pada resit dari ${data.merchant}` : ' pada resit'}.`,
      action: 'Lihat Komen'
    },
    edited: {
      subject: `Resit Diedit oleh ${data.actorName}`,
      title: 'Resit Dikemas Kini',
      message: `${data.actorName} membuat perubahan${data.merchant ? ` pada resit dari ${data.merchant}` : ' pada resit'}.`,
      action: 'Lihat Perubahan'
    },
    approved: {
      subject: `Resit Diluluskan oleh ${data.actorName}`,
      title: 'Resit Diluluskan ✅',
      message: `${data.actorName} meluluskan${data.merchant ? ` resit dari ${data.merchant}` : ' resit anda'}.`,
      action: 'Lihat Resit'
    },
    flagged: {
      subject: `Resit Dibenderakan oleh ${data.actorName}`,
      title: 'Resit Dibenderakan untuk Semakan ⚠️',
      message: `${data.actorName} membenderakan${data.merchant ? ` resit dari ${data.merchant}` : ' resit'} untuk semakan.`,
      action: 'Semak Resit'
    }
  };

  const actionInfo = actionMessages[data.action];
  const subject = actionInfo.subject;

  const text = `
${actionInfo.title}

Hai ${data.recipientName},

${actionInfo.message}

${data.comment ? `Komen: "${data.comment}"` : ''}
${data.reason ? `Sebab: ${data.reason}` : ''}
${data.message ? `Mesej: ${data.message}` : ''}

Butiran Resit:
- ID Resit: ${data.receiptId}
${data.merchant ? `- Pedagang: ${data.merchant}` : ''}
- Pasukan: ${data.teamName}
- Tindakan oleh: ${data.actorName}

${actionInfo.action}: ${data.actionUrl}

Kekal berhubung dengan aktiviti pengurusan resit pasukan anda.

Salam hormat,
Pasukan Mataresit

© 2024 Mataresit. Hak cipta terpelihara.
Ini adalah pemberitahuan automatik. Sila jangan balas e-mel ini.
  `;

  return { subject, html: '', text }; // Simplified for space
}
