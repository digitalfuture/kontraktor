import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';

const PROPERTY_ID = process.env.GA_PROPERTY_ID || '';
const CREDENTIALS_PATH = process.env.GA_CREDENTIALS_PATH || '';
const TOKENS_PATH = process.env.GA_TOKENS_PATH || '';

// Cache last fetch results to avoid repeated API calls
let lastFetch = {
  time: 0,
  daily: null as DailyMetrics | null,
  realtime: null as RealtimeMetrics | null,
  topPages: null as TopPage[] | null,
  sources: null as Source[] | null,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface DailyMetrics {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  screenPageViews: number;
  bounceRate: number;
  avgSessionDuration: number;
}

interface RealtimeMetrics {
  activeUsers: number;
  pageViews: number;
}

interface TopPage {
  path: string;
  title: string;
  views: number;
  users: number;
}

interface Source {
  source: string;
  users: number;
  sessions: number;
}

interface TrafficTrend {
  date: string;
  users: number;
  sessions: number;
  pageViews: number;
}

let auth: any = null;

function getAuth(): any {
  if (auth) return auth;

  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.warn('[GA4] OAuth credentials file not found at', CREDENTIALS_PATH);
      return null;
    }
    if (!fs.existsSync(TOKENS_PATH)) {
      console.warn('[GA4] OAuth tokens file not found at', TOKENS_PATH);
      return null;
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')).installed;
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));

    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uris?.[0] || 'http://localhost',
    );

    oauth2Client.setCredentials(tokens);

    // Auto-refresh token handler
    oauth2Client.on('tokens', (newTokens: any) => {
      if (newTokens.refresh_token) {
        // Save new refresh token if issued
        const saved = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
        saved.refresh_token = newTokens.refresh_token;
        fs.writeFileSync(TOKENS_PATH, JSON.stringify(saved, null, 2));
      }
      if (newTokens.access_token) {
        // Save new access token
        const saved = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
        saved.access_token = newTokens.access_token;
        saved.expiry_date = newTokens.expiry_date;
        fs.writeFileSync(TOKENS_PATH, JSON.stringify(saved, null, 2));
      }
    });

    auth = oauth2Client;
    return auth;
  } catch (err) {
    console.error('[GA4] Failed to initialize OAuth:', err);
    return null;
  }
}

function isCacheValid(): boolean {
  return Date.now() - lastFetch.time < CACHE_TTL;
}

async function runReport(requestBody: any): Promise<any> {
  const a = getAuth();
  if (!a) return null;

  try {
    // Refresh token if expired (auto-handled by googleapis)
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth: a });
    const response = await analyticsData.properties.runReport({
      property: `properties/${PROPERTY_ID}`,
      requestBody,
    });
    return response.data;
  } catch (err: any) {
    // If token expired, force refresh and retry
    if (err?.response?.status === 401) {
      console.warn('[GA4] Token expired, refreshing...');
      try {
        await a.refreshAccessToken();
        const analyticsData = google.analyticsdata({ version: 'v1beta', auth: a });
        const response = await analyticsData.properties.runReport({
          property: `properties/${PROPERTY_ID}`,
          requestBody,
        });
        return response.data;
      } catch (retryErr: any) {
        console.error('[GA4] Retry failed:', retryErr.message);
        return null;
      }
    }
    console.error('[GA4] API error:', err?.message || err);
    return null;
  }
}

async function runRealtimeReport(requestBody: any): Promise<any> {
  const a = getAuth();
  if (!a) return null;

  try {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth: a });
    const response = await analyticsData.properties.runRealtimeReport({
      property: `properties/${PROPERTY_ID}`,
      requestBody,
    });
    return response.data;
  } catch (err: any) {
    if (err?.response?.status === 401) {
      try {
        await a.refreshAccessToken();
        const analyticsData = google.analyticsdata({ version: 'v1beta', auth: a });
        const response = await analyticsData.properties.runRealtimeReport({
          property: `properties/${PROPERTY_ID}`,
          requestBody,
        });
        return response.data;
      } catch (retryErr: any) {
        console.error('[GA4] Retry failed:', retryErr.message);
        return null;
      }
    }
    console.error('[GA4] Realtime API error:', err?.message || err);
    return null;
  }
}

export async function getDailyMetrics(): Promise<DailyMetrics | null> {
  if (isCacheValid() && lastFetch.daily) return lastFetch.daily;

  const data = await runReport({
    dateRanges: [{ startDate: 'today', endDate: 'today' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
  });

  if (!data?.rows?.length) return null;

  const row = data.rows[0];
  const metricValues = row.metricValues || [];

  const metrics: DailyMetrics = {
    activeUsers: parseInt(metricValues[0]?.value || '0', 10),
    newUsers: parseInt(metricValues[1]?.value || '0', 10),
    sessions: parseInt(metricValues[2]?.value || '0', 10),
    screenPageViews: parseInt(metricValues[3]?.value || '0', 10),
    bounceRate: parseFloat(metricValues[4]?.value || '0'),
    avgSessionDuration: parseFloat(metricValues[5]?.value || '0'),
  };

  lastFetch.daily = metrics;
  lastFetch.time = Date.now();
  return metrics;
}

export async function getRealtimeMetrics(): Promise<RealtimeMetrics | null> {
  if (isCacheValid() && lastFetch.realtime) return lastFetch.realtime;

  const data = await runRealtimeReport({
    metrics: [
      { name: 'activeUsers' },
      { name: 'screenPageViews' },
    ],
  });

  if (!data?.rows?.length) return null;

  const row = data.rows[0];
  const metricValues = row.metricValues || [];

  const metrics: RealtimeMetrics = {
    activeUsers: parseInt(metricValues[0]?.value || '0', 10),
    pageViews: parseInt(metricValues[1]?.value || '0', 10),
  };

  lastFetch.realtime = metrics;
  lastFetch.time = Date.now();
  return metrics;
}

export async function getTopPages(limit: number = 10): Promise<TopPage[]> {
  if (isCacheValid() && lastFetch.topPages) return lastFetch.topPages;

  const data = await runReport({
    dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'pageTitle' },
    ],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit,
  });

  if (!data?.rows) return [];

  const pages: TopPage[] = data.rows.map((row: any) => {
    const dims = row.dimensionValues || [];
    const vals = row.metricValues || [];
    return {
      path: dims[0]?.value || '',
      title: dims[1]?.value || '',
      views: parseInt(vals[0]?.value || '0', 10),
      users: parseInt(vals[1]?.value || '0', 10),
    };
  });

  lastFetch.topPages = pages;
  lastFetch.time = Date.now();
  return pages;
}

export async function getTrafficSources(limit: number = 10): Promise<Source[]> {
  if (isCacheValid() && lastFetch.sources) return lastFetch.sources;

  const data = await runReport({
    dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'sessionSource' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
    ],
    orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
    limit,
  });

  if (!data?.rows) return [];

  const sources: Source[] = data.rows.map((row: any) => {
    const dims = row.dimensionValues || [];
    const vals = row.metricValues || [];
    return {
      source: dims[0]?.value || '(direct)',
      users: parseInt(vals[0]?.value || '0', 10),
      sessions: parseInt(vals[1]?.value || '0', 10),
    };
  });

  lastFetch.sources = sources;
  lastFetch.time = Date.now();
  return sources;
}

export async function getTrafficTrend(days: number = 7): Promise<TrafficTrend[]> {
  const data = await runReport({
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
    limit: days,
  });

  if (!data?.rows) return [];

  const trend: TrafficTrend[] = data.rows.map((row: any) => {
    const dims = row.dimensionValues || [];
    const vals = row.metricValues || [];
    return {
      date: dims[0]?.value || '',
      users: parseInt(vals[0]?.value || '0', 10),
      sessions: parseInt(vals[1]?.value || '0', 10),
      pageViews: parseInt(vals[2]?.value || '0', 10),
    };
  });

  return trend;
}

export function invalidateCache(): void {
  lastFetch = { time: 0, daily: null, realtime: null, topPages: null, sources: null };
}
