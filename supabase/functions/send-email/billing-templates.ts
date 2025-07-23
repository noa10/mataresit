// Additional Billing Email Templates
// This file contains the remaining billing templates and Malay language versions

import {
  BillingReminderEmailData,
  PaymentFailedEmailData,
  SubscriptionExpiryEmailData,
  PaymentConfirmationEmailData
} from './templates.ts';

/**
 * Generate subscription expiry email
 */
export function generateSubscriptionExpiryEmail(data: SubscriptionExpiryEmailData): { subject: string; html: string; text: string } {
  const language = data.language || 'en';

  if (language === 'ms') {
    return generateSubscriptionExpiryEmailMalay(data);
  }

  const tierName = data.subscriptionTier === 'pro' ? 'Pro' : 'Max';
  const isInGracePeriod = data.isInGracePeriod;
  
  const subject = isInGracePeriod 
    ? `Grace Period: Renew Your Mataresit ${tierName} Subscription`
    : `Your Mataresit ${tierName} Subscription Has Expired`;

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
    .header { background: linear-gradient(135deg, #fd7e14 0%, #e55a4e 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .alert-warning { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 20px; margin: 20px 0; color: #856404; }
    .alert-danger { background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 20px; margin: 20px 0; color: #721c24; }
    .expiry-summary { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #fd7e14; }
    .billing-item { display: flex; justify-content: space-between; margin: 8px 0; }
    .billing-item strong { color: #333; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .secondary-button { display: inline-block; background: #6c757d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-size: 14px; margin: 10px 5px 0 0; }
    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #6c757d; }
    .features-lost { background-color: #fff5f5; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #e53e3e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${isInGracePeriod ? '⏰ Grace Period Active' : '⚠️ Subscription Expired'}</h1>
    </div>
    <div class="content">
      <h2>Hi ${data.recipientName},</h2>
      
      ${isInGracePeriod ? `
      <div class="alert-warning">
        <h3>Your subscription is in grace period</h3>
        <p>Your Mataresit ${tierName} subscription expired on <strong>${new Date(data.expiryDate).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</strong>, but you still have time to renew without losing access.</p>
      </div>
      ` : `
      <div class="alert-danger">
        <h3>Your subscription has expired</h3>
        <p>Your Mataresit ${tierName} subscription expired on <strong>${new Date(data.expiryDate).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</strong>. Your account has been downgraded to the free tier.</p>
      </div>
      `}
      
      <div class="expiry-summary">
        <h3>📋 Subscription Details</h3>
        <div class="billing-item">
          <span>Plan:</span>
          <strong>Mataresit ${tierName}</strong>
        </div>
        <div class="billing-item">
          <span>Expiry Date:</span>
          <strong>${new Date(data.expiryDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</strong>
        </div>
        ${data.gracePeriodEndDate ? `
        <div class="billing-item">
          <span>Grace Period Ends:</span>
          <strong>${new Date(data.gracePeriodEndDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</strong>
        </div>
        ` : ''}
      </div>

      ${isInGracePeriod ? `
      <p>You're currently in a grace period, which means you still have access to all your ${tierName} features. However, this won't last forever.</p>
      ` : `
      <div class="features-lost">
        <h4>🚫 Features No Longer Available</h4>
        <ul>
          <li>Increased receipt processing limits</li>
          <li>Extended storage capacity</li>
          <li>Advanced analytics and reporting</li>
          <li>Priority customer support</li>
          ${data.subscriptionTier === 'max' ? '<li>Unlimited receipt processing</li><li>API access</li>' : ''}
        </ul>
      </div>
      `}

      <h3>Renew your subscription to:</h3>
      <ul>
        <li>✅ Restore all premium features</li>
        <li>✅ Keep your data and settings</li>
        <li>✅ Continue where you left off</li>
        <li>✅ Get priority support</li>
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.renewSubscriptionUrl}" class="cta-button">Renew Subscription</a>
        <br>
        <a href="${data.manageSubscriptionUrl}" class="secondary-button">Manage Account</a>
      </div>

      <p>If you have any questions about renewing your subscription or need help, please don't hesitate to contact our support team.</p>

      <p>We hope to have you back soon!</p>

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
${isInGracePeriod ? 'Grace Period Active' : 'Subscription Expired'}

Hi ${data.recipientName},

${isInGracePeriod 
  ? `Your Mataresit ${tierName} subscription expired on ${new Date(data.expiryDate).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}, but you still have time to renew without losing access.`
  : `Your Mataresit ${tierName} subscription expired on ${new Date(data.expiryDate).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}. Your account has been downgraded to the free tier.`
}

Subscription Details:
- Plan: Mataresit ${tierName}
- Expiry Date: ${new Date(data.expiryDate).toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}
${data.gracePeriodEndDate ? `- Grace Period Ends: ${new Date(data.gracePeriodEndDate).toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}` : ''}

${isInGracePeriod 
  ? `You're currently in a grace period, which means you still have access to all your ${tierName} features. However, this won't last forever.`
  : `Features No Longer Available:
- Increased receipt processing limits
- Extended storage capacity
- Advanced analytics and reporting
- Priority customer support
${data.subscriptionTier === 'max' ? '- Unlimited receipt processing\n- API access' : ''}`
}

Renew your subscription to:
- Restore all premium features
- Keep your data and settings
- Continue where you left off
- Get priority support

Renew Subscription: ${data.renewSubscriptionUrl}
Manage Account: ${data.manageSubscriptionUrl}

If you have any questions about renewing your subscription or need help, please don't hesitate to contact our support team.

We hope to have you back soon!

Best regards,
The Mataresit Team

© 2024 Mataresit. All rights reserved.
This is an automated billing notification. Please do not reply to this email.
  `;

  return { subject, html, text };
}

/**
 * Generate payment confirmation email
 */
export function generatePaymentConfirmationEmail(data: PaymentConfirmationEmailData): { subject: string; html: string; text: string } {
  const language = data.language || 'en';

  if (language === 'ms') {
    return generatePaymentConfirmationEmailMalay(data);
  }

  const tierName = data.subscriptionTier === 'pro' ? 'Pro' : 'Max';
  const intervalText = data.billingInterval === 'monthly' ? 'Monthly' : 'Annual';
  
  const subject = `Payment Confirmed - Mataresit ${tierName} Subscription`;

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
    .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .success-alert { background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 20px; margin: 20px 0; color: #155724; }
    .payment-summary { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #28a745; }
    .billing-item { display: flex; justify-content: space-between; margin: 8px 0; }
    .billing-item strong { color: #333; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .secondary-button { display: inline-block; background: #6c757d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-size: 14px; margin: 10px 5px 0 0; }
    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 12px; color: #6c757d; }
    .next-billing { background-color: #e7f3ff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #007bff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Payment Successful</h1>
    </div>
    <div class="content">
      <h2>Hi ${data.recipientName},</h2>
      
      <div class="success-alert">
        <h3>🎉 Thank you for your payment!</h3>
        <p>Your payment has been successfully processed and your Mataresit ${tierName} subscription is now active.</p>
      </div>
      
      <div class="payment-summary">
        <h3>💳 Payment Summary</h3>
        <div class="billing-item">
          <span>Subscription Plan:</span>
          <strong>Mataresit ${tierName} (${intervalText})</strong>
        </div>
        <div class="billing-item">
          <span>Amount Paid:</span>
          <strong>${data.currency.toUpperCase()} ${data.amount.toFixed(2)}</strong>
        </div>
        <div class="billing-item">
          <span>Billing Period:</span>
          <strong>${new Date(data.billingPeriodStart).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          })} - ${new Date(data.billingPeriodEnd).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          })}</strong>
        </div>
        ${data.paymentMethodLast4 ? `
        <div class="billing-item">
          <span>Payment Method:</span>
          <strong>${data.paymentMethodBrand || 'Card'} ending in ${data.paymentMethodLast4}</strong>
        </div>
        ` : ''}
      </div>

      <div class="next-billing">
        <h4>📅 Next Billing Date</h4>
        <p>Your next payment of <strong>${data.currency.toUpperCase()} ${data.amount.toFixed(2)}</strong> will be automatically charged on <strong>${new Date(data.nextBillingDate).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</strong>.</p>
      </div>

      <h3>What's included in your ${tierName} subscription:</h3>
      <ul>
        ${data.subscriptionTier === 'pro' ? `
        <li>✅ Process up to 500 receipts per month</li>
        <li>✅ 10GB of storage space</li>
        <li>✅ 90-day data retention</li>
        <li>✅ Advanced analytics and reporting</li>
        <li>✅ Priority customer support</li>
        <li>✅ Team collaboration features</li>
        ` : `
        <li>✅ Unlimited receipt processing</li>
        <li>✅ Unlimited storage space</li>
        <li>✅ 1-year data retention</li>
        <li>✅ Advanced analytics and reporting</li>
        <li>✅ Priority customer support</li>
        <li>✅ API access</li>
        <li>✅ Custom integrations</li>
        `}
      </ul>

      <div style="text-align: center; margin: 30px 0;">
        ${data.invoiceUrl ? `<a href="${data.invoiceUrl}" class="cta-button">Download Invoice</a><br>` : ''}
        <a href="${data.manageSubscriptionUrl}" class="secondary-button">Manage Subscription</a>
      </div>

      <p>If you have any questions about your subscription or need help getting started, please don't hesitate to contact our support team.</p>

      <p>Thank you for choosing Mataresit!</p>

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
Payment Successful

Hi ${data.recipientName},

Thank you for your payment! Your payment has been successfully processed and your Mataresit ${tierName} subscription is now active.

Payment Summary:
- Subscription Plan: Mataresit ${tierName} (${intervalText})
- Amount Paid: ${data.currency.toUpperCase()} ${data.amount.toFixed(2)}
- Billing Period: ${new Date(data.billingPeriodStart).toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'short', 
  day: 'numeric' 
})} - ${new Date(data.billingPeriodEnd).toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'short', 
  day: 'numeric' 
})}
${data.paymentMethodLast4 ? `- Payment Method: ${data.paymentMethodBrand || 'Card'} ending in ${data.paymentMethodLast4}` : ''}

Next Billing Date: Your next payment of ${data.currency.toUpperCase()} ${data.amount.toFixed(2)} will be automatically charged on ${new Date(data.nextBillingDate).toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}.

What's included in your ${tierName} subscription:
${data.subscriptionTier === 'pro' ? `
- Process up to 500 receipts per month
- 10GB of storage space
- 90-day data retention
- Advanced analytics and reporting
- Priority customer support
- Team collaboration features
` : `
- Unlimited receipt processing
- Unlimited storage space
- 1-year data retention
- Advanced analytics and reporting
- Priority customer support
- API access
- Custom integrations
`}

${data.invoiceUrl ? `Download Invoice: ${data.invoiceUrl}` : ''}
Manage Subscription: ${data.manageSubscriptionUrl}

If you have any questions about your subscription or need help getting started, please don't hesitate to contact our support team.

Thank you for choosing Mataresit!

Best regards,
The Mataresit Team

© 2024 Mataresit. All rights reserved.
This is an automated billing notification. Please do not reply to this email.
  `;

  return { subject, html, text };
}

// Malay Language Versions

/**
 * Generate billing reminder email in Malay
 */
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

/**
 * Generate payment failed email in Malay
 */
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
 * Generate subscription expiry email in Malay
 */
function generateSubscriptionExpiryEmailMalay(data: SubscriptionExpiryEmailData): { subject: string; html: string; text: string } {
  const tierName = data.subscriptionTier === 'pro' ? 'Pro' : 'Max';
  const isInGracePeriod = data.isInGracePeriod;

  const subject = isInGracePeriod
    ? `Tempoh Kelonggaran: Perbaharui Langganan Mataresit ${tierName} Anda`
    : `Langganan Mataresit ${tierName} Anda Telah Tamat Tempoh`;

  const text = `
${isInGracePeriod ? 'Tempoh Kelonggaran Aktif' : 'Langganan Tamat Tempoh'}

Hai ${data.recipientName},

${isInGracePeriod
  ? `Langganan Mataresit ${tierName} anda tamat tempoh pada ${new Date(data.expiryDate).toLocaleDateString('ms-MY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}, tetapi anda masih mempunyai masa untuk memperbaharui tanpa kehilangan akses.`
  : `Langganan Mataresit ${tierName} anda tamat tempoh pada ${new Date(data.expiryDate).toLocaleDateString('ms-MY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}. Akaun anda telah diturunkan taraf kepada peringkat percuma.`
}

Butiran Langganan:
- Pelan: Mataresit ${tierName}
- Tarikh Tamat Tempoh: ${new Date(data.expiryDate).toLocaleDateString('ms-MY', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}
${data.gracePeriodEndDate ? `- Tempoh Kelonggaran Berakhir: ${new Date(data.gracePeriodEndDate).toLocaleDateString('ms-MY', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}` : ''}

${isInGracePeriod
  ? `Anda kini berada dalam tempoh kelonggaran, yang bermaksud anda masih mempunyai akses kepada semua ciri ${tierName} anda. Walau bagaimanapun, ini tidak akan kekal selama-lamanya.`
  : `Ciri Yang Tidak Lagi Tersedia:
- Had pemprosesan resit yang meningkat
- Kapasiti storan yang diperluas
- Analitik dan pelaporan lanjutan
- Sokongan pelanggan keutamaan
${data.subscriptionTier === 'max' ? '- Pemprosesan resit tanpa had\n- Akses API' : ''}`
}

Perbaharui langganan anda untuk:
- Memulihkan semua ciri premium
- Mengekalkan data dan tetapan anda
- Meneruskan dari tempat anda berhenti
- Mendapat sokongan keutamaan

Perbaharui Langganan: ${data.renewSubscriptionUrl}
Urus Akaun: ${data.manageSubscriptionUrl}

Jika anda mempunyai sebarang soalan mengenai pembaharuan langganan anda atau memerlukan bantuan, sila jangan teragak-agak untuk menghubungi pasukan sokongan kami.

Kami berharap dapat menyambut anda kembali tidak lama lagi!

Salam hormat,
Pasukan Mataresit

© 2024 Mataresit. Hak cipta terpelihara.
Ini adalah pemberitahuan pengebilan automatik. Sila jangan balas e-mel ini.
  `;

  return { subject, html: '', text }; // Simplified HTML for space
}

/**
 * Generate payment confirmation email in Malay
 */
function generatePaymentConfirmationEmailMalay(data: PaymentConfirmationEmailData): { subject: string; html: string; text: string } {
  const tierName = data.subscriptionTier === 'pro' ? 'Pro' : 'Max';
  const intervalText = data.billingInterval === 'monthly' ? 'Bulanan' : 'Tahunan';

  const subject = `Pembayaran Disahkan - Langganan Mataresit ${tierName}`;

  const text = `
Pembayaran Berjaya

Hai ${data.recipientName},

Terima kasih atas pembayaran anda! Pembayaran anda telah berjaya diproses dan langganan Mataresit ${tierName} anda kini aktif.

Ringkasan Pembayaran:
- Pelan Langganan: Mataresit ${tierName} (${intervalText})
- Jumlah Dibayar: ${data.currency.toUpperCase()} ${data.amount.toFixed(2)}
- Tempoh Pengebilan: ${new Date(data.billingPeriodStart).toLocaleDateString('ms-MY', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})} - ${new Date(data.billingPeriodEnd).toLocaleDateString('ms-MY', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})}
${data.paymentMethodLast4 ? `- Kaedah Pembayaran: ${data.paymentMethodBrand || 'Kad'} berakhir dengan ${data.paymentMethodLast4}` : ''}

Tarikh Pengebilan Seterusnya: Pembayaran seterusnya sebanyak ${data.currency.toUpperCase()} ${data.amount.toFixed(2)} akan dikenakan caj secara automatik pada ${new Date(data.nextBillingDate).toLocaleDateString('ms-MY', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}.

Apa yang disertakan dalam langganan ${tierName} anda:
${data.subscriptionTier === 'pro' ? `
- Proses sehingga 500 resit sebulan
- Ruang storan 10GB
- Pengekalan data 90 hari
- Analitik dan pelaporan lanjutan
- Sokongan pelanggan keutamaan
- Ciri kerjasama pasukan
` : `
- Pemprosesan resit tanpa had
- Ruang storan tanpa had
- Pengekalan data 1 tahun
- Analitik dan pelaporan lanjutan
- Sokongan pelanggan keutamaan
- Akses API
- Integrasi tersuai
`}

${data.invoiceUrl ? `Muat Turun Invois: ${data.invoiceUrl}` : ''}
Urus Langganan: ${data.manageSubscriptionUrl}

Jika anda mempunyai sebarang soalan mengenai langganan anda atau memerlukan bantuan untuk bermula, sila jangan teragak-agak untuk menghubungi pasukan sokongan kami.

Terima kasih kerana memilih Mataresit!

Salam hormat,
Pasukan Mataresit

© 2024 Mataresit. Hak cipta terpelihara.
Ini adalah pemberitahuan pengebilan automatik. Sila jangan balas e-mel ini.
  `;

  return { subject, html: '', text }; // Simplified HTML for space
}
