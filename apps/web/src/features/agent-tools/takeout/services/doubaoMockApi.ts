import {
  requestTakeoutSimulation,
  type TakeoutInstruction,
  type TakeoutSimulationPayload,
} from '../../../../lib/api';

export type DoubaoInstruction = '识别外卖意图' | '协议同意回复' | '商品选择完成';

export type DoubaoMockPayload = {
  address?: string;
  discount?: number;
};

const getLocalMockReply = (
  instruction: DoubaoInstruction,
  payload: DoubaoMockPayload = {},
): string => {
  if (instruction === '识别外卖意图') {
    return '我将通过淘宝闪购为你直接下单订餐。在此之前，只需完成 Kronos 与淘宝闪购的账号绑定授权。完成后，我可以根据你的口味偏好，智能推荐餐品并协助完成下单，成为你长期可靠的外卖点单助手，让订餐变得更省心、更便捷。';
  }

  if (instruction === '协议同意回复') {
    const address = payload.address || '上海市浦东新区张江高科技园区博云路2号';
    return `当前你的地址是： ${address}，部分门店当前已暂停营业，我已为你优化推荐附近正在营业，支持配送的店铺和商品。`;
  }

  if (instruction === '商品选择完成') {
    const discount = payload.discount ?? 12.8;
    return `好的，已为你选好商品，并使用了最大优惠，已省${discount.toFixed(1)}元。`;
  }

  return '已收到你的指令。';
};

// 优先调用后端仿真 API（JWT 鉴权），失败后自动降级本地 mock，保证流程可用。
export const callDoubaoAPI = async (
  instruction: DoubaoInstruction,
  payload: DoubaoMockPayload = {},
  authToken = '',
): Promise<string> => {
  if (!authToken.trim()) {
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 280);
    });
    return getLocalMockReply(instruction, payload);
  }

  try {
    const response = await requestTakeoutSimulation({
      authToken,
      instruction: instruction as TakeoutInstruction,
      payload: payload as TakeoutSimulationPayload,
    });
    return response.reply;
  } catch {
    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 280);
    });
    return getLocalMockReply(instruction, payload);
  }
};

export { getLocalMockReply };