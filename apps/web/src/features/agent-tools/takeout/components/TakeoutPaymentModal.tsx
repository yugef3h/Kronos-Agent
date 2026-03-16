import alipay_icon from '../../../../assets/alipay.png';
import kronos_icon from '../../../../assets/kronos.png';
import taobao_icon from '../../../../assets/taobao.png';
import { MOCK_DISCOUNT } from '../data/mockData';
import { formatTakeoutPrice, getTakeoutPaymentSummary } from '../helpers';
import type { TakeoutFlowState, TakeoutPaymentInputRef } from '../types';

type TakeoutPaymentModalProps = {
  flowId: number;
  flowState: TakeoutFlowState;
  paymentInputRef: TakeoutPaymentInputRef;
  onClose: () => void;
  onPaymentPasswordChange: (flowId: number, rawValue: string) => void;
};

export const TakeoutPaymentModal = ({
  flowId,
  flowState,
  paymentInputRef,
  onClose,
  onPaymentPasswordChange,
}: TakeoutPaymentModalProps) => {
  const paymentSummary = getTakeoutPaymentSummary(flowState, MOCK_DISCOUNT);

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[336px] space-y-2.5">
        <div className="rounded-xl border border-[#77b7ff] bg-white px-3 py-2.5 shadow-[0_0_0_2px_rgba(59,130,246,0.16),0_12px_30px_-16px_rgba(30,64,175,0.48)]">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-900">
            <img src={kronos_icon} alt="Kronos" className="h-6 w-6 rounded-full" />
            <span>我正在</span>
            <img src={taobao_icon} alt="淘宝" className="h-8 w-8 rounded-md object-cover" />
            <span>淘宝闪购帮你下单，请确认</span>
          </div>
        </div>

        <div className="w-full rounded-[22px] bg-white p-3 shadow-[0_18px_42px_-22px_rgba(2,6,23,0.6)]">
          <div className="relative mb-1.5 flex items-center justify-center">
            <div className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              <img src={alipay_icon} alt="Alipay" className="h-5 w-5 rounded-full" />
              <span>175******08</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-0 flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
              aria-label="关闭支付密码输入"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-2.5 text-center">
            <p className="relative inline-block text-5xl font-bold leading-none tracking-tight text-slate-900">
              <span className="absolute bottom-0 left-0 mb-[3px] text-2xl font-bold leading-none">¥</span>
              <span className="block pl-4">{formatTakeoutPrice(paymentSummary.finalPrice)}</span>
            </p>
            <p className="mt-1.5 text-sm text-[#e45b47]">
              <span className="mr-2 text-slate-400 line-through">¥{formatTakeoutPrice(paymentSummary.rawPrice)}</span>
              千问每日必减优惠 {formatTakeoutPrice(paymentSummary.savedPrice)}元
            </p>
          </div>

          <div className="mt-3 rounded-xl bg-[#fafafa] px-3 py-3">
            <p className="mb-2.5 text-center text-[15px] text-slate-700">请输入支付密码</p>
            <div
              role="button"
              tabIndex={0}
              onClick={() => paymentInputRef.current?.focus()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  paymentInputRef.current?.focus();
                }
              }}
              className="flex justify-center gap-1.5"
              aria-label="支付密码输入框"
            >
              {Array.from({ length: 6 }).map((_, index) => {
                const isActive = flowState.paymentPassword.length === index;
                const hasValue = index < flowState.paymentPassword.length;

                return (
                  <span
                    key={`payment-box-${index}`}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border text-black transition ${
                      isActive ? 'border-[#1677ff] bg-white shadow-[0_0_0_2px_rgba(22,119,255,0.12)]' : 'border-slate-200 bg-[#f3f4f6]'
                    }`}
                  >
                    {hasValue ? <span className="h-2.5 w-2.5 rounded-full bg-black" /> : null}
                  </span>
                );
              })}
            </div>
            <input
              ref={paymentInputRef}
              value={flowState.paymentPassword}
              onChange={(event) => onPaymentPasswordChange(flowId, event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="sr-only"
              aria-label="支付密码数字输入"
            />
          </div>

          <p className="mt-2.5 text-center text-[12px] text-slate-500">同意用户协议，开通 AI 付服务完成支付</p>
        </div>
      </div>
    </div>
  );
};