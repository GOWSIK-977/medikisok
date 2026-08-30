import "./globals.css";

export const metadata = {
  title: "MediKiosk — AIIA Patient Intake",
  description: "AI-assisted clinical case-taking kiosk (SIH26047)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
