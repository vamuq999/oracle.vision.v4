import "./globals.css";

export const metadata = {
  title: "Oracle Vision — Minter v4",
  description: "Mint Oracle Vision on-chain.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="bg" />
        <header className="header">
          <div className="brand">
            <div className="sigil" />
            <div>
              <div className="title">Oracle Vision</div>
              <div className="subtitle">Minter v4</div>
            </div>
          </div>

          <nav className="nav">
            <a className="link" href="/">Home</a>
            <a className="link" href="/mint">Mint</a>
          </nav>
        </header>

        <main className="main">{children}</main>

        <footer className="footer">
          <span>© {new Date().getFullYear()} Oracle Vision</span>
          <span className="dot">•</span>
          <span className="muted">On-chain art. Clean execution.</span>
        </footer>
      </body>
    </html>
  );
}
