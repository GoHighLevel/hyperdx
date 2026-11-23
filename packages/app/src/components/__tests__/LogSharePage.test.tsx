jest.mock('@/layout', () => ({
  withAppNav: (component: unknown) => component,
}));
jest.mock('@/components/LogShare', () => ({ SharedLogLink: () => null }));
import Page from '@/../pages/s/[id]';
import { SharedLogLink } from '@/components/LogShare';
import { withAppNav } from '@/layout';

it('protects the short-link page with the ordinary application layout', () => {
  expect(Page.getLayout).toBe(withAppNav);
  expect(Page().type).toBe(SharedLogLink);
});
