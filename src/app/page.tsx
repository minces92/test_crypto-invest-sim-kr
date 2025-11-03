import Header from "@/components/Header";
import Portfolio from "@/components/Portfolio";
import CryptoTable from "@/components/CryptoTable";

export default function Home() {
  return (
    <>
      <Header />
      <main className="container">
        <div className="row">
          <div className="col-md-4">
            <Portfolio />
          </div>
          <div className="col-md-8">
            <CryptoTable />
          </div>
        </div>
      </main>
    </>
  );
}
