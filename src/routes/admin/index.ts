// ── Admin — Barrel ──
// Compose all admin route chunks and export the routers.

import express from 'express';
import { registerContentRoutes } from './content';
import { registerAnalyticsRoutes } from './analytics';
import { registerPaymentRoutes } from './payments';
import { registerEmailRoutes } from './email';
import { registerBackupRoutes } from './backup';

export const pageRouter: express.Router = express.Router();
export const apiRouter: express.Router = express.Router();

// Route registration order must match original admin.ts:
// pages first (top to bottom), then API routes (top to bottom)

// Pages + their API routes
registerContentRoutes(pageRouter, apiRouter);
registerPaymentRoutes(pageRouter, apiRouter);
registerAnalyticsRoutes(pageRouter, apiRouter);
registerEmailRoutes(pageRouter, apiRouter);
registerBackupRoutes(pageRouter, apiRouter);

export default pageRouter;
