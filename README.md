# CampusXerox

**Upload. Pay. Collect.**

CampusXerox is a mobile-first web application for college students to upload PDF documents, configure printing options, pay via UPI/bank transfer, and collect printed documents from the campus Xerox shop.

## Features

### For Students
- Upload PDF with automatic page count detection
- Configure printing: B&W/Color, Single/Both sides, 1/2/4 pages per sheet, copies
- Live price estimation
- Manual payment via UPI/bank transfer
- Upload payment screenshot + UTR for verification
- Track order status in real-time
- Download receipt on completion

### For Admin (Xerox Shop)
- Dashboard with live order stats
- Clear, unambiguous printing instructions per order
- Payment verification with automated UTR matching (OCR)
- Sequential order workflow: Verify → Accept → Print → Ready → Complete
- Configurable pricing and payment details
- Automatic cleanup of expired files

## Tech Stack

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS v4
- **Backend**: Next.js API routes
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (private buckets)
- **OCR**: GLM-4V vision API (optional)
- **Deployment**: Vercel

## Quick Start

```bash
npm install
cp .env.example .env.local
# Fill in your Supabase credentials
npm run dev
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full setup guide.

## License

MIT
