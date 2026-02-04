"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const CONTRACT = "0x15545833cFCe7579D967D02A1183114d7e554889";
const MINT_PRICE_ETH = 0.01;

const ABI = [
  "function mint() payable",
  "function MINT_PRICE() view returns (uint256)",
];

function shortAddr(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
}

async function safeCopy(t: string) {
  try {
    await navigator.clipboard.writeText(t);
  } catch {}
}

export default function MintPage() {
  const [hasProvider, setHasProvider] = useState(false);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<string>("");
  const [status, setStatus] = useState<string>("Idle");
  const [busy, setBusy] = useState(false);

  const isMainnet = chainId === "0x1";
  const connected = !!account;

  useEffect(() => {
    const eth = window.ethereum;
    setHasProvider(!!eth);

    if (!eth) return;

    // Load initial state
    (async () => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        if (accounts?.[0]) setAccount(accounts[0]);
        const cid = (await eth.request({ method: "eth_chainId" })) as string;
        setChainId(cid);
      } catch {}
    })();

    const onAccounts = (accs: string[]) => setAccount(accs?.[0] || "");
    const onChain = (cid: string) => setChainId(cid);

    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);

    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  async function connect() {
    const eth = window.ethereum;
    if (!eth) return;

    setBusy(true);
    setStatus("Connecting…");
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(accounts?.[0] || "");
      const cid = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(cid);
      setStatus("Connected");
    } catch (e: any) {
      setStatus(e?.message || "Connect cancelled");
    } finally {
      setBusy(false);
    }
  }

  async function switchToMainnet() {
    const eth = window.ethereum;
    if (!eth) return;

    setBusy(true);
    setStatus("Switching network…");
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }],
      });
      setStatus("Ethereum Mainnet");
    } catch (e: any) {
      setStatus(e?.message || "Couldn’t switch network");
    } finally {
      setBusy(false);
    }
  }

  async function mint() {
    if (!window.ethereum) return;
    if (!connected) {
      setStatus("Connect wallet first");
      return;
    }
    if (!isMainnet) {
      setStatus("Switch to Ethereum Mainnet");
      return;
    }

    setBusy(true);
    setStatus("Preparing mint…");

    try {
      // lazy-load ethers to keep bundle light
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const nft = new ethers.Contract(CONTRACT, ABI, signer);

      setStatus("Awaiting signature…");
      const tx = await nft.mint({
        value: ethers.parseEther(String(MINT_PRICE_ETH)),
      });

      setStatus("Broadcasted…");
      await tx.wait();
      setStatus("Mint confirmed ✅");
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "Mint failed");
    } finally {
      setBusy(false);
    }
  }

  const contractLink = useMemo(
    () => `https://etherscan.io/address/${CONTRACT}`,
    []
  );
  const txLink = useMemo(
    () => `https://etherscan.io/address/${CONTRACT}#writeContract`,
    []
  );

  return (
    <div className="appShell">
      {/* TOP BAR */}
      <header className="topBar">
        <div className="brandRow">
          <div className="brandMark" aria-hidden />
          <div className="brandText">
            <div className="brandTitle">Oracle Vision</div>
            <div className="brandSub">Mint Console · Ethereum Mainnet</div>
          </div>
        </div>

        <nav className="topNav">
          <Link className="navChip" href="/">Home</Link>
          <span className="navChip active">Mint</span>
        </nav>
      </header>

      {/* HERO */}
      <section className="heroPanel">
        <div className="heroGlow" aria-hidden />
        <h1 className="heroTitle">Mint Console</h1>
        <p className="heroLead">
          Clean mints. Clear receipts. Prestige-only execution.
        </p>

        <div className="pillRow">
          <span className={`pill ${connected ? "ok" : "warn"}`}>
            {connected ? `Connected · ${shortAddr(account)}` : "Not connected"}
          </span>
          <span className={`pill ${hasProvider ? "ok" : "warn"}`}>
            {hasProvider ? "MetaMask detected" : "No wallet detected"}
          </span>
          <span className={`pill ${isMainnet ? "ok" : "warn"}`}>
            {isMainnet ? "Ethereum Mainnet" : chainId ? `Chain ${chainId}` : "Network —"}
          </span>
        </div>
      </section>

      {/* CONTENT GRID */}
      <main className="grid">
        {/* LEFT: MINT CONTROL */}
        <section className="card">
          <div className="cardHead">
            <div className="cardTitle">Mint Controls</div>
            <div className="cardHint">Contract + pricing locked</div>
          </div>

          <div className="cardBody">
            <div className="kv">
              <div className="k">Contract</div>
              <div className="v mono">{shortAddr(CONTRACT)}</div>
              <button className="miniBtn" onClick={() => safeCopy(CONTRACT)}>Copy</button>
              <a className="miniBtn" href={contractLink} target="_blank" rel="noreferrer">
                Etherscan
              </a>
            </div>

            <div className="kv">
              <div className="k">Mint price</div>
              <div className="v mono">{MINT_PRICE_ETH} ETH</div>
              <div className="tag">Mainnet</div>
            </div>

            <div className="kv">
              <div className="k">Status</div>
              <div className="v">{status}</div>
            </div>

            <div className="ctaRow">
              {!hasProvider ? (
                <a className="btn primary" href="https://metamask.io/" target="_blank" rel="noreferrer">
                  Install MetaMask
                </a>
              ) : !connected ? (
                <button className="btn primary" onClick={connect} disabled={busy}>
                  {busy ? "Connecting…" : "Connect Wallet"}
                </button>
              ) : !isMainnet ? (
                <button className="btn primary" onClick={switchToMainnet} disabled={busy}>
                  {busy ? "Switching…" : "Switch to Mainnet"}
                </button>
              ) : (
                <button className="btn primary pulse" onClick={mint} disabled={busy}>
                  {busy ? "Minting…" : "Mint Now"}
                </button>
              )}

              <button
                className="btn ghost"
                onClick={() => safeCopy(account || "")}
                disabled={!account}
                title="Copy connected wallet"
              >
                Copy Wallet
              </button>
            </div>

            <div className="note">
              Best mobile results: open inside the <b>MetaMask browser</b>.
              <span className="noteDim"> (Normal Chrome won’t inject the provider.)</span>
            </div>

            <a className="smallLink" href={txLink} target="_blank" rel="noreferrer">
              Advanced: write contract / receipts →
            </a>
          </div>
        </section>

        {/* RIGHT: NFT PREVIEW */}
        <section className="card">
          <div className="cardHead">
            <div className="cardTitle">NFT Preview</div>
            <div className="cardHint">Vision Chamber</div>
          </div>

          <div className="cardBody">
            <div className="chamber">
              <div className="chamberScan" aria-hidden />
              <div className="orb" aria-hidden />
              <div className="chamberLabel">ORACLE VISION NFT</div>
              <div className="chamberSub">Animated preview · clean frame</div>
            </div>

            <div className="miniGrid">
              <div className="mini">
                <div className="miniK">Chain</div>
                <div className="miniV">ETH</div>
              </div>
              <div className="mini">
                <div className="miniK">Mode</div>
                <div className="miniV">Prestige</div>
              </div>
              <div className="mini">
                <div className="miniK">Receipt</div>
                <div className="miniV">On-chain</div>
              </div>
            </div>

            <div className="note">
              This chamber is the “presentation layer.” Your mint is the execution layer.
            </div>
          </div>
        </section>
      </main>

      {/* BOTTOM ACTION BAR */}
      <footer className="bottomBar">
        <div className="bottomLeft">
          <div className="dotLive" />
          <div className="bottomText">
            <div className="bottomTitle">Oracle Vision · v4</div>
            <div className="bottomSub">Clean mint pipeline · Mainnet ready</div>
          </div>
        </div>

        <div className="bottomRight">
          {!connected ? (
            <button className="btn primary" onClick={connect} disabled={!hasProvider || busy}>
              Connect
            </button>
          ) : !isMainnet ? (
            <button className="btn primary" onClick={switchToMainnet} disabled={busy}>
              Mainnet
            </button>
          ) : (
            <button className="btn primary pulse" onClick={mint} disabled={busy}>
              Mint
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
