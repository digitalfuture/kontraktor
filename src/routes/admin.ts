// ── Admin Routes (legacy re-export) ──
// Admin routes have been split into routes/admin/ directory.
// This file re-exports everything for backward compatibility.

import { pageRouter, apiRouter } from './admin/index';
export { pageRouter, apiRouter };
export default pageRouter;
