import "./globals.css";

export const metadata = {
  title: "CyberIntercept",
  description: "CyberIntercept frontend application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
