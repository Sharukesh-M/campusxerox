// ============================================================
// CampusXerox — Type Definitions
// ============================================================

// ---- Enums ----

export enum ColorMode {
  BW = 'BW',
  COLOR = 'COLOR',
  CUSTOM_PAGES = 'CUSTOM_PAGES',
}

export enum Side {
  SINGLE = 'SINGLE',
  BOTH = 'BOTH',
}

export enum PagesPerSheet {
  ONE = 1,
  TWO = 2,
}

export enum BindingType {
  NONE = 'NONE',
  SOFT = 'SOFT',
  SPIRAL = 'SPIRAL',
}

export enum PaymentStatus {
  SUBMITTED = 'PAYMENT_SUBMITTED',
  VERIFIED = 'PAYMENT_VERIFIED',
  REJECTED = 'PAYMENT_REJECTED',
}

export enum OrderStatus {
  PAYMENT_SUBMITTED = 'PAYMENT_SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  PRINTING = 'PRINTING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum UtrMatchStatus {
  MATCH = 'MATCH',
  MISMATCH = 'MISMATCH',
  OCR_FAILED = 'OCR_FAILED',
  NOT_CHECKED = 'NOT_CHECKED',
}

// ---- Interfaces ----

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
  created_at: string;
}

export interface PdfDocumentConfig {
  filePath: string;
  fileName: string;
  pageCount: number;
  fileSize: number;

  // Per-PDF specific print & binding configuration
  colorMode: ColorMode;
  customColorPages?: string;
  side: Side;
  pagesPerSheet: number;
  copies: number;
  bindingType: BindingType;
}

export type PdfDocumentItem = PdfDocumentConfig;

export interface Order {
  id: string;
  order_code: string;
  user_id: string;

  // Student contact info for order
  student_name: string;
  phone_number: string;

  // Multi-file info with individual per-PDF configurations
  files: PdfDocumentConfig[];
  file_path: string | null;
  file_name: string | null;
  page_count: number;

  // Summary configuration (from first or overall)
  color_mode: ColorMode;
  custom_color_pages: string | null;
  side: Side;
  pages_per_sheet: number;
  copies: number;
  binding_type: BindingType;
  binding_cost: number;

  // Pricing (snapshotted at order time)
  printing_subtotal: number;
  total_amount: number;
  price_snapshot: PricingSettings | null;

  // Payment proof
  payment_screenshot_path: string | null;
  utr_number: string | null;
  ocr_extracted_utr: string | null;
  utr_match_status: UtrMatchStatus;

  // Statuses
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  rejection_reason: string | null;

  // Timestamps
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  receipt_path: string | null;

  // Joined data (optional)
  profiles?: Pick<Profile, 'name' | 'email'>;
}

export interface PricingSettings {
  id: string;
  bw_single_side: number;
  bw_both_side: number;
  bw_two_pages_sheet: number;
  bw_four_pages_sheet: number;
  color_per_page: number;
  soft_binding_cost: number;
  upi_id: string | null;
  upi_qr_image_path: string | null;
  bank_details: string | null;
  file_retention_days: number;
  shop_open: boolean;
  opening_time: string;
  closing_time: string;
  shop_status_message: string | null;
  updated_at: string;
}

export interface PrintConfig {
  pageCount: number;
  colorMode: ColorMode;
  customColorPages?: string;
  side: Side;
  pagesPerSheet: number;
  copies: number;
  bindingType: BindingType;
}

export interface PriceBreakdown {
  physicalSheets: number;
  pricePerUnit: number;
  colorPagesCount: number;
  bwPagesCount: number;
  printingSubtotal: number;
  bindingCost: number;
  totalAmount: number;
}

// ---- API Types ----

export interface CreateOrderPayload {
  studentName: string;
  phoneNumber: string;
  files: PdfDocumentConfig[];
  colorMode?: ColorMode;
  side?: Side;
  pagesPerSheet?: number;
  copies?: number;
  bindingType?: BindingType;
}

export interface SubmitPaymentPayload {
  screenshotPath: string;
  utrNumber: string;
}

export interface UpdateStatusPayload {
  status: OrderStatus;
  reason?: string;
}

export interface UpdatePaymentPayload {
  action: 'verify' | 'reject';
  reason?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
