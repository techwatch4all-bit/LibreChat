export interface WeatherActionCard {
  kind: 'weather';
  city: string;
  tempC: number;
  condition: string;
  highC?: number;
  lowC?: number;
  aqi?: number;
  aqiLabel?: string;
  pm25?: number;
}

export interface NewsHeadlineItem {
  title: string;
  url: string;
  source?: string;
}

export interface NewsActionCard {
  kind: 'news';
  query: string;
  items: NewsHeadlineItem[];
}

export interface MapsActionCard {
  kind: 'maps';
  title: string;
  subtitle: string;
  mapUrl: string;
  embedUrl?: string;
}

export interface TutorActionCard {
  kind: 'tutor';
  title: string;
  subtitle: string;
}

export interface MediaActionCard {
  kind: 'media';
  platform: 'youtube' | 'spotify';
  title: string;
  query: string;
  openUrl: string;
  embedUrl?: string;
  installUrl?: string;
}

export type VoiceActionCard =
  | WeatherActionCard
  | NewsActionCard
  | MapsActionCard
  | TutorActionCard
  | MediaActionCard;

const VOICE_STOPWORDS = new Set([
  'okay',
  'ok',
  'hey',
  'hi',
  'hello',
  'please',
  'well',
  'so',
  'um',
  'uh',
  'then',
  'can',
  'could',
  'would',
  'will',
  'are',
  'you',
  'able',
  'to',
  'provide',
  'give',
  'tell',
  'me',
  'check',
  'find',
  'search',
  'get',
  'show',
  'with',
  'i',
  'want',
  'need',
  'like',
  'know',
  'hear',
  'see',
  'about',
  'the',
  'a',
  'an',
  'some',
  'any',
  'for',
  'of',
  'is',
  'my',
  'your',
  'what',
  'whats',
  'focus',
  'on',
  'itself',
  'region',
  'only',
  'just',
  'actually',
  'brief',
  'am',
  'interested',
  'items',
  'looking',
  'wondering',
  'from',
  'let',
  'lets',
  's',
  'say',
  'oh',
  'no',
  'enough',
]);

const HINDI_SEARCH_TERM_MAP: Array<[RegExp, string]> = [
  [/(?:गोल्ड|सोना|सोने)/gu, 'gold'],
  [/(?:सिल्वर|चांदी|चाँदी)/gu, 'silver'],
  [/(?:पेट्रोल)/gu, 'petrol'],
  [/(?:डीजल|डीज़ल)/gu, 'diesel'],
  [/(?:एलपीजी|गैस)/gu, 'LPG gas'],
  [/(?:प्राइस|भाव|कीमत|कीमतें|रेट)/gu, 'price rate'],
  [/(?:आज|ताजा|ताज़ा)/gu, 'today'],
  [/(?:भारत|इंडिया)/gu, 'India'],
  [/(?:न्यूज़|समाचार|खबर|खबरें)/gu, 'news'],
  [/(?:मौसम|तापमान)/gu, 'weather'],
];

export function stripVoiceStopwords(rawQuery: string): string {
  // If the utterance is in Devanagari with market/news/weather keywords, map to clean English search terms
  if (/[\u0900-\u097F]/.test(rawQuery)) {
    const mapped: string[] = [];
    for (const [re, eng] of HINDI_SEARCH_TERM_MAP) {
      if (re.test(rawQuery)) {
        mapped.push(eng);
      }
    }
    if (mapped.length >= 2) {
      if (!mapped.includes('India')) {
        mapped.push('India');
      }
      return mapped.join(' ');
    }
  }
  const tokens = rawQuery
    .replace(/[?!.,;:'"]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !VOICE_STOPWORDS.has(w.toLowerCase()));
  return tokens.join(' ').trim() || rawQuery.trim();
}

const NON_CITY_LOCATION_PHRASES =
  /^(?:my\s+location|current\s+location|my\s+city|my\s+area|my\s+place|this\s+area|this\s+place|here|nearby|home|the\s+area|the\s+city|location|place|city|india|world|global)$/i;

function sanitizeCityCandidate(raw: string): string | null {
  const candidate = raw
    .replace(
      /\b(today|now|right now|please|thanks|thank you|for today|currently|again|instead|too|also)\b.*$/i,
      '',
    )
    .replace(/[.,?!]+$/g, '')
    .trim();
  if (
    candidate.length >= 2 &&
    candidate.length <= 36 &&
    !NON_CITY_LOCATION_PHRASES.test(candidate)
  ) {
    return candidate;
  }
  return null;
}

/**
 * Extracts a city ONLY when the user explicitly declares their OWN home/current location
 * (e.g. "I am in Kolkata", "my location is Pune", "consider my location as Delhi").
 * Never matches query-target cities like "AQI of Mumbai" or "weather in London".
 */
export function extractSelfLocationCity(text: string): string | null {
  const cleaned = text.trim();
  // Never treat a question challenging an assumed location ("why did you assume my location is Mumbai?") as a declaration
  if (/\b(why\s+did\s+you|did\s+you\s+assume|not\s+in|not\s+my\s+location)\b/i.test(cleaned)) {
    return null;
  }
  const patterns = [
    /\b(?:consider\s+)?(?:my\s+)?location\s+(?:as|is|to\s+be)\s+([a-zA-Z][a-zA-Z\s-]{1,35})/i,
    /\bi(?:'m|\s+am|\s+live|\s+stay|\s+reside)\s+(?:in|at|from|near)\s+([a-zA-Z][a-zA-Z\s-]{1,35})/i,
    /\bmy\s+(?:city|hometown|place)\s+(?:is|as)\s+([a-zA-Z][a-zA-Z\s-]{1,35})/i,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      const candidate = sanitizeCityCandidate(m[1]);
      if (candidate) {
        return candidate;
      }
    }
  }
  return null;
}

export function extractSpokenCity(text: string): string | null {
  const cleaned = text.trim();
  const selfCity = extractSelfLocationCity(cleaned);
  if (selfCity) {
    return selfCity;
  }
  const queryPatterns = [
    /\b(?:city|place)\s+(?:is|as)\s+([a-zA-Z][a-zA-Z\s-]{1,35})/i,
    /\b(?:weather|temperature|forecast|aqi|air\s+quality|panchang)\s+(?:in|for|at|of)\s+([a-zA-Z][a-zA-Z\s-]{1,35})/i,
  ];
  for (const re of queryPatterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      const candidate = sanitizeCityCandidate(m[1]);
      if (candidate) {
        return candidate;
      }
    }
  }
  return null;
}

export function isPlaceOrDirectionsQuery(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    /\b(weather|temperature|forecast|news|headlines|stock|share price|price|prices|rate|rates|cost)\b/.test(
      lower,
    )
  ) {
    return false;
  }
  return /\b(nearest|near me|nearby|directions to|how to reach|closest|traffic|gas station|petrol pump|fuel station|ev charger|charging station|parking|doctor|hospital|clinic|pharmacy|chemist|restaurant|cafe|coffee|hotel|atm|bank|airport|station|metro|bus stop|grocery|supermarket|mall|temple|map)\b/.test(
    lower,
  );
}

export function detectMediaIntent(text: string): MediaActionCard | null {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const wantsSpotify = /\bspotify\b/i.test(lower);
  const wantsYoutube = /\b(youtube|you tube)\b/i.test(lower);
  const wantsPlayMusic =
    /\b(play|listen to|put on|open|embed|attach|watch|stream|show)\b/i.test(lower) &&
    (wantsSpotify ||
      wantsYoutube ||
      /\b(song|songs|music|track|playlist|album|video|bhajan|podcast|channel|live news)\b/i.test(
        lower,
      ));

  if (!wantsPlayMusic) {
    return null;
  }

  const query =
    trimmed
      .replace(/^(?:please\s+)?(?:can you\s+)?(?:play|listen to|put on|open)\s+/i, '')
      .replace(/\b(?:on|in|using|via)\s+(?:spotify|youtube|you tube)\b/gi, '')
      .replace(/\b(?:spotify|youtube|you tube)\b/gi, '')
      .replace(/[?!.]+$/g, '')
      .trim() || 'trending music';

  const platform: 'youtube' | 'spotify' = wantsSpotify ? 'spotify' : 'youtube';
  const encoded = encodeURIComponent(query);

  if (platform === 'spotify') {
    return {
      kind: 'media',
      platform: 'spotify',
      title: 'Play on Spotify',
      query,
      openUrl: `https://open.spotify.com/search/${encoded}`,
      installUrl: 'https://play.google.com/store/apps/details?id=com.spotify.music',
    };
  }

  return {
    kind: 'media',
    platform: 'youtube',
    title: 'Play on YouTube',
    query,
    openUrl: `https://m.youtube.com/results?search_query=${encoded}`,
  };
}

export function isWeatherQuery(text: string): boolean {
  return /\b(weather|temperature|forecast|rain|raining|humidity|aqi)\b/i.test(text);
}

export function isNewsQuery(text: string): boolean {
  return /\b(news|headlines|breaking|top stories|current events)\b/i.test(text);
}

export async function resolveYouTubeEmbedUrl(query: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      {
        signal: AbortSignal.timeout(2500),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Satchida-LiveVoice/1.0)' },
      },
    );
    if (!res.ok) {
      return undefined;
    }
    const html = await res.text();
    const ids = Array.from(
      new Set([...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1])),
    ).slice(0, 5);
    for (const videoId of ids) {
      // Verify the video allows embedding via YouTube oEmbed before embedding
      const oembed = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(1500) },
      ).catch(() => null);
      if (oembed && oembed.ok) {
        return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`;
      }
    }
  } catch {
    // Non-blocking fallback to launcher link
  }
  return undefined;
}

function extractCleanPoiTerm(rawQuery: string): string {
  const lower = rawQuery.toLowerCase();
  if (/\b(petrol pump|petrol station|fuel station|gas station|petrol|fuel)\b/.test(lower)) {
    return 'fuel';
  }
  if (/\b(hospital|clinic|doctor|emergency)\b/.test(lower)) {
    return 'hospital';
  }
  if (/\b(pharmacy|chemist|medical store)\b/.test(lower)) {
    return 'pharmacy';
  }
  if (/\b(atm|bank)\b/.test(lower)) {
    return 'bank';
  }
  if (/\b(restaurant|cafe|coffee|food)\b/.test(lower)) {
    return 'restaurant';
  }
  return rawQuery
    .replace(
      /\b(which|and|is|the|nearest|near|me|to|my|location|closest|find|show|in|south dumdum|west bengal)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchNearestPlaceWithEta(
  query: string,
  originLat: number,
  originLng: number,
): Promise<{ name: string; distanceKm: number; durationMin: number } | null> {
  try {
    const cleanPoi = extractCleanPoiTerm(query) || query;
    const delta = 0.08;
    const viewbox = `${originLng - delta},${originLat + delta},${originLng + delta},${originLat - delta}`;
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanPoi)}&viewbox=${viewbox}&bounded=1&limit=1`,
      {
        signal: AbortSignal.timeout(2200),
        headers: { 'User-Agent': 'Satchida-LiveVoice/1.0' },
      },
    );
    if (!nomRes.ok) {
      return null;
    }
    const hits = (await nomRes.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;
    const hit = hits?.[0];
    if (!hit?.lat || !hit?.lon) {
      return null;
    }
    const destLat = Number(hit.lat);
    const destLng = Number(hit.lon);
    const name = (hit.display_name || query).split(',').slice(0, 2).join(', ').trim();

    const osrmRes = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`,
      { signal: AbortSignal.timeout(2200) },
    ).catch(() => null);
    if (osrmRes && osrmRes.ok) {
      const route = (await osrmRes.json()) as {
        routes?: Array<{ distance?: number; duration?: number }>;
      };
      const first = route.routes?.[0];
      if (typeof first?.distance === 'number' && typeof first?.duration === 'number') {
        return {
          name,
          distanceKm: Math.round((first.distance / 1000) * 10) / 10,
          durationMin: Math.max(1, Math.round(first.duration / 60)),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function describeWmoCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Light drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Partly cloudy';
}

export async function fetchStructuredWeather(
  cityOrQuery: string,
  coords?: { lat?: number; lng?: number; city?: string },
): Promise<{ summaryText: string; card: WeatherActionCard } | null> {
  try {
    const explicitCity = extractSpokenCity(cityOrQuery);
    let lat = explicitCity ? undefined : coords?.lat;
    let lng = explicitCity ? undefined : coords?.lng;
    let resolvedCity = explicitCity || coords?.city || '';

    if ((typeof lat !== 'number' || typeof lng !== 'number') && resolvedCity) {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(resolvedCity)}&count=1&language=en&format=json`,
        { signal: AbortSignal.timeout(3000) },
      );
      if (geoRes.ok) {
        const geo = (await geoRes.json()) as {
          results?: Array<{ latitude: number; longitude: number; name: string; country?: string }>;
        };
        const hit = geo.results?.[0];
        if (hit) {
          lat = hit.latitude;
          lng = hit.longitude;
          resolvedCity = hit.country ? `${hit.name}, ${hit.country}` : hit.name;
        }
      }
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return null;
    }

    const [wxRes, aqiRes] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`,
        { signal: AbortSignal.timeout(3000) },
      ),
      fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lng))}&current=us_aqi,pm2_5,pm10`,
        { signal: AbortSignal.timeout(3000) },
      ).catch(() => null),
    ]);
    if (!wxRes.ok) {
      return null;
    }
    const wx = (await wxRes.json()) as {
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        relative_humidity_2m?: number;
        weather_code?: number;
      };
      daily?: {
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
      };
    };
    const aqiData =
      aqiRes && aqiRes.ok
        ? ((await aqiRes.json().catch(() => null)) as {
            current?: { us_aqi?: number; pm2_5?: number; pm10?: number };
          } | null)
        : null;
    const temp = wx.current?.temperature_2m;
    if (typeof temp !== 'number') {
      return null;
    }
    const condition = describeWmoCode(wx.current?.weather_code ?? 0);
    const highC = wx.daily?.temperature_2m_max?.[0];
    const lowC = wx.daily?.temperature_2m_min?.[0];
    const humidity = wx.current?.relative_humidity_2m;
    const feelsLike = wx.current?.apparent_temperature;
    const usAqi = aqiData?.current?.us_aqi;
    const pm25 = aqiData?.current?.pm2_5;
    let aqiLabel = '';
    if (typeof usAqi === 'number') {
      if (usAqi <= 50) {
        aqiLabel = 'Good';
      } else if (usAqi <= 100) {
        aqiLabel = 'Moderate';
      } else if (usAqi <= 150) {
        aqiLabel = 'Unhealthy for sensitive groups';
      } else if (usAqi <= 200) {
        aqiLabel = 'Unhealthy';
      } else {
        aqiLabel = 'Very Unhealthy';
      }
    }
    const displayCity = resolvedCity || 'your location';

    const summaryText =
      `Live Weather & AQI for ${displayCity}: ${Math.round(temp)}°C (${condition})` +
      (typeof feelsLike === 'number' ? `, feels like ${Math.round(feelsLike)}°C` : '') +
      (typeof humidity === 'number' ? `, humidity ${Math.round(humidity)}%` : '') +
      (typeof highC === 'number' && typeof lowC === 'number'
        ? `, today's high ${Math.round(highC)}°C and low ${Math.round(lowC)}°C`
        : '') +
      (typeof usAqi === 'number'
        ? `. Air Quality (US AQI): ${Math.round(usAqi)} (${aqiLabel})` +
          (typeof pm25 === 'number' ? `, PM2.5 ${Math.round(pm25)} µg/m³.` : '.')
        : '.');

    return {
      summaryText,
      card: {
        kind: 'weather',
        city: displayCity,
        tempC: Math.round(temp),
        condition,
        highC: typeof highC === 'number' ? Math.round(highC) : undefined,
        lowC: typeof lowC === 'number' ? Math.round(lowC) : undefined,
        aqi: typeof usAqi === 'number' ? Math.round(usAqi) : undefined,
        aqiLabel: aqiLabel || undefined,
        pm25: typeof pm25 === 'number' ? Math.round(pm25) : undefined,
      },
    };
  } catch {
    return null;
  }
}

const JUNK_NEWS_PATTERNS =
  /\b(school assembly|live tv|watch live|horoscope|rashifal|astrology|panchang|quiz|crossword|sudoku|bollywood gossip|bigg boss|coupon|promo code)\b/i;

export async function fetchStructuredNews(
  rawQuery: string,
  opts?: { mode?: string; locationCity?: string; timeZone?: string },
): Promise<{ summaryText: string; card: NewsActionCard } | null> {
  try {
    const isIndiaTz = Boolean(opts?.timeZone && /calcutta|kolkata|india/i.test(opts.timeZone));
    const wantsRegional = /\b(my region|local news|my area|my state|around here)\b/i.test(rawQuery);
    const cleanQuery =
      wantsRegional && opts?.locationCity
        ? `${opts.locationCity} latest news`
        : stripVoiceStopwords(rawQuery);
    const allowsOldNews =
      /\b(202[0-5]|19\d\d|old|archive|history|historical|last year|last month)\b/i.test(rawQuery);
    const hasSpecificTopic =
      /\b(fuel|gas|petrol|diesel|lpg|gold|silver|stock|nifty|sensex|cricket|ipl|football|tech|ai|election|tariff|economy|budget|weather|cyclone|rbi|rupee|bitcoin|crypto)\b/i.test(
        rawQuery,
      );
    const wantsIndiaTop =
      !hasSpecificTopic &&
      !wantsRegional &&
      (/\b(india|indian|national|bharat)\b/i.test(rawQuery) ||
        (isIndiaTz && /\b(top|latest|key|headline|headlines|today)\b/i.test(rawQuery)));
    const nowMs = Date.now();
    const maxAgeMs = 72 * 60 * 60 * 1000;
    const freshItems: NewsHeadlineItem[] = [];
    const freshLines: string[] = [];
    const seenTitles = new Set<string>();

    const addHeadline = (title: string, url: string, pubDate?: string, snippet?: string) => {
      if (freshItems.length >= 5) {
        return;
      }
      const cleanTitle = title.replace(/<[^>]+>/g, '').trim();
      if (!cleanTitle || JUNK_NEWS_PATTERNS.test(cleanTitle)) {
        return;
      }
      const key = cleanTitle.toLowerCase().slice(0, 48);
      if (seenTitles.has(key)) {
        return;
      }
      if (!allowsOldNews && pubDate) {
        const parsed = Date.parse(pubDate);
        if (!Number.isNaN(parsed) && nowMs - parsed > maxAgeMs) {
          return;
        }
      }
      seenTitles.add(key);
      const safeUrl = url.startsWith('http')
        ? url
        : `https://news.google.com/search?q=${encodeURIComponent(cleanTitle)}`;
      freshItems.push({ title: cleanTitle, url: safeUrl, source: pubDate || undefined });
      freshLines.push(
        snippet && !snippet.startsWith(cleanTitle)
          ? `- ${cleanTitle}: ${snippet.slice(0, 180)}`
          : `- ${cleanTitle}`,
      );
    };

    // Fetch Google News RSS directly (no slow SearXNG in live voice path)
    const rssUrl = wantsIndiaTop
      ? 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en'
      : `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=en-IN&gl=IN&ceid=IN:en`;

    const rssRes = await fetch(rssUrl, { signal: AbortSignal.timeout(4000) }).catch(() => null);

    if (rssRes && rssRes.ok) {
      const xml = await rssRes.text();
      const rssMatches = [
        ...xml.matchAll(
          /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>[\s\S]*?<link>(.*?)<\/link>[\s\S]*?<pubDate>(.*?)<\/pubDate>[\s\S]*?<\/item>/g,
        ),
      ].slice(0, 10);
      for (const m of rssMatches) {
        addHeadline(m[1] || '', (m[2] || '').trim(), (m[3] || '').trim());
      }
    }

    if (freshItems.length === 0) {
      return null;
    }

    return {
      summaryText: freshLines.join('\n'),
      card: {
        kind: 'news',
        query: cleanQuery,
        items: freshItems,
      },
    };
  } catch {
    return null;
  }
}
