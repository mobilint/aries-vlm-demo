import type { Metadata } from "next";
import "./globals.css";

import CssBaseline from "@mui/material/CssBaseline";

export const metadata: Metadata = {
  title: "Mobilint, Inc. ARIES VLM Demo",
  description: "Mobilint, Inc. ARIES VLM Demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="emotion-insertion-point" content="" />
      </head>
      <CssBaseline />
      <body style={{backgroundColor: "#111111"}}>
        {children}
      </body>
    </html>
  );
}
