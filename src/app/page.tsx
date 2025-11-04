import Header from "@/components/Header";
import Portfolio from "@/components/Portfolio";
import CryptoTable from "@/components/CryptoTable";
import TransactionHistory from "@/components/TransactionHistory";
import AutoTrader from "@/components/AutoTrader";

export default function Home() {
  return (
    <>
      <Header />
      <div className="PageLayout container-xl">
        <div className="PageLayout-main">
          <CryptoTable />
          <TransactionHistory />
        </div>
        <div className="PageLayout-pane">
          <Portfolio />
          <AutoTrader />
        </div>
      </div>
    </>
  );
}
