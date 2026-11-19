import { parseWorkspaceIdentity } from '@/utils/googleWorkspace';

const identity = {
  sub: 'google-user-123',
  email: 'Vikas.Goswami@gohighlevel.com',
  email_verified: true,
  hd: 'gohighlevel.com',
};
describe('Google Workspace identity boundary', () => {
  it('normalizes the verified email and requires the Workspace domain', () => {
    expect(parseWorkspaceIdentity(identity, 'gohighlevel.com').email).toBe(
      'vikas.goswami@gohighlevel.com',
    );
  });
  it.each([
    { ...identity, email_verified: false },
    { ...identity, email_verified: 'true' },
    { ...identity, hd: undefined },
    { ...identity, hd: 'other-company.com' },
    { ...identity, email: 'user@gohighlevel.com.attacker.test' },
    { ...identity, sub: '' },
  ])('rejects an untrusted identity: %j', profile => {
    expect(() => parseWorkspaceIdentity(profile, 'gohighlevel.com')).toThrow();
  });
});
