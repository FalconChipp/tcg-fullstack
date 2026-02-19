// frontend/app/layout.js

export const metadata = {
  title: "SixByFive TCG",
  description: "SixByFive TCG",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
