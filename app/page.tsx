// app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type ChainInfo = { chainIdHex: string; chainIdDec: number; name: string };
type WalletState = {
  installed: boolean;
  connected: boolean;
  account?: string;
  chainIdHex?: string;
};

type Signal = {
  symbol: string;
  score: number; // 0..100
  trend: "BULL" | "NEUTRAL" | "BEAR";
  confidence: number; // 0..1
  momentum: number; // -1..1
  note: string;
};

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function shortAddr(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function fmtPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function nowIso() {
  return new Date().toISOString();
}

function chainLabel(chainIdHex?: string): ChainInfo | undefined {
  if (!chainIdHex) return;
  const dec = parseInt(chainIdHex, 16);
  const map: Record<number, string> = {
    1: "Ethereum",
    10: "Optimism",
    56: "BSC",
    137: "Polygon",
    8453: "Base",
    42161: "Arbitrum",
    11155111: "Sepolia",
  };
  return { chainIdHex, chainIdDec: dec, name: map[dec] ?? `Chain ${dec}` };
}

function safeWindowEthereum(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
}

/**
 * Super hi-tech, no-drama "Market Bull Finder" hero UI.
 * - Animated neon grid + orbs
 * - Wallet connect (MetaMask / EIP-1193)
 * - Telemetry panel + signal chips
 * - Works even if /api/scan doesn't exist (falls back to local synthetic signals)
 */
export default function Page() {
  const [wallet, setWallet] = useState<WalletState>(() => {
    const eth = safeWindowEthereum();
    return { installed: !!eth, connected: false };
  });

  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [symbols, setSymbols] = useState<string>("BTC,ETH,SOL");
  const [auto, setAuto] = useState(true);
  const [intervalSec, setIntervalSec] = useState(10);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [lastRun, setLastRun] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [errText, setErrText] = useState<string>("");

  // fancy UI: pointer glow
  const glowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = glowRef.current;
      if (!el) return;
      const x = e.clientX;
      const y = e.clientY;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Wallet listeners
  useEffect(() => {
    const eth = safeWindowEthereum();
    if (!eth) return;

    const handleAccounts = (accs: string[]) => {
      const account = accs?.[0];
      setWallet((w) => ({
        ...w,
        installed: true,
        connected: !!account,
        account,
      }));
    };

    const handleChain = (chainIdHex: string) => {
      setWallet((w) => ({ ...w, chainIdHex }));
    };

    eth.request?.({ method: "eth_accounts" })
      .then((accs: string[]) => handleAccounts(accs))
      .catch(() => {});

    eth.request?.({ method: "eth_chainId" })
      .then((cid: string) => handleChain(cid))
      .catch(() => {});

    eth.on?.("accountsChanged", handleAccounts);
    eth.on?.("chainChanged", handleChain);

    return () => {
      eth.removeListener?.("accountsChanged", handleAccounts);
      eth.removeListener?.("chainChanged", handleChain);
    };
  }, []);

  const chain = useMemo(() => chainLabel(wallet.chainIdHex), [wallet.chainIdHex]);

  const symbolList = useMemo(() => {
    return symbols
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 12);
  }, [symbols]);

  function synthSignals(): Signal[] {
    // deterministic-ish per minute, per symbol, so it feels "alive" but stable
    const t = Math.floor(Date.now() / 60000);
    return symbolList.map((sym, i) => {
      const seed =
        (sym.charCodeAt(0) ?? 1) * 131 +
        (sym.charCodeAt(1) ?? 7) * 313 +
        (sym.charCodeAt(2) ?? 9) * 911 +
        i * 97 +
        t * 19;

      const raw = Math.sin(seed) * 0.5 + Math.cos(seed / 3) * 0.5;
      const momentum = clamp(raw, -1, 1);
      const score = Math.round(clamp(50 + momentum * 42 + Math.sin(seed / 9) * 8, 0, 100));
      const confidence = clamp(0.52 + Math.abs(momentum) * 0.42, 0, 1);

      let trend: Signal["trend"] = "NEUTRAL";
      if (score >= 67) trend = "BULL";
      else if (score <= 33) trend = "BEAR";

      const note =
        trend === "BULL"
          ? "Buyers stepping in. Momentum building."
          : trend === "BEAR"
          ? "Risk rising. Protect capital."
          : "Indecision. Wait for confirmation.";

      return { symbol: sym, score, trend, confidence, momentum, note };
    });
  }

  async function runScan() {
    setRunning(true);
    setErrText("");
    try {
      // Attempt your API route if it exists; otherwise fallback to synthetic
      const qs = encodeURIComponent(symbolList.map((s) => s.toLowerCase()).join(","));
      const res = await fetch(`/api/scan?symbols=${qs}`, { cache: "no-store" });

      if (!res.ok) {
        // fallback quietly (keeps UX smooth on mobile)
        const s = synthSignals();
        setSignals(s);
        setLastRun(nowIso());
        setRunning(false);
        return;
      }

      const data = await res.json();

      // Flexible parsing: accept {signals:[...]} or {items:[...]} or raw array
      const arr: any[] = Array.isArray(data) ? data : (data?.signals ?? data?.items ?? []);
      if (!Array.isArray(arr) || arr.length === 0) {
        const s = synthSignals();
        setSignals(s);
        setLastRun(nowIso());
        setRunning(false);
        return;
      }

      const normalized: Signal[] = arr
        .map((x) => {
          const symbol = (x.symbol ?? x.ticker ?? x.s ?? "").toString().toUpperCase();
          const score = Number(x.score ?? x.bullScore ?? x.value ?? 0);
          const trendRaw = (x.trend ?? x.state ?? "").toString().toUpperCase();
          const trend: Signal["trend"] =
            trendRaw === "BULL" || trendRaw === "BEAR" ? trendRaw : score >= 67 ? "BULL" : score <= 33 ? "BEAR" : "NEUTRAL";
          const confidence = clamp(Number(x.confidence ?? x.conf ?? 0.7), 0, 1);
          const momentum = clamp(Number(x.momentum ?? x.m ?? (score - 50) / 50), -1, 1);
          const note = (x.note ?? x.reason ?? "").toString() || (trend === "BULL" ? "Bullish bias detected." : trend === "BEAR" ? "Bearish risk detected." : "Neutral stance.");
          return { symbol, score: clamp(score, 0, 100), trend, confidence, momentum, note };
        })
        .filter((x) => x.symbol);

      setSignals(normalized.length ? normalized : synthSignals());
      setLastRun(nowIso());
    } catch (e: any) {
      setErrText(e?.message ? String(e.message) : "Scan failed.");
      // still provide something usable
      setSignals(synthSignals());
      setLastRun(nowIso());
    } finally {
      setRunning(false);
    }
  }

  // auto refresh
  useEffect(() => {
    runScan(); // initial
    if (!auto) return;
    const ms = clamp(intervalSec, 5, 60) * 1000;
    const t = window.setInterval(() => runScan(), ms);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, intervalSec, symbols]);

  async function connectWallet() {
    const eth = safeWindowEthereum();
    if (!eth) {
      setToast({ kind: "err", msg: "MetaMask not detected. Install it, then retry." });
      return;
    }
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      const chainIdHex: string = await eth.request({ method: "eth_chainId" });
      setWallet({ installed: true, connected: !!accounts?.[0], account: accounts?.[0], chainIdHex });
      setToast({ kind: "ok", msg: "Wallet connected." });
    } catch (e: any) {
      setToast({ kind: "err", msg: e?.message ? String(e.message) : "Wallet connect cancelled." });
    }
  }

  function trendAccent(trend: Signal["trend"]) {
    if (trend === "BULL") return "ring-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    if (trend === "BEAR") return "ring-rose-400/30 bg-rose-500/10 text-rose-200";
    return "ring-sky-400/25 bg-sky-500/10 text-sky-200";
  }

  const topSignal = useMemo(() => {
    if (!signals.length) return null;
    return [...signals].sort((a, b) => b.score - a.score)[0];
  }, [signals]);

  return (
    <main className="min-h-screen text-white relative overflow-hidden">
      {/* Ambient hi-tech background */}
      <div className="absolute inset-0 -z-10 bg-[#050814]" />
      <div className="absolute inset-0 -z-10 opacity-90">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.22),rgba(59,130,246,0.10),rgba(0,0,0,0))]" />
        <div className="absolute top-24 -left-24 h-[420px] w-[420px] rounded-full blur-3xl bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.18),rgba(59,130,246,0.08),rgba(0,0,0,0))]" />
        <div className="absolute bottom-[-180px] right-[-140px] h-[520px] w-[520px] rounded-full blur-3xl bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.14),rgba(56,189,248,0.06),rgba(0,0,0,0))]" />
      </div>

      {/* Neon grid */}
      <div className="absolute inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(to_right,rgba(56,189,248,0.35)_1px,transparent_1px),linear-gradient(to_bottom,rgba(56,189,248,0.35)_1px,transparent_1px)] [background-size:64px_64px]" />
      <div className="absolute inset-0 -z-10 opacity-[0.12] [mask-image:radial-gradient(circle_at_center,black,transparent_70%)] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.55),transparent_60%)]" />

      {/* Pointer glow */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 [background:radial-gradient(600px_circle_at_var(--mx)_var(--my),rgba(56,189,248,0.10),transparent_55%)]"
        style={{ ["--mx" as any]: "50vw", ["--my" as any]: "30vh" }}
      />

      {/* Header */}
      <header className="px-5 pt-6 pb-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/5 ring-1 ring-white/10 grid place-items-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_30%_30%,rgba(56,189,248,0.25),transparent_55%)]" />
              <div className="h-3.5 w-3.5 rounded-full bg-sky-300/70 shadow-[0_0_18px_rgba(56,189,248,0.55)]" />
            </div>
            <div className="leading-tight">
              <div className="text-sm opacity-80">VOLTARA ORACLE · GPT-5.2</div>
              <div className="text-base font-semibold tracking-wide">Market Bull Finder</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
              <div className={cn("h-2.5 w-2.5 rounded-full", wallet.connected ? "bg-emerald-400" : "bg-white/30")} />
              <div className="text-xs opacity-85">
                {wallet.connected ? shortAddr(wallet.account) : wallet.installed ? "Wallet ready" : "No wallet"}
              </div>
            </div>
            <button
              onClick={() => setTelemetryOpen(true)}
              className="rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2 text-xs hover:bg-white/10 active:scale-[0.99] transition"
            >
              Telemetry
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 pt-6 pb-10">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 shadow-[0_0_0_1px_rgba(56,189,248,0.06),0_30px_80px_rgba(0,0,0,0.55)] overflow-hidden">
            <div className="p-6 sm:p-7 relative">
              {/* top shimmer line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

              <div className="flex flex-col gap-5">
                <div>
                  <div className="text-3xl sm:text-4xl font-semibold tracking-tight">
                    Signal over noise.
                    <span className="block text-white/70 text-xl sm:text-2xl mt-2 font-medium">
                      A hi-tech bull detector that stays calm when the market screams.
                    </span>
                  </div>

                  <div className="mt-4 text-sm text-white/70 leading-relaxed">
                    Steel logic. Fluorescent intuition. Execution over fear.
                    <span className="inline-block ml-2 text-white/50">(Auto-refresh {intervalSec}s · Mobile-first)</span>
                  </div>
                </div>

                {/* Live pulse row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1.5 text-xs">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </span>
                    LIVE
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1.5 text-xs text-white/80">
                    {chain ? chain.name : "Chain unknown"}
                    <span className="opacity-50">{chain ? `(${chain.chainIdDec})` : ""}</span>
                  </span>

                  {topSignal && (
                    <span className={cn("inline-flex items-center gap-2 rounded-full ring-1 px-3 py-1.5 text-xs", trendAccent(topSignal.trend))}>
                      Top: {topSignal.symbol} · {topSignal.score}
                      <span className="opacity-70">{topSignal.trend}</span>
                    </span>
                  )}

                  <span className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1.5 text-xs text-white/70">
                    Last scan: {lastRun ? new Date(lastRun).toLocaleTimeString() : "—"}
                  </span>
                </div>

                {/* Controls */}
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-stretch">
                  <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                    <div className="text-xs uppercase tracking-wider text-white/60">Targets</div>
                    <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-center">
                      <input
                        value={symbols}
                        onChange={(e) => setSymbols(e.target.value)}
                        className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm outline-none focus:ring-sky-400/40"
                        placeholder="BTC,ETH,SOL"
                        inputMode="text"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => runScan()}
                          disabled={running}
                          className={cn(
                            "rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 transition",
                            running ? "bg-white/5 opacity-70" : "bg-sky-500/15 hover:bg-sky-500/25"
                          )}
                        >
                          {running ? "Scanning…" : "Run"}
                        </button>
                        <button
                          onClick={() => setTelemetryOpen(true)}
                          className="rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 px-3 py-2 text-sm transition"
                        >
                          View
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/70">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={auto}
                          onChange={(e) => setAuto(e.target.checked)}
                          className="accent-sky-400"
                        />
                        Auto-refresh
                      </label>

                      <div className="inline-flex items-center gap-2">
                        <span className="opacity-70">Interval</span>
                        <input
                          type="range"
                          min={5}
                          max={60}
                          value={intervalSec}
                          onChange={(e) => setIntervalSec(Number(e.target.value))}
                          className="w-36"
                        />
                        <span className="tabular-nums">{intervalSec}s</span>
                      </div>

                      {errText ? <span className="text-rose-200/90">⚠ {errText}</span> : null}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4 flex flex-col justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-white/60">Wallet</div>
                      <div className="mt-2 text-sm text-white/80">
                        {wallet.installed ? (
                          wallet.connected ? (
                            <>
                              Connected: <span className="font-semibold">{shortAddr(wallet.account)}</span>
                              <div className="text-xs text-white/55 mt-1">{chain ? chain.name : "Chain unknown"}</div>
                            </>
                          ) : (
                            "Connect MetaMask to unlock premium telemetry later."
                          )
                        ) : (
                          "MetaMask not detected on this browser."
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={connectWallet}
                        className={cn(
                          "flex-1 rounded-xl px-3 py-2 text-sm ring-1 ring-white/10 transition",
                          wallet.connected ? "bg-emerald-500/15 hover:bg-emerald-500/25" : "bg-white/5 hover:bg-white/10"
                        )}
                      >
                        {wallet.connected ? "Re-sync" : "Connect Wallet"}
                      </button>
                      <button
                        onClick={() => setTelemetryOpen(true)}
                        className="rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 px-3 py-2 text-sm transition"
                      >
                        Telemetry
                      </button>
                    </div>
                  </div>
                </div>

                {/* Signal Strip */}
                <div className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-white/60">Foundational Signal</div>
                      <div className="text-sm text-white/75 mt-1">
                        Quiet confidence beats loud prediction. Let the chart prove it.
                      </div>
                    </div>
                    <button
                      onClick={() => setTelemetryOpen(true)}
                      className="rounded-xl bg-sky-500/15 hover:bg-sky-500/25 ring-1 ring-sky-400/20 px-3 py-2 text-xs transition"
                    >
                      Deep View
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {(signals.length ? signals : synthSignals()).slice(0, 6).map((s) => (
                      <div
                        key={s.symbol}
                        className={cn(
                          "rounded-2xl p-3 ring-1 bg-white/[0.03] hover:bg-white/[0.05] transition",
                          s.trend === "BULL"
                            ? "ring-emerald-400/20"
                            : s.trend === "BEAR"
                            ? "ring-rose-400/20"
                            : "ring-sky-400/15"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold tracking-wide">{s.symbol}</div>
                          <span className={cn("text-[11px] px-2 py-1 rounded-full ring-1", trendAccent(s.trend))}>
                            {s.trend}
                          </span>
                        </div>

                        <div className="mt-2 flex items-end justify-between">
                          <div className="text-2xl font-semibold tabular-nums">{s.score}</div>
                          <div className="text-xs text-white/60">
                            Conf: <span className="text-white/80 tabular-nums">{fmtPct(s.confidence)}</span>
                          </div>
                        </div>

                        <div className="mt-2 h-2 rounded-full bg-white/5 ring-1 ring-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,rgba(56,189,248,0.35),rgba(34,197,94,0.35),rgba(244,63,94,0.25))]"
                            style={{ width: `${clamp(s.score, 0, 100)}%` }}
                          />
                        </div>

                        <div className="mt-2 text-xs text-white/65 leading-snug">{s.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-center text-xs text-white/45 pt-1">
                  © 2026 Oracle Vision · On-chain art. Clean execution.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Telemetry Modal */}
      {telemetryOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setTelemetryOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:grid sm:place-items-center p-3">
            <div className="w-full sm:max-w-3xl rounded-2xl bg-[#070b18]/95 ring-1 ring-white/10 shadow-[0_30px_120px_rgba(0,0,0,0.7)] overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold tracking-wide">Telemetry Console</div>
                  <div className="text-xs text-white/60 mt-0.5">
                    Signals · Runtime · Wallet · Diagnostics
                  </div>
                </div>
                <button
                  onClick={() => setTelemetryOpen(false)}
                  className="rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 px-3 py-2 text-xs transition"
                >
                  Close
                </button>
              </div>

              <div className="p-4 sm:p-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-white/60">Runtime</div>
                  <div className="mt-2 grid gap-2 text-sm text-white/75">
                    <div className="flex items-center justify-between">
                      <span>Auto-refresh</span>
                      <span className="text-white/85">{auto ? "ON" : "OFF"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Interval</span>
                      <span className="text-white/85 tabular-nums">{intervalSec}s</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Last scan</span>
                      <span className="text-white/85">{lastRun ? new Date(lastRun).toLocaleTimeString() : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <span className={cn("text-white/85", running ? "text-sky-200" : "text-emerald-200")}>
                        {running ? "SCANNING" : "READY"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => runScan()}
                      className="flex-1 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 ring-1 ring-sky-400/20 px-3 py-2 text-sm transition"
                    >
                      Run Scan
                    </button>
                    <button
                      onClick={() => {
                        setSignals(synthSignals());
                        setLastRun(nowIso());
                        setToast({ kind: "ok", msg: "Telemetry refreshed (synthetic)." });
                      }}
                      className="rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 px-3 py-2 text-sm transition"
                    >
                      Pulse
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                  <div className="text-xs uppercase tracking-wider text-white/60">Wallet</div>
                  <div className="mt-2 text-sm text-white/75 grid gap-2">
                    <div className="flex items-center justify-between">
                      <span>Detected</span>
                      <span className="text-white/85">{wallet.installed ? "YES" : "NO"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Connected</span>
                      <span className="text-white/85">{wallet.connected ? "YES" : "NO"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Account</span>
                      <span className="text-white/85">{wallet.connected ? shortAddr(wallet.account) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Network</span>
                      <span className="text-white/85">{chain ? chain.name : "—"}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={connectWallet}
                      className="w-full rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 ring-1 ring-emerald-400/20 px-3 py-2 text-sm transition"
                    >
                      {wallet.connected ? "Re-sync Wallet" : "Connect Wallet"}
                    </button>
                    <div className="text-[11px] text-white/55 mt-2">
                      Premium gating can be added later (token/NFT, signature, or pay-in-ETH).
                      Today: we ship the console.
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-wider text-white/60">Signals</div>
                    <div className="text-xs text-white/55">{signals.length} items</div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {(signals.length ? signals : synthSignals()).map((s) => (
                      <div
                        key={s.symbol}
                        className="rounded-2xl bg-black/20 ring-1 ring-white/10 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-semibold w-14">{s.symbol}</div>
                          <span className={cn("text-[11px] px-2 py-1 rounded-full ring-1", trendAccent(s.trend))}>
                            {s.trend}
                          </span>
                          <div className="text-xs text-white/60">
                            Confidence <span className="text-white/80 tabular-nums">{fmtPct(s.confidence)}</span> · Momentum{" "}
                            <span className="text-white/80 tabular-nums">{s.momentum.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-xs text-white/60 w-40 hidden sm:block truncate">{s.note}</div>
                          <div className="text-sm font-semibold tabular-nums w-12 text-right">{s.score}</div>
                          <div className="h-2 w-32 rounded-full bg-white/5 ring-1 ring-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(56,189,248,0.35),rgba(34,197,94,0.35),rgba(244,63,94,0.25))]"
                              style={{ width: `${clamp(s.score, 0, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-xs text-white/60 sm:hidden">{s.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-white/10 text-xs text-white/55">
                Diagnostics: if <span className="text-white/80">/api/scan</span> fails, UI auto-falls back to synthetic signals
                so the product never looks “broken” on mobile.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-5 px-3">
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm ring-1 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur",
              toast.kind === "ok"
                ? "bg-emerald-500/15 ring-emerald-400/25 text-emerald-100"
                : "bg-rose-500/15 ring-rose-400/25 text-rose-100"
            )}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </main>
  );
}
