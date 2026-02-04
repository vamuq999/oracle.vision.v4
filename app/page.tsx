"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Regime = "ACCUMULATION" | "DISTRIBUTION" | "CHOP" | "EXPANSION";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function sydneyNowFull() {
  // AEDT-aware (Australia/Sydney handles DST automatically)
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(new Date());
}

function sydneyTZShort() {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    timeZoneName: "short",
  }).formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value || "AEDT";
}

function fmtUptime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  parts.push(`${h}h`, `${m}m`, `${sec}s`);
  return parts.join(" ");
}

function computeRegime(score: number, vol: number, mom: number): Regime {
  // Simple heuristic: you can swap this later for your real scanner output.
  if (score > 66 && mom > 0.2 && vol > 0.35) return "EXPANSION";
  if (score < 45 && mom < -0.15 && vol > 0.35) return "DISTRIBUTION";
  if (vol < 0.25) return "CHOP";
  return "ACCUMULATION";
}

function reasonCodes(score: number, mom: number, vol: number) {
  const r: string[] = [];
  if (vol < 0.25) r.push("Volume compression");
  if (mom > 0.18) r.push("Momentum expansion");
  if (mom < -0.12) r.push("Momentum divergence");
  if (score >= 55 && score <= 62) r.push("Liquidity pause");
  if (!r.length) r.push("Signal stabilizing");
  return r.slice(0, 3);
}

function HeartGeometry({ intensity = 0.75 }: { intensity?: number }) {
  // A “heart geometry” lattice that breathes behind the orb.
  const opacity = clamp(intensity, 0.25, 1);
  return (
    <svg
      viewBox="0 0 600 420"
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, opacity, animation: "breathe 4.8s ease-in-out infinite" }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="hgGlow" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="rgba(255,211,107,.38)" />
          <stop offset="45%" stopColor="rgba(76,240,209,.22)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <linearGradient id="hgLine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(214,230,255,.38)" />
          <stop offset="55%" stopColor="rgba(76,240,209,.32)" />
          <stop offset="100%" stopColor="rgba(255,211,107,.28)" />
        </linearGradient>
        <filter id="soft">
          <feGaussianBlur stdDeviation="0.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="0" y="0" width="600" height="420" fill="url(#hgGlow)" />

      {/* Heart curve (stylized) */}
      <path
        d="M300 345
           C220 290, 155 240, 155 175
           C155 120, 195 95, 235 95
           C270 95, 292 115, 300 130
           C308 115, 330 95, 365 95
           C405 95, 445 120, 445 175
           C445 240, 380 290, 300 345 Z"
        fill="none"
        stroke="url(#hgLine)"
        strokeWidth="2.2"
        filter="url(#soft)"
      />

      {/* Geometry lattice */}
      {Array.from({ length: 10 }).map((_, i) => {
        const t = i / 9;
        const y = 105 + t * 230;
        const xL = 175 + t * 40;
        const xR = 425 - t * 40;
        return (
          <path
            key={i}
            d={`M ${xL} ${y} L 300 ${y + 18} L ${xR} ${y}`}
            fill="none"
            stroke="rgba(214,230,255,.18)"
            strokeWidth="1.2"
          />
        );
      })}
      {Array.from({ length: 8 }).map((_, i) => {
        const t = i / 7;
        const x = 210 + t * 180;
        return (
          <path
            key={`v-${i}`}
            d={`M ${x} 120 L 300 345`}
            fill="none"
            stroke="rgba(76,240,209,.16)"
            strokeWidth="1.1"
          />
        );
      })}
    </svg>
  );
}

function OracleOrb({ score }: { score: number }) {
  const glow = useMemo(() => {
    // 0..100 score maps to subtle gold/teal emphasis
    const g = clamp(score / 100, 0, 1);
    return {
      outer: `rgba(76,240,209,${0.18 + g * 0.10})`,
      inner: `rgba(255,211,107,${0.10 + g * 0.18})`,
    };
  }, [score]);

  return (
    <div
      style={{
        position: "relative",
        height: 310,
        borderRadius: 16,
        border: "1px solid var(--line)",
        background: "rgba(0,0,0,.18)",
        overflow: "hidden",
      }}
    >
      <HeartGeometry intensity={0.9} />

      {/* Orb stack */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          padding: 14,
        }}
      >
        <div
          style={{
            width: 210,
            height: 210,
            borderRadius: 999,
            background: `radial-gradient(circle at 40% 32%, ${glow.inner}, rgba(214,230,255,.08) 40%, rgba(0,0,0,.22) 72%)`,
            border: "1px solid rgba(255,255,255,.14)",
            boxShadow: `0 0 34px ${glow.outer}, 0 18px 60px rgba(0,0,0,.55)`,
            position: "relative",
            animation: "pulseGlow 3.2s ease-in-out infinite",
          }}
        >
          {/* Rings */}
          <div
            style={{
              position: "absolute",
              inset: -18,
              borderRadius: 999,
              border: "1px solid rgba(214,230,255,.18)",
              boxShadow: "0 0 22px rgba(76,240,209,.12)",
              animation: "slowSpin 18s linear infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: -38,
              borderRadius: 999,
              border: "1px solid rgba(255,211,107,.16)",
              animation: "slowSpin 32s linear infinite reverse",
            }}
          />

          {/* Core label */}
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 950, letterSpacing: 1, fontSize: 12, opacity: 0.8 }}>
                ORACLE CORE
              </div>
              <div style={{ fontWeight: 1000, fontSize: 34, marginTop: 6 }}>
                {Math.round(score)}%
              </div>
              <div style={{ fontWeight: 900, opacity: 0.72, marginTop: 2 }}>
                NEUTRAL
              </div>
              <div className="small" style={{ opacity: 0.72, marginTop: 6 }}>
                Steel logic · Fluorescent intuition
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [targets, setTargets] = useState("Voltara");
  const [auto, setAuto] = useState(true);
  const [intervalSec, setIntervalSec] = useState(10);

  const [systemTime, setSystemTime] = useState(sydneyNowFull());
  const [lastScan, setLastScan] = useState<string>("—");
  const [scanId, setScanId] = useState<string>("—");

  const [score, setScore] = useState(58);
  const [delta, setDelta] = useState(0);

  const [vol, setVol] = useState(0.22);
  const [mom, setMom] = useState(0.06);

  const [walletDetected, setWalletDetected] = useState(false);
  const [address, setAddress] = useState<string>("");

  const genesisRef = useRef<number>(0);
  const [uptime, setUptime] = useState("0h 0m 0s");

  const tz = useMemo(() => sydneyTZShort(), []);

  const regime = useMemo(() => computeRegime(score, vol, mom), [score, vol, mom]);
  const reasons = useMemo(() => reasonCodes(score, mom, vol), [score, mom, vol]);

  // Constant Sydney timestamp ticker
  useEffect(() => {
    const t = setInterval(() => setSystemTime(sydneyNowFull()), 1000);
    return () => clearInterval(t);
  }, []);

  // Genesis / uptime
  useEffect(() => {
    const key = "oracle_genesis_ms";
    const stored = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    const g = stored ? Number(stored) : Date.now();
    genesisRef.current = g;
    if (!stored) localStorage.setItem(key, String(g));

    const t = setInterval(() => {
      setUptime(fmtUptime(Date.now() - genesisRef.current));
    }, 1000);

    return () => clearInterval(t);
  }, []);

  // Wallet detection (MetaMask)
  useEffect(() => {
    const eth = (window as any).ethereum;
    setWalletDetected(!!eth);
  }, []);

  async function connectWallet() {
    try {
      const eth = (window as any).ethereum;
      if (!eth) return;
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const a = accounts?.[0] || "";
      setAddress(a);
    } catch {
      // ignore (user cancelled)
    }
  }

  function runScan() {
    // This is a local “motion telemetry” scan. Later you can replace with your /api/scan.
    const prev = score;

    // gentle stochastic motion so it feels alive but not manic
    const nextScore = clamp(
      Math.round(prev + (Math.random() - 0.5) * 6),
      0,
      100
    );

    const nextVol = clamp(vol + (Math.random() - 0.48) * 0.08, 0, 1);
    const nextMom = clamp(mom + (Math.random() - 0.52) * 0.12, -1, 1);

    setScore(nextScore);
    setDelta(nextScore - prev);
    setVol(Number(nextVol.toFixed(2)));
    setMom(Number(nextMom.toFixed(2)));

    const now = sydneyNowFull();
    setLastScan(now);

    const id = `${Math.floor(Math.random() * 0xffff).toString(16).toUpperCase()}-${Math.floor(
      Math.random() * 0xffff
    ).toString(16).toUpperCase()}`;
    setScanId(id);
  }

  // Auto refresh
  useEffect(() => {
    if (!auto) return;
    runScan(); // immediate
    const t = setInterval(runScan, clamp(intervalSec, 3, 60) * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, intervalSec]);

  return (
    <div className="shell">
      <div className="wrap">
        <div className="topbar">
          <div className="brand">
            <div className="title">Oracle Vision Minter v4</div>
            <div className="sub">VOLTARA ORACLE · GPT-5.2 · Bull Finder Pro</div>
          </div>

          <div className="nav">
            <Link className="pill" href="/">Home</Link>
            <Link className="pill" href="/mint">Mint</Link>
            <a className="pill" href="#telemetry">Telemetry</a>
          </div>
        </div>

        <div className="hero">
          <div className="heroInner">
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="h1">Market Bull Finder</div>
                  <div className="muted">
                    Signal over noise. A hi-tech bull detector that stays calm when the market screams.
                  </div>
                </div>
                <div className="badge">
                  <span className="dot" />
                  LIVE
                </div>
              </div>

              <div className="sep" />

              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small muted">
                  <div><b>System time:</b> {systemTime}</div>
                  <div><b>Last scan:</b> {lastScan}</div>
                  <div><b>Scan ID:</b> <span className="gold">{scanId}</span></div>
                </div>

                <div className="small muted" style={{ textAlign: "right" }}>
                  <div><b>Oracle uptime:</b> {uptime}</div>
                  <div><b>Timezone:</b> Sydney ({tz})</div>
                  <div><b>Targets:</b> {targets || "—"}</div>
                </div>
              </div>

              <div className="kpiGrid" id="telemetry">
                <div className="kpi">
                  <div className="label">Bull Score</div>
                  <div className="value">{Math.round(score)}%</div>
                </div>
                <div className="kpi">
                  <div className="label">Δ from last scan</div>
                  <div className="value">{delta >= 0 ? `+${delta}` : `${delta}`}</div>
                </div>
                <div className="kpi">
                  <div className="label">Regime</div>
                  <div className="value">{regime}</div>
                </div>
                <div className="kpi">
                  <div className="label">Signal posture</div>
                  <div className="value">STEEL</div>
                </div>
              </div>

              <div className="sep" />

              <div className="row" style={{ gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div className="small muted" style={{ marginBottom: 6 }}>Targets</div>
                  <input
                    className="input"
                    value={targets}
                    onChange={(e) => setTargets(e.target.value)}
                    placeholder="Voltara, BTC, ETH…"
                  />
                </div>
                <button className="btn" onClick={runScan}>Run</button>
                <button
                  className="btn"
                  onClick={() => alert(`Reasons:\n• ${reasons.join("\n• ")}\n\nVol: ${vol}\nMom: ${mom}`)}
                >
                  View
                </button>
              </div>

              <div className="row" style={{ marginTop: 10, alignItems: "center" }}>
                <label className="badge" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={auto}
                    onChange={(e) => setAuto(e.target.checked)}
                    style={{ transform: "scale(1.15)" }}
                  />
                  Auto-refresh
                </label>

                <div style={{ flex: 1 }}>
                  <div className="small muted" style={{ marginBottom: 4 }}>
                    Interval <b>{intervalSec}s</b>
                  </div>
                  <input
                    className="slider"
                    type="range"
                    min={3}
                    max={30}
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="sep" />

              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 950 }}>Reason codes</div>
                  <div className="muted small">
                    • {reasons[0]}<br />
                    • {reasons[1]}<br />
                    • {reasons[2]}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 950 }}>Wallet</div>
                  <div className="muted small">
                    {walletDetected ? (
                      address ? (
                        <>Connected: <span className="gold">{address.slice(0, 6)}…{address.slice(-4)}</span></>
                      ) : (
                        <>MetaMask detected · <button className="btn" style={{ marginLeft: 8 }} onClick={connectWallet}>Connect</button></>
                      )
                    ) : (
                      <>MetaMask not detected on this browser.</>
                    )}
                  </div>
                </div>
              </div>

              <div className="footerNote">
                Voltara Oracle · Scan synchronized with local system time · Sydney ({tz}) · Snapshot is a record, not a prediction.
              </div>
            </div>

            <div className="card">
              <OracleOrb score={score} />
              <div className="sep" />
              <div className="small muted">
                <b>Mind-Heart Geometry:</b> motion lattice driven by scan cadence.<br />
                <b>Telemetry Inputs:</b> score, momentum ({mom}), volume ({vol}).<br />
                <b>Design Doctrine:</b> calm authority — no flashing, no panic.
              </div>
              <div className="sep" />
              <div className="row">
                <span className="badge"><span className="dot" /> ORB ONLINE</span>
                <span className="badge">HEART GEOMETRY</span>
                <span className="badge">TIME-STAMPED</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }} className="card">
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Minter</div>
          <div className="muted small">
            Your existing minter should stay at <b>/mint</b>. This Home screen is the Bull Finder Pro layer.
            If you want, we can also embed the minter panel here (iframe or shared component).
          </div>
        </div>
      </div>
    </div>
  );
}
