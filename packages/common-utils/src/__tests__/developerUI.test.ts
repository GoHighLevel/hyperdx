import { DeveloperUISchema } from '@/types';

describe('developer UI settings', () => {
  it('hides analysis for existing teams while preserving the remaining sections', () => {
    expect(DeveloperUISchema.parse({})).toEqual({
      analysisMode: false,
      histogram: true,
      sharedFilters: true,
      filters: true,
      denoise: true,
    });
  });

  it('rejects unknown sections and non-boolean values', () => {
    expect(DeveloperUISchema.safeParse({ admin: true }).success).toBe(false);
    expect(DeveloperUISchema.safeParse({ analysisMode: 'true' }).success).toBe(
      false,
    );
  });
});
