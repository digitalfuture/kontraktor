// ── GA opt-out/in endpoints ──
// Visit /_ga-opt-out once per device to exclude it from analytics.

import { Router } from 'express';

const router = Router();

router.get('/_ga-opt-out', (req, res) => {
  const t = res.locals.t || ((s: string) => s);
  res.cookie('ga_opt_out', '1', {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    httpOnly: false,  // client-side JS also reads it for extra safety
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  res.render('info', {
    title: t('site.name') || 'Kontraktor',
    message: '✅ Google Analytics отключён для этого устройства. Вы больше не будете учитываться в статистике.',
    link: '/_ga-opt-in',
    linkText: 'Включить обратно',
  });
});

router.get('/_ga-opt-in', (req, res) => {
  const t = res.locals.t || ((s: string) => s);
  res.clearCookie('ga_opt_out');
  res.render('info', {
    title: t('site.name') || 'Kontraktor',
    message: '✅ Google Analytics снова включён для этого устройства.',
    link: '/_ga-opt-out',
    linkText: 'Отключить',
  });
});

export default router;
