import { toggleLuceneLineComments } from '@/components/SearchInput/queryComments';

describe('toggleLuceneLineComments', () => {
  it('comments every non-empty selected line and preserves indentation', () => {
    expect(
      toggleLuceneLineComments('service:api\n  namespace:payments', 0, 32),
    ).toEqual({
      value: '// service:api\n  // namespace:payments',
      selectionStart: 3,
      selectionEnd: 38,
    });
  });

  it('uncomments selected lines when all non-empty lines are commented', () => {
    expect(
      toggleLuceneLineComments(
        '// service:api\n  // namespace:payments',
        0,
        38,
      ),
    ).toEqual({
      value: 'service:api\n  namespace:payments',
      selectionStart: 0,
      selectionEnd: 32,
    });
  });

  it('toggles only the current line when no range is selected', () => {
    expect(
      toggleLuceneLineComments('service:api\nnamespace:payments', 20, 20),
    ).toEqual({
      value: 'service:api\n// namespace:payments',
      selectionStart: 23,
      selectionEnd: 23,
    });
  });
});
