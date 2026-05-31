import { simulateTakeoutReply } from './takeoutSimulationService';

describe('takeoutSimulationService', () => {
  it('returns intent acknowledgement text', () => {
    const reply = simulateTakeoutReply({ instruction: '识别外卖意图' });

    expect(reply).toContain('淘宝闪购');
    expect(reply).toContain('账号绑定授权');
  });

  it('returns address-aware recommendation text', () => {
    const reply = simulateTakeoutReply({
      instruction: '协议同意回复',
      payload: { address: '北京市朝阳区望京街道' },
    });

    expect(reply).toContain('北京市朝阳区望京街道');
    expect(reply).toContain('支持配送');
  });

  it('returns discount-aware checkout text', () => {
    const reply = simulateTakeoutReply({
      instruction: '商品选择完成',
      payload: { discount: 18.6 },
    });

    expect(reply).toContain('18.6');
    expect(reply).toContain('最大优惠');
  });
});
