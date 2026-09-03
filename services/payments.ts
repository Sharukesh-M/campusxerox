/**
 * Payment service — clean interface for payment operations.
 * Currently implements manual UPI/bank transfer verification.
 * Designed so a gateway (e.g. Razorpay) can be plugged in later.
 */

export interface PaymentResult {
  success: boolean;
  paymentStatus: string;
  error?: string;
}

export interface PaymentService {
  submitProof(
    orderId: string,
    screenshotPath: string,
    utrNumber: string
  ): Promise<PaymentResult>;

  verifyPayment(orderId: string, adminId: string): Promise<PaymentResult>;

  rejectPayment(
    orderId: string,
    adminId: string,
    reason: string
  ): Promise<PaymentResult>;
}

/**
 * Normalize a UTR string for comparison.
 * Strips spaces, non-alphanumeric chars, and uppercases.
 */
export function normalizeUtr(utr: string): string {
  return utr.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Compare student-entered UTR with OCR-extracted UTR.
 */
export function compareUtrs(
  enteredUtr: string,
  ocrUtr: string | null
): 'MATCH' | 'MISMATCH' | 'OCR_FAILED' {
  if (!ocrUtr) return 'OCR_FAILED';

  const normalizedEntered = normalizeUtr(enteredUtr);
  const normalizedOcr = normalizeUtr(ocrUtr);

  if (!normalizedEntered || !normalizedOcr) return 'OCR_FAILED';

  return normalizedEntered === normalizedOcr ? 'MATCH' : 'MISMATCH';
}
