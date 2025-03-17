import type { RefObject } from 'react';
import { MOCK_ADDRESS, MOCK_DELIVERY, MOCK_DISCOUNT, MOCK_FOODS, type TakeoutFood } from '../data/mockData';
import {
  buildTakeoutComboSummary,
  formatTakeoutPrice,
  getTakeoutPaymentSummary,
} from '../helpers';
import { hasTakeoutBindingConfirmed } from '../localBindingCache';
import type { TakeoutChatMessage, TakeoutFlowState } from '../types';
import taobao_icon from '../../../../assets/taobao.png'

type TakeoutMessageCardProps = {
  message: TakeoutChatMessage;
  flowState: TakeoutFlowState;
  showTakeoutScrollHint: boolean;
  foodsScrollerRef: RefObject<HTMLDivElement>;
  onCancel: (flowId: number) => void;
  onOpenAuthorizationModal: (flowId: number) => void;
  onSelectFood: (flowId: number, food: TakeoutFood) => void;
  onOpenPaymentModal: (flowId: number) => void;
};

export const TakeoutMessageCard = ({
  message,
  flowState,
  foodsScrollerRef,
  onCancel,
  onOpenAuthorizationModal,
  onSelectFood,
  onOpenPaymentModal,
}: TakeoutMessageCardProps) => {
  if (!message.flowId || message.flowId !== flowState.flowId) {
    return <span className="text-xs text-slate-500">该外卖流程已结束，请发起新的外卖请求。</span>;
  }

  const effectiveMessageType =
    message.takeoutMessageType === 'protocol-card' && hasTakeoutBindingConfirmed()
      ? 'foods-card'
      : message.takeoutMessageType;

  if (effectiveMessageType === 'protocol-card') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 **text-[0]**">
          <img
            aria-hidden
            alt=""
            className="h-5 w-5 rounded-full mb-0.5"
            src={taobao_icon}
          />
          <p className="text-xs font-semibold text-slate-800">淘宝闪购请求授权</p>
        </div>
        <p className="text-xs leading-5 text-slate-600">
          使用您的手机号查询、绑定淘宝闪购账号，完成授权后即可使用淘宝闪购收货地址，并由淘宝闪购为您提供商品交易服务，详见
          <span className="cursor-not-allowed text-blue-500">《AI Agent 使用须知》</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={flowState.isCallingApi}
            onClick={() => onCancel(message.flowId!)}
            className="flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            暂不
          </button>
          <button
            type="button"
            disabled={flowState.isCallingApi}
            onClick={() => onOpenAuthorizationModal(message.flowId!)}
            className="flex-1 rounded-lg bg-amber-500 px-2.5 py-2 text-xs font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"
          >
            去授权
          </button>
        </div>
      </div>
    );
  }

  if (effectiveMessageType === 'foods-card') {
    const currentFood = flowState.selectedFood;

    return (
      <div className="space-y-3">
        <div className="relative">
          <div ref={foodsScrollerRef} className="soft-scrollbar flex gap-3 overflow-x-auto pr-8">
            {MOCK_FOODS.map((food) => {
              const isSelected = currentFood?.id === food.id;

              return (
                <article
                  key={food.id}
                  className={`w-[14rem] flex-shrink-0 overflow-hidden rounded-xl border bg-white transition-all duration-200 ${
                    isSelected
                      ? '-translate-y-0.5 shadow-[0_16px_36px_-20px_rgba(8,145,178,0.65)]'
                      : 'shadow-[0_12px_28px_-20px_rgba(15,23,42,0.38)] hover:shadow-[0_18px_36px_-20px_rgba(14,116,144,0.5)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-[10px] font-bold text-amber-700">
                      {food.shopName.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-slate-800">{food.shopName}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <span>{food.shopScore}分</span>
                      <span>·</span>
                      <span>{food.deliveryTime}</span>
                      <span>·</span>
                      <span>{food.distance}</span>
                    </div>
                  </div>

                  <div className="px-2.5 pb-2.5 pt-1.5">
                    <h3 className="line-clamp-1 text-[13px] font-semibold text-slate-900">{food.productName}</h3>
                    <p className="mt-0.5 text-[10px] text-slate-500">{food.productTip}</p>

                    <div className="relative mt-2">
                      <img src={food.productImage} alt={food.productName} className="h-32 w-full rounded-lg object-cover" />
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-bold text-rose-600">¥{formatTakeoutPrice(food.price)}</span>
                        <span className="text-[10px] text-slate-500">{food.priceTip}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectFood(message.flowId!, food)}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#e0e9fdc5] py-1.5 text-[11px] font-medium text-[#3544e1] transition hover:bg-[#d0d6f8]"
                    >
                      <span>选这个</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* {showTakeoutScrollHint && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center mr-[-40px]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-200 bg-white/95 text-cyan-600 shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </div>
            </div>
          )} */}
        </div>
      </div>
    );
  }

  const paymentSummary = getTakeoutPaymentSummary(flowState, MOCK_DISCOUNT);
  const comboSummary = buildTakeoutComboSummary(flowState);

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white">
        <div className="px-3 py-2.5">
          <p className="text-[13px] font-semibold text-slate-700">{flowState.selectedFood?.shopName || '附近商家'}</p>
        </div>

        <div className="px-3 pb-2.5">
          <div className="flex gap-2.5">
            <img
              src={flowState.selectedFood?.productImage || ''}
              alt={flowState.selectedFood?.productName || '商品图'}
              className="h-16 w-16 rounded-lg bg-slate-100 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-1 text-[15px] font-bold text-slate-900">
                  {flowState.selectedFood?.productName || '外卖商品'}
                </p>
                <p className="shrink-0 text-lg font-bold text-slate-900">
                  ¥{Math.round(paymentSummary.selectedFoodPrice + paymentSummary.selectedComboPrice)}
                </p>
              </div>
              <p className="mt-1 line-clamp-2 rounded-md bg-slate-50 px-2 py-1 text-[11px] leading-4 text-slate-500">
                {comboSummary}
              </p>
              <p className="mt-1 text-right text-xs text-slate-400">x1</p>
            </div>
          </div>

          <div className="mt-2.5 space-y-1.5 pt-2.5 text-[12px]">
            <div className="flex items-center justify-between text-slate-500">
              <span>立即送出</span>
              <span>{MOCK_DELIVERY.eta}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>配送至</span>
              <span className="line-clamp-1 max-w-[68%] text-right">{MOCK_ADDRESS}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>备注</span>
              <span>可提出菜品、餐具、配送需求</span>
            </div>
          </div>

          <div className="mt-2.5 pt-2.5">
            <p className="text-right text-xs text-slate-400">配送费 ¥6.0</p>
            <p className="mt-1 text-right text-[14px]">
              <span className="mr-2 text-[#f3683d]">已优惠 ¥{formatTakeoutPrice(MOCK_DISCOUNT)}</span>
              <span className="font-semibold text-slate-900">小计 ¥{formatTakeoutPrice(paymentSummary.finalPrice)}</span>
            </p>
          </div>

          <button
            type="button"
            disabled={flowState.isCallingApi}
            onClick={() => onOpenPaymentModal(message.flowId!)}
            className="mt-2.5 h-9 w-full rounded-lg bg-[#dbeafe] text-sm font-semibold text-[#1677ff] transition hover:bg-[#cfe3ff] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            支付宝付款
          </button>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">首次使用，支付宝会获取手机号信息，帮你匹配账号</p>
        </div>
      </div>
    </div>
  );
};