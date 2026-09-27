import db from '../db';

export interface AnalyticsEventInput {
  eventType?: string;
  path: string;
  city?: string | null;
  category?: string | null;
  locale?: string | null;
  ip?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
}

export interface CityAnalyticsSummary {
  city: string;
  views: number;
}

export interface CategoryAnalyticsSummary {
  category: string;
  views: number;
}

export interface DailyAnalyticsSummary {
  date: string;
  views: number;
}

// Pre-compiled prepared statements
const insertEventStmt = db.prepare(`
  INSERT INTO analytics_events (event_type, path, city, category, locale, ip, referrer, user_agent)
  VALUES (@eventType, @path, @city, @category, @locale, @ip, @referrer, @userAgent)
`);

const topCitiesStmt = db.prepare(`
  SELECT city, COUNT(*) as views
  FROM analytics_events
  WHERE city IS NOT NULL AND city != ''
    AND created_at >= datetime('now', ?)
  GROUP BY city
  ORDER BY views DESC
  LIMIT ?
`);

const topCategoriesStmt = db.prepare(`
  SELECT category, COUNT(*) as views
  FROM analytics_events
  WHERE category IS NOT NULL AND category != ''
    AND created_at >= datetime('now', ?)
  GROUP BY category
  ORDER BY views DESC
  LIMIT ?
`);

const dailyViewsStmt = db.prepare(`
  SELECT date(created_at) as date, COUNT(*) as views
  FROM analytics_events
  WHERE created_at >= datetime('now', ?)
  GROUP BY date(created_at)
  ORDER BY date ASC
`);

const totalViewsStmt = db.prepare(`
  SELECT COUNT(*) as count
  FROM analytics_events
  WHERE created_at >= datetime('now', ?)
`);

/**
 * Record an analytics event in the local database.
 * Silently catches errors to avoid breaking user request flow.
 */
export function recordAnalyticsEvent(event: AnalyticsEventInput): void {
  try {
    insertEventStmt.run({
      eventType: event.eventType ?? 'pageview',
      path: event.path,
      city: event.city ?? null,
      category: event.category ?? null,
      locale: event.locale ?? 'en',
      ip: event.ip ?? null,
      referrer: event.referrer ?? null,
      userAgent: event.userAgent ? event.userAgent.slice(0, 500) : null,
    });
  } catch (err) {
    // Fail silently in production, avoid logging spam
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Analytics DB] Failed to record event:', err);
    }
  }
}

/**
 * Get top viewed cities in the last N days (e.g. '-7 days', '-30 days').
 */
export function getTopCities(days = 30, limit = 10): CityAnalyticsSummary[] {
  try {
    return topCitiesStmt.all(`-${days} days`, limit) as CityAnalyticsSummary[];
  } catch (err) {
    console.warn('[Analytics DB] getTopCities error:', err);
    return [];
  }
}

/**
 * Get top viewed categories in the last N days.
 */
export function getTopCategories(days = 30, limit = 10): CategoryAnalyticsSummary[] {
  try {
    return topCategoriesStmt.all(`-${days} days`, limit) as CategoryAnalyticsSummary[];
  } catch (err) {
    console.warn('[Analytics DB] getTopCategories error:', err);
    return [];
  }
}

/**
 * Get daily pageview trend for the last N days.
 */
export function getDailyViews(days = 30): DailyAnalyticsSummary[] {
  try {
    return dailyViewsStmt.all(`-${days} days`) as DailyAnalyticsSummary[];
  } catch (err) {
    console.warn('[Analytics DB] getDailyViews error:', err);
    return [];
  }
}

/**
 * Get total views in the last N days.
 */
export function getTotalViews(days = 30): number {
  try {
    const row = totalViewsStmt.get(`-${days} days`) as { count: number } | undefined;
    return row?.count ?? 0;
  } catch (_err) {
    return 0;
  }
}
