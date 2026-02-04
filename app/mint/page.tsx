// app/mint/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0x15545833cFCe7579D967D02A1183114d7e554889"; // full, no truncation
const ETHERSCAN_BASE = "https://etherscan.io/address/";
const MINT_PRICE_ETH = "0.01";
const REQUIRED_CHAIN_ID_DEC = 1; // Ethereum Mainnet

// Minimal ABI: includes common mint names so the UI doesn't "die" if the function name differs.
const ABI = [
  "function mint() payable",
  "function safeMint() payable",
  "function mint(uint256 quantity) payable",
  "function safeMint(address to) payable",
  "function totalSupply() view returns (uint256)",
] as const;

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function chainNameFromId(id?: number) {
  if (id === 1) return "Ethereum Mainnet";
  if (id === 11155111) return "Sepolia";
  return id ? `Chain ${id}` : "—";
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  }
}

export default function MintPage() {
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<number | undefined>(undefined);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  const [status, setStatus] = useState<string>("Not connected");
  const [lastTx, setLastTx] = useState<string>("");

  const isOnMainnet = chainId === REQUIRED_CHAIN_ID_DEC;

  const provider = useMemo(() => {
    if (typeof window === "undefined") return null;
    const eth = (window as any).ethereum;
    if (!eth) return null;
    return new ethers.BrowserProvider(eth);
  }, [hasInjectedWallet]);

  useEffect(() => {
    const eth = (window as any).ethereum;


    setHasInjectedWallet(Boolean(eth));

    if (!eth) {
      setStatus("No injected wallet detected. Open in MetaMask browser, or enable a wallet provider.");
      return;
    }

    const refresh = async () => {
      try {
        const prov = new ethers.BrowserProvider(eth);
        const accs = (await prov.listAccounts()).map((a) => a.address);
        setAccount(accs[0] || "");
        const net = await prov.getNetwork();
        setChainId(Number(net.chainId));
        setStatus(accs[0] ? "Connected" : "Not connected");
      } catch {
        // don't spam errors
      }
    };

    refresh();

    const onAccounts = (accs: string[]) => {
      setAccount(accs?.[0] || "");
      setStatus(accs?.[0] ? "Connected" : "Not connected");
    };

    const onChain = (hexId: string) => {
      const n = Number.parseInt(hexId, 16);
      setChainId(n);
    };

    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);

    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  async function connect() {
    const eth = (window as any).ethereum;
    if (!eth) {
      setStatus("No wallet detected. Try opening this page inside the MetaMask browser.");
      return;
    }
    try {
      setIsConnecting(true);
      setStatus("Requesting wallet connection…");
      const prov = new ethers.BrowserProvider(eth);
      const accounts = await prov.send("eth_requestAccounts", []);
      const net = await prov.getNetwork();
      setAccount(accounts?.[0] || "");
      setChainId(Number(net.chainId));
      setStatus(accounts?.[0] ? "Connected" : "Not connected");
      setLastTx("");
    } catch (e: any) {
      const msg = e?.message || "Connection rejected.";
      setStatus(msg);
    } finally {
      setIsConnecting(false);
    }
  }

  async function ensureMainnet() {
    const eth = (window as any).ethereum;
    if (!eth) return false;

    try {
      // If already mainnet, great.
      if (chainId === REQUIRED_CHAIN_ID_DEC) return true;

      setStatus("Switching to Ethereum Mainnet…");
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }],
      });
      return true;
    } catch (e: any) {
      // If user rejects or wallet doesn't support switching.
      setStatus(e?.message || "Please switch to Ethereum Mainnet in your wallet.");
      return false;
    }
  }

  async function mint() {
    if (!provider) {
      setStatus("No wallet provider available.");
      return;
    }
    if (!account) {
      setStatus("Connect wallet first.");
      return;
    }

    const ok = await ensureMainnet();
    if (!ok) return;

    try {
      setIsMinting(true);
      setStatus("Preparing mint…");
      setLastTx("");

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

      const value = ethers.parseEther(MINT_PRICE_ETH);

      // Try common mint patterns in a graceful sequence.
      let tx: ethers.TransactionResponse | null = null;

      // 1) mint() payable
      try {
        if (contract.mint) {
          tx = await contract.mint({ value });
        }
      } catch {
        tx = null;
      }

      // 2) mint(1) payable
      if (!tx) {
        try {
          tx = await contract.mint(1, { value });
        } catch {
          tx = null;
        }
      }

      // 3) safeMint() payable
      if (!tx) {
        try {
          if (contract.safeMint) {
            tx = await contract.safeMint({ value });
          }
        } catch {
          tx = null;
        }
      }

      // 4) safeMint(to) payable
      if (!tx) {
        try {
          tx = await contract.safeMint(account, { value });
        } catch {
          tx = null;
        }
      }

      if (!tx) {
        setStatus(
          "Mint call failed. The contract may use a different mint function name/signature. Verify the ABI + contract address."
        );
        return;
      }

      setLastTx(tx.hash);
      setStatus("Transaction sent. Waiting for confirmation…");

      const receipt = await tx.wait();
      if (receipt?.status === 1) {
        setStatus("Mint confirmed ✅ Clean receipt on Ethereum Mainnet.");
      } else {
        setStatus("Transaction failed or reverted.");
      }
    } catch (e: any) {
      const msg =
        e?.shortMessage ||
        e?.reason ||
        e?.message ||
        "Mint failed (unknown error).";
      setStatus(msg);
    } finally {
      setIsMinting(false);
    }
  }

  async function onCopyContract() {
    const ok = await copyToClipboard(CONTRACT_ADDRESS);
    setStatus(ok ? "Contract address copied." : "Could not copy address.");
  }

  async function onCopyWallet() {
    if (!account) return;
    const ok = await copyToClipboard(account);
    setStatus(ok ? "Wallet copied." : "Could not copy wallet.");
  }

  return (
    <main className="min-h-screen bg-[#05080c] text-slate-100">
      {/* top shell */}
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm tracking-wider text-slate-300">
              Oracle Vision Minter v4
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Oracle Vision — Mint Console
            </h1>
            <p className="mt-2 text-slate-300">
              Ethereum Mainnet only. Clean mints. Clear receipts.
            </p>
          </div>

          <a
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Home
          </a>
        </div>

        {/* console */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_40px_rgba(80,150,255,0.08)]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm text-slate-300">Status</div>
              <div className="mt-1 text-lg font-semibold">
                {account ? "Connected" : "Not connected"}
              </div>

              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-slate-300">Wallet</div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-100">
                      {account ? shortAddr(account) : "—"}
                    </span>
                    {account ? (
                      <button
                        onClick={onCopyWallet}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                      >
                        Copy
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-slate-300">Network</div>
                  <div className="font-mono text-slate-100">
                    {chainNameFromId(chainId)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-300">Contract</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onCopyContract}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                      >
                        Copy
                      </button>
                      <a
                        href={`${ETHERSCAN_BASE}${CONTRACT_ADDRESS}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                      >
                        Etherscan
                      </a>
                    </div>
                  </div>

                  {/* full address, no truncation */}
                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="min-w-[420px] font-mono text-xs text-slate-100">
                      {CONTRACT_ADDRESS}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-slate-300">Mint price</div>
                  <div className="font-mono text-slate-100">
                    {MINT_PRICE_ETH} ETH
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={connect}
                    disabled={isConnecting}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                  >
                    {hasInjectedWallet
                      ? isConnecting
                        ? "Connecting…"
                        : "Connect Wallet"
                      : "No Wallet Detected"}
                  </button>

                  <button
                    onClick={mint}
                    disabled={!account || isMinting || !hasInjectedWallet}
                    className="rounded-xl border border-blue-300/20 bg-blue-500/10 px-4 py-2 text-sm hover:bg-blue-500/15 disabled:opacity-50"
                  >
                    {isMinting ? "Minting…" : "Mint Now"}
                  </button>

                  {!isOnMainnet && account ? (
                    <span className="inline-flex items-center rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      Switch to Ethereum Mainnet
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 text-xs text-slate-400">
                  Mobile: best results opening this page inside the MetaMask browser.
                </div>
              </div>
            </div>

            {/* preview / orb */}
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm text-slate-300">NFT Preview</div>
              <div className="mt-3 rounded-2xl border border-white/10 bg-[#060b12] p-5">
                <div className="text-xs uppercase tracking-widest text-slate-400">
                  Oracle Vision NFT
                </div>

                <div className="mt-4 flex items-center justify-center">
                  <div className="orbWrap" aria-label="Oracle orb preview">
                    <div className="orb" />
                    <div className="orbGlow" />
                    <div className="orbSheen" />
                  </div>
                </div>

                <div className="mt-6 text-sm text-slate-300">
                  PREVIEW
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  A mint stamps a clean on-chain receipt. This preview is visual only.
                </div>
              </div>

              {/* tx + status */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm text-slate-300">Console</div>
                <div className="mt-2 text-sm text-slate-100">{status}</div>

                {lastTx ? (
                  <div className="mt-3">
                    <div className="text-xs text-slate-400">Last TX</div>
                    <a
                      className="mt-1 block break-all font-mono text-xs text-blue-200 hover:underline"
                      href={`https://etherscan.io/tx/${lastTx}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {lastTx}
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* soft footer note */}
        <div className="mt-6 text-xs text-slate-500">
          Tip: if mint still fails, the contract may use a different mint function signature—confirm the ABI on Etherscan and update the ABI list above.
        </div>
      </div>

      {/* Orb styling (soft glow + gentle motion) */}
      <style jsx>{`
        .orbWrap {
          position: relative;
          width: 280px;
          height: 280px;
          border-radius: 9999px;
          display: grid;
          place-items: center;
        }

        .orb {
          width: 240px;
          height: 240px;
          border-radius: 9999px;
          background: radial-gradient(
              circle at 35% 30%,
              rgba(255, 255, 255, 0.55) 0%,
              rgba(255, 255, 255, 0.12) 18%,
              rgba(70, 140, 255, 0.35) 42%,
              rgba(20, 60, 140, 0.55) 68%,
              rgba(4, 12, 24, 0.95) 100%
            ),
            radial-gradient(
              circle at 70% 80%,
              rgba(80, 170, 255, 0.28) 0%,
              rgba(0, 0, 0, 0) 60%
            );
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow:
            0 0 0 12px rgba(120, 170, 255, 0.06),
            0 0 60px rgba(70, 140, 255, 0.22),
            inset 0 0 40px rgba(120, 190, 255, 0.18);
          animation: orbFloat 6.8s ease-in-out infinite;
          filter: saturate(1.08);
        }

        .orbGlow {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: radial-gradient(
            circle at 50% 50%,
            rgba(90, 170, 255, 0.18) 0%,
            rgba(90, 170, 255, 0.08) 35%,
            rgba(0, 0, 0, 0) 70%
          );
          filter: blur(10px);
          animation: glowPulse 4.6s ease-in-out infinite;
          pointer-events: none;
        }

        .orbSheen {
          position: absolute;
          width: 190px;
          height: 190px;
          border-radius: 9999px;
          transform: translate(-26px, -38px);
          background: radial-gradient(
            circle at 35% 35%,
            rgba(255, 255, 255, 0.34) 0%,
            rgba(255, 255, 255, 0.12) 22%,
            rgba(255, 255, 255, 0) 58%
          );
          mix-blend-mode: screen;
          opacity: 0.75;
          animation: sheenDrift 7.4s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes orbFloat {
          0% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-8px) scale(1.01);
          }
          100% {
            transform: translateY(0px) scale(1);
          }
        }

        @keyframes glowPulse {
          0% {
            opacity: 0.55;
            transform: scale(0.99);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.02);
          }
          100% {
            opacity: 0.55;
            transform: scale(0.99);
          }
        }

        @keyframes sheenDrift {
          0% {
            transform: translate(-28px, -40px) rotate(-2deg);
            opacity: 0.65;
          }
          50% {
            transform: translate(-18px, -46px) rotate(2deg);
            opacity: 0.9;
          }
          100% {
            transform: translate(-28px, -40px) rotate(-2deg);
            opacity: 0.65;
          }
        }
      `}</style>
    </main>
  );
}
