export default function CryptoTable() {
  return (
    <div className="card">
      <div className="card-header">
        <h2>실시간 시세</h2>
      </div>
      <div className="card-body">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>자산</th>
              <th>가격 (KRW)</th>
              <th>24시간 변동</th>
              <th>거래</th>
            </tr>
          </thead>
          <tbody>
            {/* API로부터 받은 데이터가 여기에 표시됩니다 */}
            <tr>
              <td>Bitcoin (BTC)</td>
              <td>-</td>
              <td>-</td>
              <td><button className="btn btn-primary btn-sm">거래</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
