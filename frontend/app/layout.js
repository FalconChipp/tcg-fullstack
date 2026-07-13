import "@/styles/global.css";

export const metadata = {
  title: 'SixByFive TCG',
  description: 'Your Pokémon TCG collection manager',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
