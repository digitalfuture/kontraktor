import express, { Request, Response, NextFunction } from 'express';
import db from '../db';
import { serviceIcons, defaultServiceIcon } from '../config/service-icons';
import * as seoLib from '../lib/seo';

const router: express.Router = express.Router();

interface DbCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
}

interface DbSubcategory {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  price_from: string;
  contractors_count: number;
}

/** Get localized name from DB record */
function localizedName(
  record: { name?: string; name_en?: string | null; name_id?: string | null },
  locale: string
): string {
  if (locale === 'id' && record.name_id) return record.name_id;
  if (locale === 'en' && record.name_en) return record.name_en;
  return record.name || '';
}

function localizedDescription(
  record: { description?: string; description_en?: string | null; description_id?: string | null },
  locale: string
): string {
  if (locale === 'id' && record.description_id) return record.description_id;
  if (locale === 'en' && record.description_en) return record.description_en;
  return record.description || '';
}

router.get('/', (req: Request, res: Response): void => {
  const locale = (res.locals.locale as string) || 'en';

  const categories = db.prepare('SELECT id, name, slug, description, icon, is_active FROM categories WHERE is_active = 1 ORDER BY name').all() as DbCategory[];

  const subcategories = db.prepare('SELECT id, category_id, name, slug, price_from, contractors_count FROM subcategories ORDER BY category_id, name').all() as DbSubcategory[];

  // Build subcategories map
  const subMap = new Map<number, DbSubcategory[]>();
  for (const sub of subcategories) {
    const arr = subMap.get(sub.category_id) || [];
    arr.push(sub);
    subMap.set(sub.category_id, arr);
  }

  const services = categories.map((cat) => {
    const subs = subMap.get(cat.id) || [];
    // Get market price: first subcategory price or empty
    const marketPrice = subs.length > 0 ? (subs[0].price_from || '') : '';
    const hasContractors = (db.prepare('SELECT COUNT(*) as count FROM contractors WHERE category_id = ? AND is_approved = 1 AND is_active = 1').get(cat.id) as { count: number }).count > 0;
    return {
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      description: cat.description,
      totalContractors: (db.prepare('SELECT COUNT(*) as count FROM contractors WHERE category_id = ? AND is_approved = 1 AND is_active = 1').get(cat.id) as { count: number }).count,
      marketPrice,
      hasContractors,
      subcategories: subs.map((sub) => ({
        name: sub.name,
        slug: sub.slug,
        count: sub.contractors_count,
        priceFrom: sub.price_from || '',
      })),
    };
  });

  res.render('services', {
    seo: seoLib.servicesPageSeo(locale as 'en' | 'id'),
    title: locale === 'id' ? 'Layanan — Kontraktor' : 'Services — Kontraktor',
    services,
    iconMap: serviceIcons,
    defaultIcon: defaultServiceIcon,
  });
});

router.get('/:slug', (req: Request, res: Response, _next: NextFunction): void => {
  const locale = (res.locals.locale as string) || 'en';
  const { slug } = req.params;

  const category = db.prepare('SELECT id, name, slug, description, icon FROM categories WHERE slug = ? AND is_active = 1').get(slug) as DbCategory | undefined;

  if (!category) {
    res.status(404);
    res.render('error', { message: locale === 'id' ? 'Layanan tidak ditemukan' : 'Service not found' });
    return;
  }

  const subcategories = db.prepare('SELECT id, category_id, name, slug, price_from, contractors_count FROM subcategories WHERE category_id = ? ORDER BY name').all(category.id) as DbSubcategory[];

  const contractors = db.prepare(`
    SELECT c.id, c.name, c.avatar_url, c.specialty, (SELECT name FROM categories WHERE slug = c.specialty) as specialty_name, c.rating, c.reviews_count, c.completed_projects
    FROM contractors c
    WHERE c.category_id = ? AND c.is_approved = 1 AND c.is_active = 1
    ORDER BY c.rating DESC, c.reviews_count DESC
    LIMIT 10
  `).all(category.id) as Array<{
    id: number;
    name: string;
    avatar_url: string | null;
    specialty: string | null;
    rating: number | null;
    reviews_count: number | null;
    completed_projects: number | null;
  }>;

  const service = {
    name: category.name,
    slug: category.slug,
    icon: serviceIcons[category.slug] || defaultServiceIcon,
    description: category.description,
    totalContractors: (db.prepare('SELECT COUNT(*) as count FROM contractors WHERE category_id = ? AND is_approved = 1 AND is_active = 1').get(category.id) as { count: number }).count,
    hasVerifiedContractors: (db.prepare("SELECT COUNT(*) as count FROM contractors WHERE category_id = ? AND is_approved = 1 AND is_active = 1 AND reviews_count > 0").get(category.id) as { count: number }).count > 0,
    subcategories: subcategories.map((sub) => ({
      name: sub.name,
      slug: sub.slug,
      count: sub.contractors_count,
      priceFrom: sub.price_from || '',
    })),
    contractors: contractors.map((ctr) => ({
      id: ctr.id,
      name: ctr.name,
      avatarUrl: ctr.avatar_url || '/avatars/contractor_1.svg',
      specialty: ctr.specialty || '',
      rating: ctr.rating ?? 0,
      reviewsCount: ctr.reviews_count ?? 0,
      completedProjects: ctr.completed_projects ?? 0,
    })),
  };

  res.render('service-detail', {
    seo: seoLib.serviceCategorySeo(slug as string, localizedName(category, locale), localizedDescription(category, locale), locale as 'en' | 'id'),
    title: `${service.name} — Kontraktor`,
    service,
    contractors: service.contractors,
  });
});

export default router;
