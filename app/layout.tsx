import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Hackers Global — Free Email Course",
  description:
    "Land a job you love, at the salary you deserve, in the AI era. A free email course from Job Hackers Global.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Brand design tokens + local fonts (Poppins/Roboto) */}
        <link rel="stylesheet" href="/brand/colors_and_type.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
