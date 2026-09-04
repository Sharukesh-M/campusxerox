/**
 * Order service — generates order codes and manages order operations.
 */

// Characters that are easy to read and tell verbally
// Excluded: 0, O, 1, I, L (confusable)
const ORDER_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a sequential daily order code like "XR-001", "XR-002".
 * Resets every 24 hours.
 */
export function generateDailyOrderCode(seqNumber: number): string {
  return `XR-${String(seqNumber).padStart(3, '0')}`;
}

export function generateOrderCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * ORDER_CHARS.length);
    code += ORDER_CHARS[randomIndex];
  }
  return `XR-${code}`;
}

/**
 * Valid order status transitions.
 * Maps current status to allowed next statuses.
 */
export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  PAYMENT_SUBMITTED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED', 'PRINTING'],
  PRINTING: ['READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Check if a status transition is valid.
 */
export function isValidStatusTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(newStatus) : false;
}

/**
 * Calculate expiry date for a new order.
 * Default: retention days from settings (or 7 days).
 */
export function calculateExpiryDate(retentionDays: number = 7): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + retentionDays);
  return expiry.toISOString();
}

/**
 * Human-readable order status labels.
 */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PAYMENT_SUBMITTED: 'Payment Submitted',
  ACCEPTED: 'Order Accepted',
  PRINTING: 'Printing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAYMENT_SUBMITTED: 'Pending Verification',
  PAYMENT_VERIFIED: 'Payment Verified',
  PAYMENT_REJECTED: 'Payment Rejected',
};
