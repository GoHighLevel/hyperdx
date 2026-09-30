import {
  validateDashboardFilterModes,
  validateDashboardFilterOptionUniqueness,
  validateDashboardFilterVariableNames,
} from '@hyperdx/common-utils/dist/dashboardValidation';
import { isPrometheusLabelFilter } from '@hyperdx/common-utils/dist/filters';
import {
  DashboardFilter,
  DashboardSchema,
  DashboardWithoutIdSchema,
  PresetDashboard,
  PresetDashboardFilterSchema,
  resolveChartPaletteToken,
  walkRawDashboardTileColors,
} from '@hyperdx/common-utils/dist/types';
import express from 'express';
import _ from 'lodash';
import { z } from 'zod';
import { validateRequest } from 'zod-express-middleware';

import { IS_LOCAL_APP_MODE } from '@/config';
import {
  createDashboard,
  deleteDashboard,
  getDashboard,
  getDashboards,
  updateDashboard,
} from '@/controllers/dashboard';
import { dashboardFolderWriteError } from '@/controllers/dashboardFolders';
import {
  createPresetDashboardFilter,
  deletePresetDashboardFilter,
  getPresetDashboardFilters,
  updatePresetDashboardFilter,
} from '@/controllers/presetDashboardFilters';
import { getSources } from '@/controllers/sources';
import { getNonNullUserWithTeam } from '@/middleware/auth';
import { getUserRole, requireAdminForWrites } from '@/middleware/permissions';
import type { ObjectId } from '@/models';
import DashboardFolder from '@/models/dashboardFolder';
import { getPromqlLabelFilterSourceError } from '@/routers/external-api/v2/utils/dashboards';
import { objectIdSchema } from '@/utils/zod';

// create routes that will get and update dashboards
const router = express.Router();
// Preset filters are global configuration, not folder-owned dashboards.
router.use('/preset', requireAdminForWrites);

/**
 * Additional filter validation (variable name and option uniqueness, at least one mode enabled).
 */
const addFilterIssues = (
  data: {
    filters?: {
      name: string;
      options?: string[];
      variableName?: string;
      isBroadcastEnabled?: boolean;
      isVariableEnabled?: boolean;
    }[];
  },
  ctx: z.RefinementCtx,
) => {
  validateDashboardFilterVariableNames(data.filters ?? [], ctx);
  validateDashboardFilterModes(data.filters ?? [], ctx);
  validateDashboardFilterOptionUniqueness(data.filters ?? [], ctx);
};

/** Returns new and updated PROMETHEUS_LABEL filters. */
function filterChangedPromqlLabelFilters(
  filters: DashboardFilter[],
  existingFilters: DashboardFilter[],
) {
  const existingSourceById = new Map(
    existingFilters
      .filter(isPrometheusLabelFilter)
      .map(filter => [filter.id, filter.source]),
  );
  return filters
    .filter(isPrometheusLabelFilter)
    .filter(filter => existingSourceById.get(filter.id) !== filter.source);
}

/**
 * Rejects PROMETHEUS_LABEL filters whose `source` is missing or is not a PromQL
 * source. Returns an error message, or null when there is nothing to reject.
 */
async function validatePromqlLabelFilterSources(
  teamId: ObjectId,
  filters: DashboardFilter[] = [],
  existingFilters?: DashboardFilter[],
): Promise<string | null> {
  const promqlLabelFilters = existingFilters
    ? filterChangedPromqlLabelFilters(filters, existingFilters)
    : filters.filter(isPrometheusLabelFilter);
  if (promqlLabelFilters.length === 0) return null;

  const sources = await getSources(teamId.toString());
  return getPromqlLabelFilterSourceError(
    sources,
    promqlLabelFilters.map(filter => filter.source),
  );
}

/**
 * Heal legacy `chart-1`..`chart-10` tile colors from #2265 on the request
 * body *before* `validateRequest` runs `ChartPaletteTokenSchema`. Keeps the
 * schema strict (so `z.input` == `z.output` and `req.body` infers cleanly)
 * while still accepting payloads from any non-React HTTP client whose
 * stored values haven't yet been healed by the app-side normalizer
 * (`normalizeDashboardTileColors` in `packages/app/src/dashboard.ts`).
 *
 * This is a one-release deprecation shim — once stored data has converged
 * on the hue-named tokens, it can be removed in favor of straight-strict
 * validation. The actual walk delegates to `walkRawDashboardTileColors`
 * in common-utils so this middleware, the app-side normalizer, the JSON
 * import path, and the provisioner all share the same per-tile traversal.
 */
const migrateLegacyDashboardTileColors: express.RequestHandler = (
  req,
  _res,
  next,
) => {
  req.body = walkRawDashboardTileColors(req.body, current => {
    const resolved = resolveChartPaletteToken(current);
    return resolved ?? current;
  });
  next();
};

router.get('/', async (req, res, next) => {
  try {
    const { teamId } = getNonNullUserWithTeam(req);

    const [dashboards, folders, role] = await Promise.all([
      getDashboards(teamId),
      DashboardFolder.find({ team: teamId }),
      getUserRole(req.user),
    ]);
    const editableFolders = new Set(
      folders.filter(f => f.access === 'team').map(f => f.id),
    );
    return res.json(
      dashboards.map(d => ({
        ...d,
        canEdit:
          IS_LOCAL_APP_MODE ||
          role === 'admin' ||
          (!d.provisioned && !!d.folderId && editableFolders.has(d.folderId)),
      })),
    );
  } catch (e) {
    next(e);
  }
});

router.post(
  '/',
  migrateLegacyDashboardTileColors,
  validateRequest({
    body: DashboardWithoutIdSchema.superRefine(addFilterIssues),
  }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);

      // `provisioned` marks a dashboard as machine-managed by
      // ProvisionDashboardsTask, whose upsert overwrites tiles/tags/filters
      // wholesale. It is server-owned: `validateRequest` validates without
      // replacing `req.body`, and DashboardSchema is non-strict, so a
      // client-supplied value would otherwise persist and hand the caller's
      // dashboard to the provisioner.
      const dashboard = DashboardWithoutIdSchema.parse(
        _.omit(req.body, 'provisioned'),
      );

      const sourceError = await validatePromqlLabelFilterSources(
        teamId,
        req.body.filters,
      );
      if (sourceError != null) {
        return res.status(400).json({ message: sourceError });
      }

      const isAdmin =
        IS_LOCAL_APP_MODE || (await getUserRole(req.user)) === 'admin';
      const folderError = await dashboardFolderWriteError(
        teamId,
        dashboard.folderId,
        isAdmin,
      );
      if (folderError) return res.status(403).json({ message: folderError });
      if (!isAdmin && dashboard.tiles.some(tile => tile.config.alert)) {
        return res.status(403).json({
          message:
            'Only admins can configure alerts. Remove alert settings before importing.',
        });
      }

      const newDashboard = await createDashboard(teamId, dashboard, userId);

      res.json(newDashboard.toJSON());
    } catch (e) {
      next(e);
    }
  },
);

router.patch(
  '/:id',
  migrateLegacyDashboardTileColors,
  validateRequest({
    params: z.object({
      id: objectIdSchema,
    }),
    body: DashboardSchema.partial().superRefine(addFilterIssues),
  }),
  async (req, res, next) => {
    try {
      const { teamId, userId } = getNonNullUserWithTeam(req);
      const { id: dashboardId } = req.params;

      const dashboard = await getDashboard(dashboardId, teamId);

      if (dashboard == null) {
        return res.sendStatus(404);
      }

      const isAdmin =
        IS_LOCAL_APP_MODE || (await getUserRole(req.user)) === 'admin';
      if (!isAdmin && dashboard.provisioned) return res.sendStatus(403);
      const currentFolderError = await dashboardFolderWriteError(
        teamId,
        dashboard.folderId,
        isAdmin,
      );
      if (currentFolderError) {
        return res.status(403).json({ message: currentFolderError });
      }

      // Only omit undefined values, keep null (which signals field removal)
      // `provisioned` is server-owned — see the POST handler above.
      const updates: Partial<z.infer<typeof DashboardWithoutIdSchema>> =
        _.omitBy(
          _.omit(req.body, 'provisioned', 'id'),
          _.isUndefined,
        ) as Partial<z.infer<typeof DashboardWithoutIdSchema>>;
      if (updates.folderId !== undefined) {
        const folderError = await dashboardFolderWriteError(
          teamId,
          updates.folderId,
          isAdmin,
        );
        if (folderError) {
          return res.status(403).json({ message: folderError });
        }
      }
      if (
        !isAdmin &&
        updates.tiles?.some(
          tile =>
            tile.config.alert &&
            !_.isEqual(
              tile.config.alert,
              dashboard.tiles.find(previous => previous.id === tile.id)?.config
                .alert,
            ),
        )
      ) {
        return res
          .status(403)
          .json({ message: 'Only admins can configure alerts.' });
      }

      const sourceError = await validatePromqlLabelFilterSources(
        teamId,
        req.body.filters,
        dashboard.filters ?? [],
      );
      if (sourceError != null) {
        return res.status(400).json({ message: sourceError });
      }

      const updatedDashboard = await updateDashboard(
        dashboardId,
        teamId,
        updates,
        userId,
        isAdmin ? undefined : (dashboard.folderId ?? undefined),
      );

      res.json(updatedDashboard);
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/:id',
  validateRequest({
    params: z.object({ id: objectIdSchema }),
  }),
  async (req, res, next) => {
    try {
      const { teamId } = getNonNullUserWithTeam(req);
      const { id: dashboardId } = req.params;

      const dashboard = await getDashboard(dashboardId, teamId);
      if (!dashboard) return res.sendStatus(404);
      const isAdmin =
        IS_LOCAL_APP_MODE || (await getUserRole(req.user)) === 'admin';
      if (!isAdmin && dashboard.provisioned) return res.sendStatus(403);
      const folderError = await dashboardFolderWriteError(
        teamId,
        dashboard.folderId,
        isAdmin,
      );
      if (folderError) return res.status(403).json({ message: folderError });

      await deleteDashboard(
        dashboardId,
        teamId,
        isAdmin ? undefined : (dashboard.folderId ?? undefined),
      );

      res.sendStatus(204);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/preset/:presetDashboard/filters',
  validateRequest({
    params: z.object({
      presetDashboard: z.nativeEnum(PresetDashboard),
    }),
    query: z.object({
      sourceId: objectIdSchema,
    }),
  }),
  async (req, res, next) => {
    try {
      const { teamId } = getNonNullUserWithTeam(req);
      const { presetDashboard } = req.params;
      const { sourceId } = req.query;

      const filters = await getPresetDashboardFilters(
        teamId,
        sourceId,
        presetDashboard,
      );

      return res.json(filters);
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  '/preset/:presetDashboard/filter',
  validateRequest({
    body: z.object({
      filter: PresetDashboardFilterSchema,
    }),
    params: z.object({
      presetDashboard: z.nativeEnum(PresetDashboard),
    }),
  }),
  async (req, res, next) => {
    try {
      const { teamId } = getNonNullUserWithTeam(req);
      const { filter } = req.body;

      if (filter.presetDashboard !== req.params.presetDashboard) {
        return res
          .status(400)
          .json({ error: 'Preset dashboard in body and params do not match' });
      }
      const updatedPresetDashboardFilter = await updatePresetDashboardFilter(
        teamId,
        filter,
      );

      if (!updatedPresetDashboardFilter) {
        return res.status(404).send();
      }

      return res.json(updatedPresetDashboardFilter);
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/preset/:presetDashboard/filter',
  validateRequest({
    body: z.object({
      filter: PresetDashboardFilterSchema,
    }),
    params: z.object({
      presetDashboard: z.nativeEnum(PresetDashboard),
    }),
  }),
  async (req, res, next) => {
    try {
      const { teamId } = getNonNullUserWithTeam(req);
      const { filter } = req.body;

      if (filter.presetDashboard !== req.params.presetDashboard) {
        return res
          .status(400)
          .json({ error: 'Preset dashboard in body and params do not match' });
      }

      const newPresetDashboardFilter = await createPresetDashboardFilter(
        teamId,
        filter,
      );

      return res.json(newPresetDashboardFilter);
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  '/preset/:presetDashboard/filter/:id',
  validateRequest({
    params: z.object({
      presetDashboard: z.nativeEnum(PresetDashboard),
      id: objectIdSchema,
    }),
  }),
  async (req, res, next) => {
    try {
      const { teamId } = getNonNullUserWithTeam(req);
      const { presetDashboard, id } = req.params;

      const deleted = await deletePresetDashboardFilter(
        teamId,
        presetDashboard,
        id,
      );

      if (!deleted) {
        return res.status(404).send();
      }

      return res.json(deleted);
    } catch (e) {
      next(e);
    }
  },
);

export default router;
