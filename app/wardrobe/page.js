'use client';

import { useState, useEffect, useMemo } from 'react';

const SEASONS = ['spring', 'summer', 'fall', 'winter'];

function seasonList(season) {
  if (!season) return [];
  return Object.keys(season).filter((k) => season[k]);
}

export default function WardrobePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active filters (empty string = "all")
  const [fCategory, setFCategory] = useState('');
  const [fSeason, setFSeason] = useState('');
  const [fColor, setFColor] = useState('');
  const [fVibe, setFVibe] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/wardrobe/items');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load');
        setItems(data.items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Build filter option lists from what's actually in the closet.
  const categories = useMemo(
    () =>
