"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const ETH_MAINNET_CHAIN_ID_HEX = "0x1";
const CONTRACT_ADDRESS = "0x15545833cFCe7579D967D02A1183114d7e554889";

// Minimal ABI: only what we use
const ORACLE_ABI = [
  // reads
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function MINT_PRICE() view returns (uint256)",
  // write
  "function mintOracleVision() payable",
];

function shortAddr(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function etherscanTxUrl(txHash: string) {
  return `https://etherscan.io/tx/${txHash}`;
}

function etherscanAddrUrl(addr: string) {
  return `https://etherscan.io/address/${addr}`;
}

export default function MintPage() {
  const [hasProvider, setHasProvider] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);

  const [collectionName, setCollectionName] = useState<string>("—");
  const [symbol, setSymbol] = useState<string>("—");
  const [mintPriceWei, setMintPriceWei] = useState<bigint | null>(null);

  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [log, setLog] = useState<{ t: string; msg: string }[]>([]);

  const isConnected = !!account;
  const isMainnet = chainId?.toLowerCase() === ETH_MAINNET_CHAIN_ID_HEX;

  const chainLabel = useMemo(() => {
    if (!chainId) return "—";
    if (chainId.toLowerCase() === "0x1") return "Ethereum Mainnet";
    return `Chain ${chainId}`;
  }, [chainId]);

  const priceEth = useMemo(() => {
    if (mintPriceWei == null) return "—";
    try {
      return ethers.formatEther(mintPriceWei);
    } catch {
      return "—";
    }
  }, [mintPriceWei]);

  const status = useMemo(() => {
    if (!hasProvider) return { text: "MetaMask not found", tone: "bad" as const };
    if (!isConnected) return { text: "Not connected", tone: "warn" as const };
    if (!isMainnet) return { text: "Wrong network (switch to ETH)", tone: "bad" as const };
    return { text: "Ready (ETH mainnet)", tone: "good" as const };
  }, [hasProvider, isConnected, isMainnet]);

  function push(msg: string) {
    setLog((p) => [{ t: nowIso(), msg }, ...p].slice(0, 30));
  }

  function humanizeEthersError(e: any) {
    const msg = e?.shortMessage || e?.reason || e?.message || String(e);
    // MetaMask user rejected
    if (e?.code === 4001) return "User rejected the transaction.";
    if (typeof msg === "string" && msg.toLowerCase().includes("user rejected"))
      return "User rejected the transaction.";
    return msg;
  }

  async function getProvider() {
    if (!window.ethereum) return null;
    // MetaMask injects an EIP-1193 provider; ethers wraps it
    return new ethers.BrowserProvider(window.ethereum);
  }

  async function refreshWalletState() {
    if (!window.ethereum) return;
    try {
      const [acc] = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
      const cid = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      setAccount(acc ?? null);
      setChainId(cid ?? null);
    } catch (e: any) {
      push(`refreshWalletState error: ${humanizeEthersError(e)}`);
    }
  }

  async function loadContractReads() {
    // only load reads when provider exists; reads can be done even if not connected,
    // but BrowserProvider may still require provider presence
    const provider = await getProvider();
    if (!provider) return;

    try {
      const readOnly = await provider.getSigner().catch(() => null);
      // If user not connected, fall back to provider itself for reads.
      // ethers Contract wants a runner; BrowserProvider works as runner for view calls too.
      const runner: any = readOnly ?? provider;
      const c = new ethers.Contract(CONTRACT_ADDRESS, ORACLE_ABI, runner);

      const [n, s, p] = await Promise.all([
        c.name() as Promise<string>,
        c.symbol() as Promise<string>,
        c.MINT_PRICE() as Promise<bigint>,
      ]);

      setCollectionName(n || "—");
      setSymbol(s || "—");
      setMintPriceWei(p ?? null);

      push(`Loaded contract: ${n} (${s})`);
      push(`Mint price: ${ethers.formatEther(p)} ETH`);
    } catch (e: any) {
      push(`Contract read failed: ${humanizeEthersError(e)}`);
    }
  }

  async function connect() {
    if (!window.ethereum) {
      push("MetaMask not found.");
      return;
    }
    setBusy(true);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const cid = (await window.ethereum.request({ method: "eth_chainId" })) as string;

      setAccount(accounts?.[0] ?? null);
      setChainId(cid ?? null);

      push(`Connected: ${accounts?.[0] ? shortAddr(accounts[0]) : "—"}`);
      push(`Chain: ${cid ?? "—"}`);

      // after connect, load reads
      await loadContractReads();
    } catch (e: any) {
      push(`Connect failed: ${humanizeEthersError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function switchToMainnet() {
    if (!window.ethereum) return;
    setBusy(true);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ETH_MAINNET_CHAIN_ID_HEX }],
      });
      push("Switched to Ethereum Mainnet.");
      await refreshWalletState();
      await loadContractReads();
    } catch (e: any) {
      push(`Switch failed: ${humanizeEthersError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function mint() {
    if (!window.ethereum) return;
    if (!isConnected) {
      push("Connect your wallet first.");
      return;
    }
    if (!isMainnet) {
      push("Switch to Ethereum Mainnet first.");
      return;
    }

    setBusy(true);
    setTxHash(null);

    try {
      const provider = await getProvider();
      if (!provider) throw new Error("No provider found.");

      const signer = await provider.getSigner();
      const c = new ethers.Contract(CONTRACT_ADDRESS, ORACLE_ABI, signer);

      // Ensure we have a fresh price (avoid stale UI)
      const price: bigint = await c.MINT_PRICE();
      setMintPriceWei(price);

      push(`Minting… value = ${ethers.formatEther(price)} ETH`);

      const tx = await c.mintOracleVision({ value: price });
      setTxHash(tx.hash);
      push(`Tx sent: ${tx.hash}`);

      // Wait for mining
      const receipt = await tx.wait();
      if (!receipt) {
        push("Tx sent, but receipt not found yet.");
      } else {
        push(`Success ✅ Block: ${receipt.blockNumber}`);
      }
    } catch (e: any) {
      push(`Mint failed: ${humanizeEthersError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setHasProvider(!!window.ethereum);
    refreshWalletState();

    if (!window.ethereum) return;

    const onAccounts = (accs: string[]) => {
      setAccount(accs?.[0] ?? null);
      push(`Account changed: ${accs?.[0] ? shortAddr(accs[0]) : "Disconnected"}`);
      // refresh reads on account change
      loadContractReads();
    };

    const onChain = (cid: string) => {
      setChainId(cid ?? null);
      push(`Network changed: ${cid ?? "—"}`);
      // refresh reads on network change
      loadContractReads();
    };

    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);

    // initial contract reads
    loadContractReads();

    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Oracle Vision — Mint Console</h1>
        <p className="mt-2 text-sm opacity-80">
          Ethereum Mainnet only. Clean mints. Clear receipts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Status */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Status</h2>
            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-medium",
                status.tone === "good" ? "bg-emerald-500/20 text-emerald-200" : "",
                status.tone === "warn" ? "bg-amber-500/20 text-amber-200" : "",
                status.tone === "bad" ? "bg-rose-500/20 text-rose-200" : "",
              ].join(" ")}
            >
              {status.text}
            </span>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="opacity-70">Wallet</span>
              <span className="font-mono">{account ? shortAddr(account) : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-70">Network</span>
              <span>{chainLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="opacity-70">Contract</span>
              <a
                className="font-mono underline underline-offset-4 opacity-90"
                href={etherscanAddrUrl(CONTRACT_ADDRESS)}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddr(CONTRACT_ADDRESS)}
              </a>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {!isConnected ? (
              <button
                onClick={connect}
                disabled={!hasProvider || busy}
                className="rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Working…" : "Connect MetaMask"}
              </button>
            ) : !isMainnet ? (
              <button
                onClick={switchToMainnet}
                disabled={busy}
                className="rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Switching…" : "Switch to Ethereum Mainnet"}
              </button>
            ) : (
              <button
                onClick={() => push("Wallet + network ready.")}
                disabled={busy}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Connected ✓
              </button>
            )}
          </div>

          {!hasProvider && (
            <p className="mt-3 text-xs opacity-75">
              Install MetaMask in your browser to connect.
            </p>
          )}
        </section>

        {/* Mint */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Mint</h2>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs opacity-80">
              {isConnected && isMainnet ? "Armed" : "Locked"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs opacity-70">Collection</div>
              <div className="mt-1 text-sm font-semibold">{collectionName}</div>
              <div className="mt-1 text-xs opacity-70">{symbol}</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs opacity-70">Mint Price</div>
              <div className="mt-1 text-sm">
                {priceEth === "—" ? "—" : `${priceEth} ETH`}
              </div>
              <div className="mt-1 text-xs opacity-70">from MINT_PRICE()</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs opacity-70">Method</div>
              <div className="mt-1 font-mono text-sm">mintOracleVision()</div>
              <div className="mt-1 text-xs opacity-70">payable</div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={mint}
              disabled={!isConnected || !isMainnet || busy || mintPriceWei == null}
              className="rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? "Minting…" : "Mint on ETH Mainnet"}
            </button>

            <button
              onClick={() => loadContractReads()}
              disabled={busy}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Refresh
            </button>

            <button
              onClick={() => setLog([])}
              disabled={busy}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Clear Log
            </button>
          </div>

          {txHash && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-xs opacity-70">Latest Transaction</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm">{shortAddr(txHash)}</span>
                <a
                  className="text-sm underline underline-offset-4"
                  href={etherscanTxUrl(txHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Etherscan
                </a>
              </div>
            </div>
          )}

          {/* Telemetry / Log */}
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Telemetry</h3>
              <span className="text-xs opacity-70">last 30 events</span>
            </div>

            <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3">
              {log.length === 0 ? (
                <div className="text-sm opacity-70">No events yet.</div>
              ) : (
                <ul className="space-y-2">
                  {log.map((x, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-mono opacity-60">{x.t}</span>
                      <span className="mx-2 opacity-50">—</span>
                      <span>{x.msg}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="mt-2 text-xs opacity-70">
              Tip: If mint fails, the error message above will tell you why (wrong network, insufficient ETH, paused mint, etc).
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
