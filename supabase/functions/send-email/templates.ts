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

export interface TeamMemberRemovedEmailData {
  removedUserName: string;
  teamName: string;
  removedByUserName: string;
  removedByUserEmail: string;
  removalReason?: string;
  removalTimestamp: string;
  transferredToUserName?: string;
  language?: 'en' | 'ms';
}

// Billing Email Template Interfaces
export interface BillingReminderEmailData {
  recipientName: string;
  recipientEmail: string;
  subscriptionTier: 'pro' | 'max';
  renewalDate: string;
  amount: number;
  currency: string;
  billingInterval: 'monthly' | 'annual';
  daysUntilRenewal: number;
  paymentMethodLast4?: string;
  paymentMethodBrand?: string;
  manageSubscriptionUrl: string;
  updatePaymentMethodUrl: string;
  language?: 'en' | 'ms';
}

export interface PaymentFailedEmailData {
  recipientName: string;
  recipientEmail: string;
  subscriptionTier: 'pro' | 'max';
  amount: number;
  currency: string;
  failureReason?: string;
  retryAttempt: number;
  maxRetryAttempts: number;
  nextRetryDate?: string;
  gracePeriodEndDate?: string;
  updatePaymentMethodUrl: string;
  manageSubscriptionUrl: string;
  language?: 'en' | 'ms';
}

export interface SubscriptionExpiryEmailData {
  recipientName: string;
  recipientEmail: string;
  subscriptionTier: 'pro' | 'max';
  expiryDate: string;
  gracePeriodEndDate?: string;
  isInGracePeriod: boolean;
  renewSubscriptionUrl: string;
  manageSubscriptionUrl: string;
  language?: 'en' | 'ms';
}

export interface PaymentConfirmationEmailData {
  recipientName: string;
  recipientEmail: string;
  subscriptionTier: 'pro' | 'max';
  amount: number;
  currency: string;
  billingInterval: 'monthly' | 'annual';
  billingPeriodStart: string;
  billingPeriodEnd: string;
  nextBillingDate: string;
  paymentMethodLast4?: string;
  paymentMethodBrand?: string;
  invoiceUrl?: string;
  manageSubscriptionUrl: string;
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
        .button {
          display: inline-block;
          background: #667eea;
          color: #ffffff !important;
          padding: 12px 24px;
          text-decoration: none !important;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
          border: none;
          font-size: 16px;
        }
        .button:hover { background: #5a6fd8; color: #ffffff !important; }
        .button:visited { color: #ffffff !important; }
        .button:active { color: #ffffff !important; }
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

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.acceptUrl}" class="button" style="background: #667eea; color: #ffffff !important; text-decoration: none !important;">Accept Invitation</a>
          </div>

          <div style="background: #e8f4fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #1565c0;">
              <strong>💡 Getting Started:</strong> When you click the invitation link, we'll guide you through the process based on whether you already have a Mataresit account or need to create one.
            </p>
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
 * Generate team member removed notification email
 */
export function generateTeamMemberRemovedEmail(data: TeamMemberRemovedEmailData): { subject: string; html: string; text: string } {
  const language = data.language || 'en';

  if (language === 'ms') {
    return generateTeamMemberRemovedEmailMalay(data);
  }

  const subject = `You have been removed from team "${data.teamName}"`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .removal-info { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .contact-info { background-color: #e3f2fd; border: 1px solid #bbdefb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .cta-button { display: inline-block; background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    h1 { margin: 0; font-size: 24px; }
    h3 { color: #333; margin-top: 0; }
    .warning-icon { font-size: 48px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="warning-icon">⚠️</div>
      <h1>Team Membership Update</h1>
    </div>
    <div class="content">
      <p>Dear ${data.removedUserName},</p>

      <p>We're writing to inform you that you have been removed from the team <strong>"${data.teamName}"</strong> on Mataresit.</p>

      <div class="removal-info">
        <h3>Removal Details</h3>
        <p><strong>Team:</strong> ${data.teamName}</p>
        <p><strong>Removed by:</strong> ${data.removedByUserName}</p>
        <p><strong>Date & Time:</strong> ${data.removalTimestamp}</p>
        ${data.removalReason ? `<p><strong>Reason:</strong> ${data.removalReason}</p>` : ''}
        ${data.transferredToUserName ? `<p><strong>Data transferred to:</strong> ${data.transferredToUserName}</p>` : ''}
      </div>

      <p>As a result of this change:</p>
      <ul>
        <li>You no longer have access to the team's receipts and data</li>
        <li>You cannot submit new expense claims to this team</li>
        <li>You will not receive further notifications from this team</li>
        ${data.transferredToUserName ? `<li>Your previous contributions have been transferred to ${data.transferredToUserName}</li>` : ''}
      </ul>

      <div class="contact-info">
        <h3>Questions or Concerns?</h3>
        <p>If you have any questions about this removal or believe this was done in error, please contact:</p>
        <p><strong>${data.removedByUserName}</strong><br>
        Email: <a href="mailto:${data.removedByUserEmail}">${data.removedByUserEmail}</a></p>
        <p>You can also reach out to our support team if you need assistance.</p>
      </div>

      <p>Thank you for your time with the team. If you need to access your personal receipt data, you can still log into your Mataresit account.</p>

      <a href="https://app.mataresit.com/login" class="cta-button">Access Your Account</a>

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
You have been removed from team "${data.teamName}"

Dear ${data.removedUserName},

We're writing to inform you that you have been removed from the team "${data.teamName}" on Mataresit.

Removal Details:
- Team: ${data.teamName}
- Removed by: ${data.removedByUserName}
- Date & Time: ${data.removalTimestamp}
${data.removalReason ? `- Reason: ${data.removalReason}` : ''}
${data.transferredToUserName ? `- Data transferred to: ${data.transferredToUserName}` : ''}

As a result of this change:
- You no longer have access to the team's receipts and data
- You cannot submit new expense claims to this team
- You will not receive further notifications from this team
${data.transferredToUserName ? `- Your previous contributions have been transferred to ${data.transferredToUserName}` : ''}

Questions or Concerns?
If you have any questions about this removal or believe this was done in error, please contact:
${data.removedByUserName} - ${data.removedByUserEmail}

You can also reach out to our support team if you need assistance.

Thank you for your time with the team. If you need to access your personal receipt data, you can still log into your Mataresit account.

Access Your Account: https://app.mataresit.com/login

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
        .button {
          display: inline-block;
          background: #667eea;
          color: #ffffff !important;
          padding: 12px 24px;
          text-decoration: none !important;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
          border: none;
          font-size: 16px;
        }
        .button:hover { background: #5a6fd8; color: #ffffff !important; }
        .button:visited { color: #ffffff !important; }
        .button:active { color: #ffffff !important; }
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

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.acceptUrl}" class="button" style="background: #667eea; color: #ffffff !important; text-decoration: none !important;">Terima Jemputan</a>
          </div>

          <div style="background: #e8f4fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px; color: #1565c0;">
              <strong>💡 Memulakan:</strong> Apabila anda klik pautan jemputan, kami akan membimbing anda melalui proses berdasarkan sama ada anda sudah mempunyai akaun Mataresit atau perlu membuat satu.
            </p>
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

/**
 * Generate billing reminder email (upcoming renewal)
 */
export function generateBillingReminderEmail(data: BillingReminderEmailData): { subject: string; html: string; text: string } {
  const language = data.language || 'en';

  if (language === 'ms') {
    return generateBillingReminderEmailMalay(data);
  }

  const tierName = data.subscriptionTier === 'pro' ? 'Pro' : 'Max';
  const intervalText = data.billingInterval === 'monthly' ? 'monthly' : 'annual';
  const urgencyText = data.daysUntilRenewal <= 1 ? 'tomorrow' : `in ${data.daysUntilRenewal} days`;

  const subject = `Your Mataresit ${tierName} subscription renews ${urgencyText}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .billing-summary { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; }
    .billing-item { display: flex; justify-content: space-between; margin: 8px 0; }
    .billing-item strong { color: #333; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .secondary-button { display: inline-block; background: #6c757d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-size: 14px; margin: 10px 5px 0 0; }
    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #6c757d; }
    .payment-method { background-color: #e3f2fd; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .alert { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 Subscription Renewal Reminder</h1>
    </div>
    <div class="content">
      <h2>Hi ${data.recipientName},</h2>

      <p>Your Mataresit <strong>${tierName}</strong> subscription is set to renew ${urgencyText}. We wanted to give you a heads up about your upcoming billing.</p>

      <div class="billing-summary">
        <h3>📋 Billing Summary</h3>
        <div class="billing-item">
          <span>Subscription Plan:</span>
          <strong>Mataresit ${tierName} (${intervalText})</strong>
        </div>
        <div class="billing-item">
          <span>Renewal Date:</span>
          <strong>${new Date(data.renewalDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</strong>
        </div>
        <div class="billing-item">
          <span>Amount:</span>
          <strong>${data.currency.toUpperCase()} ${data.amount.toFixed(2)}</strong>
        </div>
        ${data.paymentMethodLast4 ? `
        <div class="billing-item">
          <span>Payment Method:</span>
          <strong>${data.paymentMethodBrand || 'Card'} ending in ${data.paymentMethodLast4}</strong>
        </div>
        ` : ''}
      </div>

      ${data.paymentMethodLast4 ? `
      <div class="payment-method">
        <h4>💳 Payment Method</h4>
        <p>Your subscription will be automatically charged to your ${data.paymentMethodBrand || 'card'} ending in <strong>${data.paymentMethodLast4}</strong>.</p>
      </div>
      ` : `
      <div class="alert">
        <h4>⚠️ Payment Method Required</h4>
        <p>We don't have a valid payment method on file. Please update your payment information to avoid service interruption.</p>
      </div>
      `}

      <p>No action is required if you want to continue with your subscription. The renewal will happen automatically.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.manageSubscriptionUrl}" class="cta-button">Manage Subscription</a>
        <br>
        <a href="${data.updatePaymentMethodUrl}" class="secondary-button">Update Payment Method</a>
      </div>

      <p>If you have any questions about your subscription or billing, please don't hesitate to contact our support team.</p>

      <p>Thank you for being a valued Mataresit customer!</p>

      <p>Best regards,<br>The Mataresit Team</p>
    </div>
    <div class="footer">
      <p>© 2024 Mataresit. All rights reserved.</p>
      <p>This is an automated billing notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Subscription Renewal Reminder

Hi ${data.recipientName},

Your Mataresit ${tierName} subscription is set to renew ${urgencyText}. We wanted to give you a heads up about your upcoming billing.

Billing Summary:
- Subscription Plan: Mataresit ${tierName} (${intervalText})
- Renewal Date: ${new Date(data.renewalDate).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}
- Amount: ${data.currency.toUpperCase()} ${data.amount.toFixed(2)}
${data.paymentMethodLast4 ? `- Payment Method: ${data.paymentMethodBrand || 'Card'} ending in ${data.paymentMethodLast4}` : ''}

${data.paymentMethodLast4
  ? `Your subscription will be automatically charged to your ${data.paymentMethodBrand || 'card'} ending in ${data.paymentMethodLast4}.`
  : 'We don\'t have a valid payment method on file. Please update your payment information to avoid service interruption.'
}

No action is required if you want to continue with your subscription. The renewal will happen automatically.

Manage Subscription: ${data.manageSubscriptionUrl}
Update Payment Method: ${data.updatePaymentMethodUrl}

If you have any questions about your subscription or billing, please don't hesitate to contact our support team.

Thank you for being a valued Mataresit customer!

Best regards,
The Mataresit Team

© 2024 Mataresit. All rights reserved.
This is an automated billing notification. Please do not reply to this email.
  `;

  return { subject, html, text };
}

/**
 * Generate payment failed email
 */
export function generatePaymentFailedEmail(data: PaymentFailedEmailData): { subject: string; html: string; text: string } {
  const language = data.language || 'en';

  if (language === 'ms') {
    return generatePaymentFailedEmailMalay(data);
  }

  const tierName = data.subscriptionTier === 'pro' ? 'Pro' : 'Max';
  const isLastAttempt = data.retryAttempt >= data.maxRetryAttempts;

  const subject = isLastAttempt
    ? `Action Required: Payment Failed for Mataresit ${tierName}`
    : `Payment Failed - We'll Try Again Soon (Attempt ${data.retryAttempt}/${data.maxRetryAttempts})`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .alert-error { background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 20px; margin: 20px 0; color: #721c24; }
    .alert-warning { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 20px; margin: 20px 0; color: #856404; }
    .billing-summary { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc3545; }
    .billing-item { display: flex; justify-content: space-between; margin: 8px 0; }
    .billing-item strong { color: #333; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .secondary-button { display: inline-block; background: #6c757d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-size: 14px; margin: 10px 5px 0 0; }
    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #6c757d; }
    .retry-info { background-color: #e7f3ff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #007bff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Payment Failed</h1>
    </div>
    <div class="content">
      <h2>Hi ${data.recipientName},</h2>

      ${isLastAttempt ? `
      <div class="alert-error">
        <h3>⚠️ Immediate Action Required</h3>
        <p>We were unable to process your payment for your Mataresit ${tierName} subscription after ${data.maxRetryAttempts} attempts. Your subscription may be suspended soon.</p>
      </div>
      ` : `
      <div class="alert-warning">
        <h3>Payment Issue Detected</h3>
        <p>We encountered an issue processing your payment for your Mataresit ${tierName} subscription. Don't worry - we'll automatically try again.</p>
      </div>
      `}

      <div class="billing-summary">
        <h3>💳 Payment Details</h3>
        <div class="billing-item">
          <span>Subscription Plan:</span>
          <strong>Mataresit ${tierName}</strong>
        </div>
        <div class="billing-item">
          <span>Amount:</span>
          <strong>${data.currency.toUpperCase()} ${data.amount.toFixed(2)}</strong>
        </div>
        <div class="billing-item">
          <span>Attempt:</span>
          <strong>${data.retryAttempt} of ${data.maxRetryAttempts}</strong>
        </div>
        ${data.failureReason ? `
        <div class="billing-item">
          <span>Reason:</span>
          <strong>${data.failureReason}</strong>
        </div>
        ` : ''}
      </div>

      ${!isLastAttempt && data.nextRetryDate ? `
      <div class="retry-info">
        <h4>🔄 Automatic Retry</h4>
        <p>We'll automatically try to process your payment again on <strong>${new Date(data.nextRetryDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</strong>.</p>
      </div>
      ` : ''}

      ${data.gracePeriodEndDate ? `
      <div class="alert-warning">
        <h4>⏰ Grace Period</h4>
        <p>Your subscription will remain active until <strong>${new Date(data.gracePeriodEndDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</strong>. Please update your payment method before this date to avoid service interruption.</p>
      </div>
      ` : ''}

      <h3>What you can do:</h3>
      <ul>
        <li><strong>Update your payment method</strong> - This is the quickest way to resolve the issue</li>
        <li><strong>Check your card details</strong> - Ensure your card hasn't expired and has sufficient funds</li>
        <li><strong>Contact your bank</strong> - Sometimes banks block online transactions for security</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.updatePaymentMethodUrl}" class="cta-button">Update Payment Method</a>
        <br>
        <a href="${data.manageSubscriptionUrl}" class="secondary-button">Manage Subscription</a>
      </div>

      <p>If you continue to experience issues or have questions, please contact our support team. We're here to help!</p>

      <p>Best regards,<br>The Mataresit Team</p>
    </div>
    <div class="footer">
      <p>© 2024 Mataresit. All rights reserved.</p>
      <p>This is an automated billing notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Payment Failed

Hi ${data.recipientName},

${isLastAttempt
  ? `We were unable to process your payment for your Mataresit ${tierName} subscription after ${data.maxRetryAttempts} attempts. Your subscription may be suspended soon.`
  : `We encountered an issue processing your payment for your Mataresit ${tierName} subscription. Don't worry - we'll automatically try again.`
}

Payment Details:
- Subscription Plan: Mataresit ${tierName}
- Amount: ${data.currency.toUpperCase()} ${data.amount.toFixed(2)}
- Attempt: ${data.retryAttempt} of ${data.maxRetryAttempts}
${data.failureReason ? `- Reason: ${data.failureReason}` : ''}

${!isLastAttempt && data.nextRetryDate ? `We'll automatically try to process your payment again on ${new Date(data.nextRetryDate).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}.` : ''}

${data.gracePeriodEndDate ? `Your subscription will remain active until ${new Date(data.gracePeriodEndDate).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}. Please update your payment method before this date to avoid service interruption.` : ''}

What you can do:
- Update your payment method - This is the quickest way to resolve the issue
- Check your card details - Ensure your card hasn't expired and has sufficient funds
- Contact your bank - Sometimes banks block online transactions for security

Update Payment Method: ${data.updatePaymentMethodUrl}
Manage Subscription: ${data.manageSubscriptionUrl}

If you continue to experience issues or have questions, please contact our support team. We're here to help!

Best regards,
The Mataresit Team

© 2024 Mataresit. All rights reserved.
This is an automated billing notification. Please do not reply to this email.
  `;

  return { subject, html, text };
}

// Import additional billing templates
export {
  generateSubscriptionExpiryEmail,
  generatePaymentConfirmationEmail
} from './billing-templates.ts';

// Malay versions for billing reminder and payment failed emails
function generateBillingReminderEmailMalay(data: BillingReminderEmailData): { subject: string; html: string; text: string } {
  const tierName = data.subscriptionTier === 'pro' ? 'Pro' : 'Max';
  const intervalText = data.billingInterval === 'monthly' ? 'bulanan' : 'tahunan';
  const urgencyText = data.daysUntilRenewal <= 1 ? 'esok' : `dalam ${data.daysUntilRenewal} hari`;

  const subject = `Langganan Mataresit ${tierName} anda akan diperbaharui ${urgencyText}`;

  const text = `
Peringatan Pembaharuan Langganan

Hai ${data.recipientName},

Langganan Mataresit ${tierName} anda akan diperbaharui ${urgencyText}. Kami ingin memberi anda pemberitahuan awal mengenai pengebilan yang akan datang.

Ringkasan Pengebilan:
- Pelan Langganan: Mataresit ${tierName} (${intervalText})
- Tarikh Pembaharuan: ${new Date(data.renewalDate).toLocaleDateString('ms-MY', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}
- Jumlah: ${data.currency.toUpperCase()} ${data.amount.toFixed(2)}
${data.paymentMethodLast4 ? `- Kaedah Pembayaran: ${data.paymentMethodBrand || 'Kad'} berakhir dengan ${data.paymentMethodLast4}` : ''}

${data.paymentMethodLast4
  ? `Langganan anda akan dikenakan caj secara automatik kepada ${data.paymentMethodBrand || 'kad'} anda yang berakhir dengan ${data.paymentMethodLast4}.`
  : 'Kami tidak mempunyai kaedah pembayaran yang sah dalam fail. Sila kemas kini maklumat pembayaran anda untuk mengelakkan gangguan perkhidmatan.'
}

Tiada tindakan diperlukan jika anda ingin meneruskan langganan anda. Pembaharuan akan berlaku secara automatik.

Urus Langganan: ${data.manageSubscriptionUrl}
Kemas Kini Kaedah Pembayaran: ${data.updatePaymentMethodUrl}

Jika anda mempunyai sebarang soalan mengenai langganan atau pengebilan anda, sila jangan teragak-agak untuk menghubungi pasukan sokongan kami.

Terima kasih kerana menjadi pelanggan Mataresit yang dihargai!

Salam hormat,
Pasukan Mataresit

© 2024 Mataresit. Hak cipta terpelihara.
Ini adalah pemberitahuan pengebilan automatik. Sila jangan balas e-mel ini.
  `;

  return { subject, html: '', text }; // Simplified HTML for space
}

function generatePaymentFailedEmailMalay(data: PaymentFailedEmailData): { subject: string; html: string; text: string } {
  const tierName = data.subscriptionTier === 'pro' ? 'Pro' : 'Max';
  const isLastAttempt = data.retryAttempt >= data.maxRetryAttempts;

  const subject = isLastAttempt
    ? `Tindakan Diperlukan: Pembayaran Gagal untuk Mataresit ${tierName}`
    : `Pembayaran Gagal - Kami Akan Cuba Lagi Tidak Lama Lagi (Percubaan ${data.retryAttempt}/${data.maxRetryAttempts})`;

  const text = `
Pembayaran Gagal

Hai ${data.recipientName},

${isLastAttempt
  ? `Kami tidak dapat memproses pembayaran anda untuk langganan Mataresit ${tierName} selepas ${data.maxRetryAttempts} percubaan. Langganan anda mungkin akan digantung tidak lama lagi.`
  : `Kami menghadapi masalah memproses pembayaran anda untuk langganan Mataresit ${tierName}. Jangan risau - kami akan cuba secara automatik lagi.`
}

Butiran Pembayaran:
- Pelan Langganan: Mataresit ${tierName}
- Jumlah: ${data.currency.toUpperCase()} ${data.amount.toFixed(2)}
- Percubaan: ${data.retryAttempt} daripada ${data.maxRetryAttempts}
${data.failureReason ? `- Sebab: ${data.failureReason}` : ''}

${!isLastAttempt && data.nextRetryDate ? `Kami akan cuba memproses pembayaran anda secara automatik lagi pada ${new Date(data.nextRetryDate).toLocaleDateString('ms-MY', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}.` : ''}

${data.gracePeriodEndDate ? `Langganan anda akan kekal aktif sehingga ${new Date(data.gracePeriodEndDate).toLocaleDateString('ms-MY', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}. Sila kemas kini kaedah pembayaran anda sebelum tarikh ini untuk mengelakkan gangguan perkhidmatan.` : ''}

Apa yang boleh anda lakukan:
- Kemas kini kaedah pembayaran anda - Ini adalah cara terpantas untuk menyelesaikan masalah
- Semak butiran kad anda - Pastikan kad anda belum tamat tempoh dan mempunyai dana yang mencukupi
- Hubungi bank anda - Kadangkala bank menyekat transaksi dalam talian untuk keselamatan

Kemas Kini Kaedah Pembayaran: ${data.updatePaymentMethodUrl}
Urus Langganan: ${data.manageSubscriptionUrl}

Jika anda terus menghadapi masalah atau mempunyai soalan, sila hubungi pasukan sokongan kami. Kami di sini untuk membantu!

Salam hormat,
Pasukan Mataresit

© 2024 Mataresit. Hak cipta terpelihara.
Ini adalah pemberitahuan pengebilan automatik. Sila jangan balas e-mel ini.
  `;

  return { subject, html: '', text }; // Simplified HTML for space
}

/**
 * Generate Malay version of team member removed email
 */
function generateTeamMemberRemovedEmailMalay(data: TeamMemberRemovedEmailData): { subject: string; html: string; text: string } {
  const subject = `Anda telah dikeluarkan dari pasukan "${data.teamName}"`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .removal-info { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .contact-info { background-color: #e3f2fd; border: 1px solid #bbdefb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .cta-button { display: inline-block; background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    h1 { margin: 0; font-size: 24px; }
    h3 { color: #333; margin-top: 0; }
    .warning-icon { font-size: 48px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="warning-icon">⚠️</div>
      <h1>Kemaskini Keahlian Pasukan</h1>
    </div>
    <div class="content">
      <p>Yang dihormati ${data.removedUserName},</p>

      <p>Kami menulis untuk memaklumkan bahawa anda telah dikeluarkan dari pasukan <strong>"${data.teamName}"</strong> di Mataresit.</p>

      <div class="removal-info">
        <h3>Butiran Penyingkiran</h3>
        <p><strong>Pasukan:</strong> ${data.teamName}</p>
        <p><strong>Dikeluarkan oleh:</strong> ${data.removedByUserName}</p>
        <p><strong>Tarikh & Masa:</strong> ${data.removalTimestamp}</p>
        ${data.removalReason ? `<p><strong>Sebab:</strong> ${data.removalReason}</p>` : ''}
        ${data.transferredToUserName ? `<p><strong>Data dipindahkan kepada:</strong> ${data.transferredToUserName}</p>` : ''}
      </div>

      <p>Akibat perubahan ini:</p>
      <ul>
        <li>Anda tidak lagi mempunyai akses kepada resit dan data pasukan</li>
        <li>Anda tidak boleh mengemukakan tuntutan perbelanjaan baharu kepada pasukan ini</li>
        <li>Anda tidak akan menerima pemberitahuan lanjut dari pasukan ini</li>
        ${data.transferredToUserName ? `<li>Sumbangan anda sebelum ini telah dipindahkan kepada ${data.transferredToUserName}</li>` : ''}
      </ul>

      <div class="contact-info">
        <h3>Soalan atau Kebimbangan?</h3>
        <p>Jika anda mempunyai sebarang soalan mengenai penyingkiran ini atau percaya ini dilakukan secara silap, sila hubungi:</p>
        <p><strong>${data.removedByUserName}</strong><br>
        E-mel: <a href="mailto:${data.removedByUserEmail}">${data.removedByUserEmail}</a></p>
        <p>Anda juga boleh menghubungi pasukan sokongan kami jika anda memerlukan bantuan.</p>
      </div>

      <p>Terima kasih atas masa anda bersama pasukan. Jika anda perlu mengakses data resit peribadi anda, anda masih boleh log masuk ke akaun Mataresit anda.</p>

      <a href="https://app.mataresit.com/login" class="cta-button">Akses Akaun Anda</a>

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
Anda telah dikeluarkan dari pasukan "${data.teamName}"

Yang dihormati ${data.removedUserName},

Kami menulis untuk memaklumkan bahawa anda telah dikeluarkan dari pasukan "${data.teamName}" di Mataresit.

Butiran Penyingkiran:
- Pasukan: ${data.teamName}
- Dikeluarkan oleh: ${data.removedByUserName}
- Tarikh & Masa: ${data.removalTimestamp}
${data.removalReason ? `- Sebab: ${data.removalReason}` : ''}
${data.transferredToUserName ? `- Data dipindahkan kepada: ${data.transferredToUserName}` : ''}

Akibat perubahan ini:
- Anda tidak lagi mempunyai akses kepada resit dan data pasukan
- Anda tidak boleh mengemukakan tuntutan perbelanjaan baharu kepada pasukan ini
- Anda tidak akan menerima pemberitahuan lanjut dari pasukan ini
${data.transferredToUserName ? `- Sumbangan anda sebelum ini telah dipindahkan kepada ${data.transferredToUserName}` : ''}

Soalan atau Kebimbangan?
Jika anda mempunyai sebarang soalan mengenai penyingkiran ini atau percaya ini dilakukan secara silap, sila hubungi:
${data.removedByUserName} - ${data.removedByUserEmail}

Anda juga boleh menghubungi pasukan sokongan kami jika anda memerlukan bantuan.

Terima kasih atas masa anda bersama pasukan. Jika anda perlu mengakses data resit peribadi anda, anda masih boleh log masuk ke akaun Mataresit anda.

Akses Akaun Anda: https://app.mataresit.com/login

Salam hormat,
Pasukan Mataresit

© 2024 Mataresit. Hak cipta terpelihara.
Ini adalah pemberitahuan automatik. Sila jangan balas e-mel ini.
  `;

  return { subject, html, text };
}
