import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { PortfolioProvider } from "@/contexts/portfolio-context";
import { Toaster } from "@/components/ui/sonner";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "CapitalForge - Portfolio Capital Deployment System",
  description: "Rule-based capital allocation and dip-buy strategy engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${dmSerif.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <PortfolioProvider>
              {children}
              <Toaster position="top-right" richColors />
            </PortfolioProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
