import { bestNetPayableForCrossSellSeat } from '../crossSellPricing';

describe('bestNetPayableForCrossSellSeat — bundle permutations (offer vs list)', () => {
  const participant = { email: 'deepti@example.com', dashboard_family_member_id: 'd1' };
  const buyLine = {
    type: 'program',
    programId: 'awrp',
    participants: [{ email: 'deepti@example.com', dashboard_family_member_id: 'd1' }],
  };
  const hmLine = { type: 'program', programId: 'hm', participants: [participant] };

  it('100% cross-sell drives net to 0 when both offer and list exist (client-best)', () => {
    const matches = [
      {
        buyProgramId: 'awrp',
        matchTarget: { discount_type: 'percentage', discount_value: 100 },
      },
    ];
    expect(
      bestNetPayableForCrossSellSeat(hmLine, participant, [], [buyLine], 999, 9000, matches),
    ).toBe(0);
  });

  it('25% uses min(offer net, list net) when both bases exist', () => {
    const matches = [
      {
        buyProgramId: 'awrp',
        matchTarget: { discount_type: 'percentage', discount_value: 25 },
      },
    ];
    const netO = 999 - Math.round((999 * 25) / 100);
    const netL = 9000 - Math.round((9000 * 25) / 100);
    expect(
      bestNetPayableForCrossSellSeat(hmLine, participant, [], [buyLine], 999, 9000, matches),
    ).toBe(Math.min(netO, netL));
  });

  it('no identity overlap keeps baseline (999)', () => {
    const stranger = { email: 'other@example.com', dashboard_family_member_id: 'x' };
    const matches = [
      {
        buyProgramId: 'awrp',
        matchTarget: { discount_type: 'percentage', discount_value: 100 },
      },
    ];
    expect(
      bestNetPayableForCrossSellSeat(
        { ...hmLine, participants: [stranger] },
        stranger,
        [],
        [buyLine],
        999,
        9000,
        matches,
      ),
    ).toBe(999);
  });

  it('empty rule list returns offer baseline', () => {
    expect(bestNetPayableForCrossSellSeat(hmLine, participant, [], [buyLine], 999, 9000, [])).toBe(999);
  });
});
