import { callDoubaoAPI, getLocalMockReply } from './doubaoMockApi';

describe('doubaoMockApi', () => {
  it('builds local address text correctly', () => {
    const reply = getLocalMockReply('协议同意回复', {
      address: '北京市朝阳区望京 SOHO',
    });

    expect(reply).toContain('北京市朝阳区望京 SOHO');
    expect(reply).toContain('支持配送');
  });

  it('falls back to local mock when auth token is missing', async () => {
    const reply = await callDoubaoAPI('商品选择完成', { discount: 15.2 }, '');

    expect(reply).toContain('15.2');
    expect(reply).toContain('最大优惠');
  });
});
