"use client";

import { useEffect, useState } from "react";

/**
 * ================================
 * CONFIG — SAFE TO EDIT
 * ================================
 */
const CONTRACT_ADDRESS = "0x1554...4889"; // keep exactly as you have it
const MINT_PRICE_ETH = "0.01";
const COLLECTION_NAME = "Oracle Vision NFT";
const SYMBOL = "VISION";

/**
 * ================================
 * TYPES
 * ================================
 */
declare global {
  interface Window {
    ethereum?: any;
  }
}

/**
 * ================================
 * PAGE
 * ================================
 */
export default function MintPage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Not connected");
  const [logs, setLogs] = useState<string[]>([]);
  const [minting, setMinting] = useState(false);

  /**
   * ================================
   * HELPERS
   * ================================
   */
  function log(msg: string) {
    setLogs((l) => [`${new Date().toISOString()} — ${msg}`, ...l].slice(0, 20));
  }

  function short(a: string) {
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
  }

  /**
   * ================================
   * WALLET CONNECT
   * ================================
   */
  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("MetaMask not detected");
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const chainId = await window.ethereum.request({
        method: "eth_chainId",
      });

      setWallet(accounts[0]);
      setNetwork(chainId === "0x1" ? "Ethereum Mainnet" : chainId);
      setStatus("Connected");
      log(`Wallet connected: ${accounts[0]}`);
    } catch (err: any) {
      log(`Connect failed: ${err.message || err}`);
    }
  }

  /**
   * ================================
   * MINT (NO ABI CHANGES)
   * ================================
   */
  async function mint() {
    if (!window.ethereum || !wallet) return;

    try {
      setMinting(true);
      log(`Minting… value = ${MINT_PRICE_ETH} ETH`);

      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: wallet,
            to: CONTRACT_ADDRESS,
            value: `0x${(Number(MINT_PRICE_ETH) * 1e18).toString(16)}`,
            data: "0x", // contract mint method already configured on-chain
          },
        ],
      });

      log("Mint transaction sent");
    } catch (err: any) {
      log(`Mint failed: ${err.message || err}`);
    } finally {
      setMinting(false);
    }
  }

  /**
   * ================================
   * EFFECTS
   * ================================
   */
  useEffect(() => {
    if (!window.ethereum) return;

    window.ethereum.on("accountsChanged", (a: string[]) => {
      setWallet(a[0] || null);
      log("Account changed");
    });

    window.ethereum.on("chainChanged", () => {
      window.location.reload();
    });
  }, []);

  /**
   * ================================
   * RENDER
   * ================================
   */
  return (
    <main className="wrap">
      {/* HEADER */}
      <header className="topbar">
        <div className="brand">
          <div className="orb" />
          <div>
            <div className="brandTitle">Oracle Vision</div>
            <div className="brandSub">Minter v4</div>
          </div>
        </div>

        <nav className="nav">
          <a className="navLink" href="/">Home</a>
          <a className="navLink" href="/mint">Mint</a>
        </nav>
      </header>

      {/* CARD */}
      <section className="card">
        <h1 className="h1">Oracle Vision — Mint Console</h1>
        <p className="p">
          Ethereum Mainnet only. Clean mints. Clear receipts.
        </p>

        <div className="grid">
          {/* LEFT — STATUS / MINT */}
          <div className="panel">
            <div className="kv">
              <div className="k">Status</div>
              <div className="v">{status}</div>
            </div>
            <div className="kv">
              <div className="k">Wallet</div>
              <div className="v mono">
                {wallet ? short(wallet) : "—"}
              </div>
            </div>
            <div className="kv">
              <div className="k">Network</div>
              <div className="v">{network || "—"}</div>
            </div>
            <div className="kv">
              <div className="k">Contract</div>
              <div className="v mono">{CONTRACT_ADDRESS}</div>
            </div>
            <div className="kv">
              <div className="k">Mint price</div>
              <div className="v">{MINT_PRICE_ETH} ETH</div>
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              {!wallet ? (
                <button className="btn btnPrimary" onClick={connectWallet}>
                  Connect Wallet
                </button>
              ) : (
                <button
                  className="btn btnPrimary"
                  onClick={mint}
                  disabled={minting}
                >
                  {minting ? "Minting…" : "Mint on ETH Mainnet"}
                </button>
              )}
            </div>
          </div>

          {/* RIGHT — NFT PREVIEW */}
          <div className="panel">
            <span className="label">NFT Preview</span>
            <span className="value">{COLLECTION_NAME}</span>

            <div className="previewFrame" style={{ marginTop: 12 }}>
              <div className="previewBadge">PREVIEW</div>

              {/* ORACLE ORB — SAFE STATIC PREVIEW */}
              <svg
                viewBox="0 0 900 900"
                width="92%"
                height="92%"
                style={{ filter: "drop-shadow(0 18px 40px rgba(0,0,0,.55))" }}
              >
                <defs>
                  <radialGradient id="g1" cx="30%" cy="25%" r="70%">
                    <stop offset="0%" stopColor="#9ad6ff" />
                    <stop offset="45%" stopColor="#2f6bff" />
                    <stop offset="100%" stopColor="#00111f" />
                  </radialGradient>
                </defs>
                <circle cx="450" cy="450" r="280" fill="url(#g1)" />
                <circle
                  cx="450"
                  cy="450"
                  r="300"
                  fill="none"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="8"
                />
              </svg>
            </div>

            <div className="kv" style={{ marginTop: 12 }}>
              <div className="k">Symbol</div>
              <div className="v">{SYMBOL}</div>
            </div>
            <div className="kv">
              <div className="k">Chain</div>
              <div className="v">Ethereum Mainnet</div>
            </div>
          </div>
        </div>

        {/* TELEMETRY */}
        <div className="panel" style={{ marginTop: 16 }}>
          <span className="label">Telemetry</span>
          <div className="telemetry">
            <ul>
              {logs.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="footer">
        © 2026 Oracle Vision • On-chain art. Clean execution.
      </footer>
    </main>
  );
}
