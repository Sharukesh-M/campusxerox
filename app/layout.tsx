import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusXerox — Upload. Pay. Collect.",
  description:
    "Skip the queue at your college Xerox shop. Upload your PDF, choose printing options, pay online, and collect when ready.",
  keywords: ["xerox", "print", "college", "campus", "pdf", "photocopy"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-surface-50 antialiased">
        {children}
      </body>
    </html>
  );
}
