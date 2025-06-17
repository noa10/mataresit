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
