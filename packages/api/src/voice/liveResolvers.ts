export interface WeatherActionCard {
  kind: 'weather';
  city: string;
  tempC: number;
  condition: string;
  highC?: number;
  lowC?: number;
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
  'please',
]);

export function stripVoiceStopwords(rawQuery: string): string {
  const tokens = rawQuery
    .replace(/[?!.,;:'"]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !VOICE_STOPWORDS.has(w.toLowerCase()));
  return tokens.join(' ').trim() || rawQuery.trim();
}

export function extractSpokenCity(text: string): string | null {
  const cleaned = text.trim();
  const patterns = [
    /\b(?:consider\s+)?(?:my\s+)?location\s+(?:as|is|to\s+be)\s+([a-zA-Z][a-zA-Z\s-]{1,35})/i,
    /\bi(?:'m|\s+am|\s+live|\s+stay)\s+(?:in|at|from|near)\s+([a-zA-Z][a-zA-Z\s-]{1,35})/i,
    /\b(?:city|place)\s+(?:is|as)\s+([a-zA-Z][a-zA-Z\s-]{1,35})/i,
    /\b(?:weather|temperature|forecast|aqi|air\s+quality|panchang)\s+(?:in|for|at|of)\s+([a-zA-Z][a-zA-Z\s-]{1,35})/i,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      const candidate = m[1]
        .replace(/\b(today|now|right now|please|thanks|thank you|for today)\b.*$/i, '')
        .replace(/[.,?!]+$/g, '')
        .trim();
      if (
        candidate.length >= 2 &&
        candidate.length <= 36 &&
        !/^(?:my\s+location|current\s+location|my\s+city|my\s+area|my\s+place|this\s+area|this\s+place|here|nearby|home|the\s+area|the\s+city)$/i.test(
          candidate,
        )
      ) {
        return candidate;
      }
    }
  }
  return null;
}

export function isPlaceOrDirectionsQuery(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\b(weather|temperature|forecast|news|headlines|stock|share price)\b/.test(lower)) {
    return false;
  }
  return /\b(nearest|near me|nearby|directions to|how to reach|closest|traffic|gas station|petrol|fuel|ev charger|charging station|parking|doctor|hospital|clinic|pharmacy|chemist|restaurant|cafe|coffee|hotel|atm|bank|airport|station|metro|bus stop|grocery|supermarket|mall|temple|map)\b/.test(
    lower,
  );
}

export function detectMediaIntent(text: string): MediaActionCard | null {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const wantsSpotify = /\bspotify\b/i.test(lower);
  const wantsYoutube = /\b(youtube|you tube)\b/i.test(lower);
  const wantsPlayMusic =
    /\b(play|listen to|put on|open)\b/i.test(lower) &&
    (wantsSpotify ||
      wantsYoutube ||
      /\b(song|songs|music|track|playlist|album|video|bhajan|podcast)\b/i.test(lower));

  if (!wantsPlayMusic) {
    return null;
  }

  const query =
    trimmed
      .replace(
        /^(?:please\s+)?(?:can you\s+)?(?:play|listen to|put on|open)\s+/i,
        '',
      )
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
    const aqiLabel =
      typeof usAqi === 'number'
        ? usAqi <= 50
          ? 'Good'
          : usAqi <= 100
            ? 'Moderate'
            : usAqi <= 150
              ? 'Unhealthy for sensitive groups'
              : usAqi <= 200
                ? 'Unhealthy'
                : 'Very Unhealthy'
        : '';
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
  _opts?: { mode?: string },
): Promise<{ summaryText: string; card: NewsActionCard } | null> {
  try {
    const cleanQuery = stripVoiceStopwords(rawQuery);
    const allowsOldNews = /\b(202[0-5]|19\d\d|old|archive|history|historical|last year|last month)\b/i.test(
      rawQuery,
    );
    const wantsIndiaTop = /\b(india|indian|national|bharat)\b/i.test(rawQuery);
    const localSearchUrl = (process.env.SEARXNG_INSTANCE_URL || 'http://127.0.0.1:8880').replace(
      /\/+$/,
      '',
    );
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

    // Fetch Google News Top Stories RSS (always fresh today's front-page headlines) + local satchida-search in parallel
    const rssUrl = wantsIndiaTop
      ? 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en'
      : `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=en-IN&gl=IN&ceid=IN:en`;

    const [rssRes, searchRes] = await Promise.all([
      fetch(rssUrl, { signal: AbortSignal.timeout(2500) }).catch(() => null),
      fetch(`${localSearchUrl}/search?q=${encodeURIComponent(cleanQuery)}&format=json`, {
        signal: AbortSignal.timeout(2500),
      }).catch(() => null),
    ]);

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

    if (freshItems.length < 5 && searchRes && searchRes.ok) {
      const data = (await searchRes.json().catch(() => ({}))) as {
        results?: Array<{
          title?: string;
          content?: string;
          publishedDate?: string;
          url?: string;
          engine?: string;
        }>;
      };
      for (const r of Array.isArray(data.results) ? data.results : []) {
        if (r.engine === 'wikipedia') {
          continue;
        }
        const snippet = (r.content || '')
          .replace(/&lt;[^&]*&gt;/g, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        addHeadline(r.title || '', (r.url || '').trim(), r.publishedDate, snippet);
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
