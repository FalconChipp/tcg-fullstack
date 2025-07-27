export const metadata = {
  title: 'SixByFive TCG',
  description: 'Your Pokémon TCG collection manager',
};
import "@/styles/global.css";
export default function RootLayout({ children }) {
 return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
