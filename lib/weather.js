// Weather lookup via Open-Meteo (free, no API key).
// Near-term dates use the live forecast; far-future dates fall back to a
// seasonal estimate from the same calendar window last year.

const WMO = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'foggy', 48: 'foggy', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain', 66: 'freezing rain', 67: 'freezing rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'rain showers', 81: 'rain showers', 82: 'heavy showers',
  85: 'snow showers', 86: 'snow showers', 95: 'thunderstorms', 96: 'thunderstorms', 99: 'thunderstorms',
};

function daysBetween(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
function iso(d) {
  return d.toISOString().slice(0, 10);
}

async function geocode(location) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results || !data.results.length) return null;
  const r = data.results[0];
  const label = [r.name, r.admin1, r.country_code].filter(Boolean).join(', ');
  return { lat: r.latitude, lon: r.longitude, label };
}

export async function getWeatherForDate(location, dateStr) {
  try {
    const geo = await geocode(location);
    if (!geo) return { ok: false, reason: `Couldn't find "${location}".` };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${dateStr}T00:00:00`);
    const ahead = daysBetween(today, target);

    // Within the forecast horizon: use the live forecast.
    if (ahead >= 0 && ahead <= 15) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
        `&temperature_unit=fahrenheit&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
      const res = await fetch(url);
      const d = await res.json();
      const day = d.daily;
      return {
        ok: true,
        location: geo.label,
        high: Math.round(day.temperature_2m_max[0]),
        low: Math.round(day.temperature_2m_min[0]),
        precip: day.precipitation_probability_max?.[0] ?? null,
        description: WMO[day.weather_code?.[0]] || 'mixed',
        source: 'forecast',
      };
    }

    // Further out: estimate from the same week last year (seasonal average).
    const lastYear = new Date(target);
    lastYear.setFullYear(target.getFullYear() - 1);
    const start = new Date(lastYear); start.setDate(start.getDate() - 3);
    const end = new Date(lastYear); end.setDate(end.getDate() + 3);
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${geo.lat}&longitude=${geo.lon}` +
      `&start_date=${iso(start)}&end_date=${iso(end)}` +
      `&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`;
    const res = await fetch(url);
    const d = await res.json();
    const highs = (d.daily?.temperature_2m_max || []).filter((x) => x != null);
    const lows = (d.daily?.temperature_2m_min || []).filter((x) => x != null);
    if (!highs.length) return { ok: false, reason: 'No seasonal data available.' };
    const avg = (arr) => Math.round(arr.reduce((s, x) => s + x, 0) / arr.length);
    return {
      ok: true,
      location: geo.label,
      high: avg(highs),
      low: avg(lows),
      precip: null,
      description: 'seasonal estimate',
      source: 'seasonal',
    };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}
