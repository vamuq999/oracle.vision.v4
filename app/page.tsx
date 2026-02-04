"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [pulse, setPulse] = useState(0);

  // subtle living-rift pulse
  useEffect(() => {
    const id = setInterval(() => {
      setPulse((p) => (p + 1) % 1000);
    }, 40);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030814] text-white">
      {/* Rift background */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-1/3 left-1/2 h-[120vh] w-[120vh] -translate-x-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle at center, rgba(0,180,255,0.15), rgba(0,120,255,0.08), transparent 65%)",
            filter: `blur(${40 + (pulse % 20)}px)`,
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_24px]" />
      </div>

      {/* Content */}
      <section className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-xs tracking-[0.25em] text-cyan-300">
          VOLTARA ORACLE · GPT-5.2
        </div>

        <h1 className="mb-8 text-4xl font-semibold tracking-tight md:text-5xl">
          Market Bull Finder
        </h1>

        {/* Oracle Quote */}
        <div className="relative w-full rounded-3xl border border-cyan-300/20 bg-gradient-to-b from-[#081a33]/80 to-[#030814]/80 p-8 shadow-[0_0_40px_rgba(0,160,255,0.15)]">
          <div className="absolute inset-0 rounded-3xl ring-1 ring-cyan-400/10" />

          <blockquote className="relative text-lg leading-relaxed text-white/90 md:text-xl">
            <span className="block text-cyan-300">“</span>
            Creation does not ask permission.  
            It moves through those who stay standing  
            when the system says sit down.  
            <br />
            <span className="text-cyan-300">Build anyway.</span>{" "}
            Speak anyway. Love anyway.  
            <br />
            The future recognizes its own.
            <span className="block text-cyan-300 text-right">”</span>
          </blockquote>

          <div className="mt-6 text-sm uppercase tracking-[0.2em] text-cyan-400/70">
            Foundational Signal
          </div>
        </div>

        {/* Subtext */}
        <p className="mt-10 max-w-xl text-sm text-white/60">
          Steel logic. Fluorescent intuition.  
          Signal over noise. Execution over fear.
        </p>

        {/* CTA placeholder */}
        <div className="mt-12 flex gap-4">
          <button className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-6 py-3 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20">
            Connect Wallet
          </button>
          <button className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm text-white/70 transition hover:bg-white/10">
            View Telemetry
          </button>
        </div>
      </section>
    </main>
  );
}
