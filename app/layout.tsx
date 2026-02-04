// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Oracle Vision — Bull Finder Pro",
  description: "Voltara Oracle · Telemetry · Minter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
