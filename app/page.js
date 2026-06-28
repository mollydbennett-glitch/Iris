export default function Home() {
  return (
    <div>
      <p className="pill">Phase 1</p>
      <h1 className="display">Shop your closet first.</h1>
      <p className="lede">
        Iris sees everything you own, learns how it works together, and tells you
        what to wear. Start by adding a few pieces — snap or upload a photo and
        Iris will tag it for you.
      </p>
      <div style={{ marginTop: 28, display: 'flex', gap: 12 }}>
        <a href="/upload" className="btn">Add your first items</a>
        <a href="/wardrobe" className="btn btn-ghost">View wardrobe</a>
      </div>
    </div>
  );
}
