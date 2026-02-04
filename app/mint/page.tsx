export default function MintPage() {
  return (
    <div className="card">
      <h1 className="h1">Mint Oracle Vision</h1>
      <p className="p">
        This page will become the mint console.
        Next commit adds wallet connect and a live “connected” status.
      </p>

      <div className="hr" />

      <div className="kpis">
        <div className="kpi">
          <div className="label">Wallet</div>
          <div className="value">Not Connected</div>
        </div>
        <div className="kpi">
          <div className="label">Network</div>
          <div className="value">—</div>
        </div>
        <div className="kpi">
          <div className="label">Mint</div>
          <div className="value">Locked</div>
        </div>
      </div>

      <div className="btnRow">
        <a className="btn" href="/">← Back</a>
      </div>
    </div>
  );
}
