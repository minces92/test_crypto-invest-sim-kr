import Header from "@/components/Header";
import Portfolio from "@/components/Portfolio";
import CryptoTable from "@/components/CryptoTable";
import TransactionHistory from "@/components/TransactionHistory";
import AutoTrader from "@/components/AutoTrader";

export default function Home() {
  return (
    <>
      <Header />
      <div className="container-lg p-responsive py-4">
        <div className="d-flex flex-wrap gutter-spacious">
          <div className="col-12 col-lg-12 mb-4">
            <CryptoTable />
            <TransactionHistory />
          </div>
          <div className="col-12 col-lg-12 mb-4">
            <Portfolio />
            <AutoTrader />
          </div>
        </div>
      </div>
    </>
  );
}
