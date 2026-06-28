import './globals.css';

export const metadata = {
  title: 'Iris — your wardrobe, styled',
  description: 'Shop your closet first.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="wrap topbar-inner">
            <a href="/" className="brand">Iris</a>
            <a href="/style" className="navlink">What to wear</a>
            <a href="/wardrobe" className="navlink">Wardrobe</a>
            <a href="/upload" className="navlink">Add items</a>
            <a href="/settings" className="navlink">Settings</a>
          </div>
        </header>
        <main className="wrap" style={{ paddingTop: 36, paddingBottom: 80 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
