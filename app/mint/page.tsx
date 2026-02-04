"use client";

import React, { useEffect, useMemo, useState } from "react";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const ETH_MAINNET_CHAIN_ID_HEX = "0x1";

function shortAddr(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export default function MintPage() {
  const [hasProvider, setHasProvider] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ t: string; msg: string }[]>([]);

  const isConnected = !!account;
  const isMainnet = chainId?.toLowerCase() === ETH_MAINNET_CHAIN_ID_HEX;

  const chainLabel = useMemo(() => {
    if (!chainId) return "—";
    if (chainId.toLowerCase() === "0x1") return "Ethereum Mainnet";
    return `Chain ${chainId}`;
  }, [chainId]);

  const status = useMemo(() => {
    if (!hasProvider) return { text: "MetaMask not found", tone: "bad" as const };
    if (!isConnected) return { text: "Not connected", tone: "warn" as const };
    if (!isMainnet) return { text: "Wrong network (switch to ETH)", tone: "bad" as const };
    return { text: "Ready (ETH mainnet)", tone: "good" as const };
  }, [hasProvider, isConnected, isMainnet]);

  function push(msg: string) {
    setLog((p) => [{ t: nowIso(), msg }, ...p].slice(0, 25));
  }

  async function refreshState() {
    if (!window.ethereum) return;
    try {
      const [acc] = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
      const cid = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      setAccount(acc ?? null);
      setChainId(cid ?? null);
    } catch (e: any) {
      push(`refreshState error: ${e?.message ?? String(e)}`);
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
    } catch (e: any) {
      push(`Connect failed: ${e?.message ?? String(e)}`);
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
      await refreshState();
    } catch (e: any) {
      // If chain isn't available, MetaMask would require add — but ETH mainnet is always available.
      push(`Switch failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  // Stub for next commit (real mint later)
  async function mintStub() {
    push("Mint is currently locked (next commit enables contract + tx).");
  }

  useEffect(() => {
    setHasProvider(!!window.ethereum);
    refreshState();

    if (!window.ethereum) return;

    const onAccounts = (accs: string[]) => {
      setAccount(accs?.[0] ?? null);
      push(`Account changed: ${accs?.[0] ? shortAddr(accs[0]) : "Disconnected"}`);
    };

    const onChain = (cid: string) => {
      setChainId(cid ?? null);
      push(`Network changed: ${cid ?? "—"}`);
    };

    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);

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
          ETH Mainnet only. Classy chain. No excuses.
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
              <span className="opacity-70">Chain ID</span>
              <span className="font-mono">{chainId ?? "—"}</span>
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
                onClick={() => push("Connection looks good. Next commit: contract + real mint tx.")}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold"
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
              <div className="text-xs opacity-70">Contract</div>
              <div className="mt-1 font-mono text-sm">0x… (next commit)</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs opacity-70">Price</div>
              <div className="mt-1 text-sm">— ETH (next commit)</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs opacity-70">Supply</div>
              <div className="mt-1 text-sm">— / — (next commit)</div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={mintStub}
              disabled={!isConnected || !isMainnet || busy}
              className="rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? "…" : "Mint (locked until contract added)"}
            </button>

            <button
              onClick={() => setLog([])}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold"
            >
              Clear Log
            </button>
          </div>

          {/* Telemetry / Log */}
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Telemetry</h3>
              <span className="text-xs opacity-70">last 25 events</span>
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
              Next: inject contract address + ABI + real mint transaction + explorer link.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
