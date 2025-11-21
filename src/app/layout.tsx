import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "@primer/css/dist/primer.css";
import "./globals.css";
import { DataProvider } from "@/context/DataProviderContext";
import { PortfolioProvider } from "@/context/PortfolioContext";
import { NewsProvider } from "@/context/NewsContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Crypto Invest Sim",
  description: "A cryptocurrency investment simulator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-color-mode="dark">
      <body className={inter.className}>
        <DataProvider>
          <NewsProvider>
            <PortfolioProvider>
              {children}
              <Toaster position="top-right" />
            </PortfolioProvider>
          </NewsProvider>
        </DataProvider>
      </body>
    </html>
  );
}
