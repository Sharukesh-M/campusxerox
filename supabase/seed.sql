-- ============================================================
-- CampusXerox — Seed Data (Default Pricing & Shop Settings)
-- Run after schema.sql
-- ============================================================

INSERT INTO pricing_settings (
  bw_single_side,
  bw_both_side,
  bw_two_pages_sheet,
  bw_four_pages_sheet,
  color_per_page,
  soft_binding_cost,
  upi_id,
  bank_details,
  file_retention_days,
  shop_open,
  opening_time,
  closing_time,
  shop_status_message
) VALUES (
  1.20,   -- B&W single side per page
  1.20,   -- B&W both side per page/side
  1.20,   -- B&W 2 pages per sheet
  1.20,   -- B&W 4 pages per sheet
  10.00,  -- Color per page
  20.00,  -- Soft binding cost (+₹20)
  'surya2092005-1@oksbi',  -- UPI ID
  'Account Name: Surya R\nUPI ID: surya2092005-1@oksbi\nPhone / GPay: 8015587361',
  7,       -- File retention days
  true,    -- Shop open by default
  '08:00',
  '20:00',
  'Shop is currently closed. Opening hours: 08:00 AM to 08:00 PM.'
)
ON CONFLICT DO NOTHING;

-- Update existing pricing row if already inserted
UPDATE pricing_settings
SET upi_id = 'surya2092005-1@oksbi',
    bank_details = 'Account Name: Surya R\nUPI ID: surya2092005-1@oksbi\nPhone / GPay: 8015587361';
