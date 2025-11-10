import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@primer/css/dist/primer.css";
import "./globals.css";
import { DataProvider } from "@/context/DataProviderContext";
import { PortfolioProvider } from "@/context/PortfolioContext";

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
          <PortfolioProvider>{children}</PortfolioProvider>
        </DataProvider>
      </body>
    </html>
  );
}
