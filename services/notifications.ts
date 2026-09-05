/**
 * Notification service — handles 1-click WhatsApp messaging and notification URLs.
 */

/**
 * Format a Indian phone number for WhatsApp link (e.g. "9876543210" -> "919876543210").
 */
export function formatWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Generate a direct WhatsApp Web URL for sending an order completion receipt to student.
 */
export function generateWhatsAppReceiptUrl(
  phone: string,
  orderCode: string,
  studentName: string,
  totalAmount: number,
  receiptDownloadUrl?: string
): string {
  const formattedPhone = formatWhatsAppPhone(phone);

  let message = `Hi ${studentName}!\n\nYour print order *#${orderCode}* at CampusXerox has been completed.\n\nTotal Paid: ₹${totalAmount.toFixed(2)}`;

  if (receiptDownloadUrl) {
    message += `\n\nDownload your receipt here:\n${receiptDownloadUrl}`;
  }

  message += `\n\nThank you for printing with CampusXerox!`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generate a direct WhatsApp Web URL for notifying student that their order is ready for pickup.
 */
export function generateWhatsAppReadyUrl(
  phone: string,
  orderCode: string,
  studentName: string
): string {
  const formattedPhone = formatWhatsAppPhone(phone);

  const message = `Hi ${studentName}!\n\nYour print order *#${orderCode}* is READY FOR PICKUP at the Campus Xerox shop.\n\nPlease show Order ID *#${orderCode}* at the counter.`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generate a broadcast announcement message for shop opening.
 */
export function generateShopOpenedMessage(openingTime: string, closingTime: string): string {
  return `CampusXerox is NOW OPEN!\n\nWe are open today from ${openingTime} to ${closingTime}. Upload your PDFs and skip the queue!`;
}

/**
 * Send instant mobile push notification to admin via ntfy.sh (100% Free).
 */
export async function sendAdminNtfyNotification({
  title,
  message,
  orderCode,
  priority = 'high',
  tags = ['print', 'order'],
}: {
  title: string;
  message: string;
  orderCode?: string;
  priority?: 'low' | 'default' | 'high' | 'urgent';
  tags?: string[];
}) {
  const topic = process.env.NTFY_TOPIC || 'campus_xerox_admin_2027';
  try {
    const headers: Record<string, string> = {
      'Title': title,
      'Priority': priority,
      'Tags': tags.join(','),
    };

    if (orderCode) {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      headers['Click'] = `${origin}/admin/orders/${orderCode}`;
    }

    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers,
      body: message,
    });
  } catch (err) {
    console.error('ntfy admin push notification failed:', err);
  }
}
