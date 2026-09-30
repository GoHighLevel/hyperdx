import Team from '@/models/team';

it('retains ordered summary defaults in the team document', () => {
  const team = new Team({
    name: 'Example',
    developerUI: { defaultSummaryFields: ['cluster_name', 'labels.product'] },
  });
  expect(team.validateSync()).toBeUndefined();
  expect(team.toObject().developerUI?.defaultSummaryFields).toEqual([
    'cluster_name',
    'labels.product',
  ]);
});
