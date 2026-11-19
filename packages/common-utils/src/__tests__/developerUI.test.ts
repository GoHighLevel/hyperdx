import { DeveloperUISchema } from '@/types';

describe('developer UI settings', () => {
  it('hides analysis for existing teams while preserving the remaining sections', () => {
    expect(DeveloperUISchema.parse({})).toEqual({
      analysisMode: false,
      histogram: true,
      sharedFilters: true,
      filters: true,
      denoise: true,
      collapseFiltersByDefault: true,
      defaultPersonalFilterFields: [],
      defaultSummaryFields: [
        'deployment_name',
        'httpRequest.requestMethod',
        'httpRequest.status',
      ],
      hiddenPersonalFilterFields: [],
    });
  });

  it('rejects unknown sections and non-boolean values', () => {
    expect(DeveloperUISchema.safeParse({ admin: true }).success).toBe(false);
    expect(DeveloperUISchema.safeParse({ analysisMode: 'true' }).success).toBe(
      false,
    );
  });

  it('preserves admin summary order and allows an empty default list', () => {
    expect(
      DeveloperUISchema.parse({
        defaultSummaryFields: [' cluster_name ', 'pod_name'],
      }).defaultSummaryFields,
    ).toEqual(['cluster_name', 'pod_name']);
    expect(
      DeveloperUISchema.parse({ defaultSummaryFields: [] })
        .defaultSummaryFields,
    ).toEqual([]);
  });
});
