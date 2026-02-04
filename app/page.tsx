export default function Page() {
  return (
    <div className="grid">
      <section className="card">
        <h1 className="h1">Oracle Vision — v4</h1>
        <p className="p">
          This is the clean-room build of the Oracle Vision minter. No noise, no detours.
          One commit at a time — and we ship.
        </p>

        <div className="kpis">
          <div className="kpi">
            <div className="label">Status</div>
            <div className="value">BUILDING</div>
          </div>
          <div className="kpi">
            <div className="label">Web3</div>
            <div className="value">NEXT COMMIT</div>
          </div>
          <div className="kpi">
            <div className="label">Version</div>
            <div className="value">v4.0</div>
          </div>
        </div>

        <div className="btnRow">
          <a className="btn btnPrimary" href="/mint">⚡ Go to Mint</a>
          <a className="btn" href="#roadmap">🧭 Roadmap</a>
        </div>

        <div id="roadmap" className="hr" />

        <p className="p">
          Roadmap: Wallet connect → choose network → contract config → mint button →
          receipts + explorer link → polish.
        </p>
      </section>

      <aside className="card">
        <div className="title">Today’s Rule</div>
        <p className="p" style={{ marginTop: 8 }}>
          We do not “finish the whole app” today.
          We create a stable foundation that never breaks.
        </p>

        <div className="hr" />

        <div className="title">Next Commit</div>
        <p className="p" style={{ marginTop: 8 }}>
          Add wallet connect (MetaMask) and show address + network chip.
        </p>
      </aside>
    </div>
  );
}
