/**
 * Order service — generates order codes and manages order operations.
 */

// Characters that are easy to read and tell verbally
// Excluded: 0, O, 1, I, L (confusable)
const ORDER_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a sequential daily order code starting at #101 (e.g. "#101", "#102").
 * Resets every 24 hours.
 */
export function generateDailyOrderCode(seqNumber: number): string {
  const num = 100 + seqNumber;
  return `#${num}`;
}

export function generateOrderCode(): string {
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `#${randomNum}`;
}

/**
 * Valid order status transitions.
 * Supports simplified 2-step admin workflow:
 * PENDING -> ACCEPTED -> COMPLETED (Done)
 * Plus CANCELLED at any active stage.
 */
export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  PAYMENT_SUBMITTED: ['ACCEPTED', 'COMPLETED', 'CANCELLED', 'REJECTED'],
  ACCEPTED: ['COMPLETED', 'READY_FOR_PICKUP', 'PRINTING', 'CANCELLED'],
  PRINTING: ['COMPLETED', 'READY_FOR_PICKUP', 'CANCELLED'],
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
  PAYMENT_SUBMITTED: 'Pending Acceptance',
  ACCEPTED: 'Accepted & Printing',
  PRINTING: 'Printing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  COMPLETED: 'Done (Ready for Pickup)',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAYMENT_SUBMITTED: 'Pending Verification',
  PAYMENT_VERIFIED: 'Payment Verified',
  PAYMENT_REJECTED: 'Payment Rejected',
};

