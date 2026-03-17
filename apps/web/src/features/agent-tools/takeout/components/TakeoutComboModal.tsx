import { formatTakeoutPrice } from '../helpers';
import type { TakeoutFlowState } from '../types';

type TakeoutComboModalProps = {
  flowId: number;
  flowState: TakeoutFlowState;
  onClose: () => void;
  onSelectCombo: (flowId: number, combo: NonNullable<TakeoutFlowState['selectedCombo']>) => void;
  onConfirm: (flowId: number) => void | Promise<void>;
};

export const TakeoutComboModal = ({
  flowId,
  flowState,
  onClose,
  onSelectCombo,
  onConfirm,
}: TakeoutComboModalProps) => {
  if (!flowState.selectedFood) {
    return null;
  }

  const selectedFood = flowState.selectedFood;
  const hasCombos = selectedFood.combos.length > 0;
  const currentTotal = selectedFood.price + (flowState.selectedCombo?.extraPrice || 0);
  const confirmLabel = hasCombos ? '选好了' : '直接下单';
  const isConfirmDisabled = flowState.isCallingApi || (hasCombos && !flowState.selectedCombo);

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/45 px-0 pt-8 md:items-center md:px-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-t-[22px] bg-[#f7f7f8] shadow-[0_24px_56px_-24px_rgba(2,6,23,0.5)] md:max-w-[368px] md:rounded-[22px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
          aria-label="关闭套餐弹窗"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        <div className="flex max-h-[78vh] flex-col px-3 pb-3 pt-3 md:p-4">
          <div className="shrink-0 rounded-xl bg-white p-2.5">
            <div className="flex gap-2.5">
              <img
                src={selectedFood.productImage}
                alt={selectedFood.productName}
                className="h-20 w-20 rounded-lg bg-[#f3f4f6] object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-base font-bold tracking-tight text-slate-900 md:text-lg">
                    {selectedFood.productName}
                  </p>
                  <span className="w-6" aria-hidden />
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500 md:text-xs">
                  已选：{flowState.selectedCombo?.name || (hasCombos ? '请选择组合' : '标准规格')}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                  <span className="rounded-md border border-[#ffb7a3] bg-[#fff4ee] px-1.5 py-0.5 font-semibold text-[#f3683d]">{selectedFood.priceTip}</span>
                  <span className="rounded-md border border-[#ffb7a3] bg-[#fff4ee] px-1.5 py-0.5 font-semibold text-[#f3683d]">{selectedFood.deliveryTime}</span>
                  <span className="rounded-md border border-[#ffb7a3] bg-[#fff4ee] px-1.5 py-0.5 font-semibold text-[#f3683d]">{selectedFood.shopScore}分</span>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-800 md:text-xs">
                  当前小计 ¥{formatTakeoutPrice(currentTotal)}
                  <span className="ml-2 font-medium text-[#ff5a2a]">{selectedFood.distance}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <section>
              <div className="rounded-xl bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 md:text-lg">商品详情</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{selectedFood.productTip}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">基础价格</p>
                    <p className="text-lg font-bold text-rose-600">¥{formatTakeoutPrice(selectedFood.price)}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span>{selectedFood.shopName}</span>
                  <span>{selectedFood.deliveryTime} · {selectedFood.distance}</span>
                </div>
              </div>
            </section>

            <section className="mt-4 pb-2">
              <h3 className="text-base font-bold text-slate-900 md:text-lg">
                {hasCombos ? '可选组合' : '下单说明'}
                <span className="ml-1 text-sm font-medium text-slate-400">
                  {hasCombos ? '(按商品实际组合展示)' : '(当前商品暂无额外组合)'}
                </span>
              </h3>

              {hasCombos ? (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {selectedFood.combos.map((combo) => {
                    const isSelected = flowState.selectedCombo?.id === combo.id;

                    return (
                      <button
                        key={combo.id}
                        type="button"
                        onClick={() => onSelectCombo(flowId, combo)}
                        className={`rounded-xl border-2 px-3 py-3 text-left transition ${
                          isSelected
                            ? 'border-[#2a43e8] bg-[#edf0ff] shadow-[0_8px_18px_-14px_rgba(42,67,232,0.55)]'
                            : 'border-slate-200 bg-white hover:border-[#9aa8ff] hover:bg-[#f8faff]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className={`line-clamp-1 text-[14px] font-semibold ${isSelected ? 'text-[#1f35d0]' : 'text-slate-800'}`}>
                              {combo.name}
                            </p>
                            <p className={`mt-1 text-[11px] ${isSelected ? 'text-[#3651e3]' : 'text-slate-500'}`}>
                              适配当前商品的实际组合，加价不大，直接加入结算
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-sm font-bold ${isSelected ? 'text-[#1f35d0]' : 'text-rose-600'}`}>
                              +¥{formatTakeoutPrice(combo.extraPrice)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              合计 ¥{formatTakeoutPrice(selectedFood.price + combo.extraPrice)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-600">
                  当前商品没有额外组合选项，会按默认规格直接加入结算。
                </div>
              )}
            </section>
          </div>

          <div className="mt-2.5 shrink-0 border-t border-slate-200 pt-2.5">
            <button
              type="button"
              disabled={isConfirmDisabled}
              onClick={() => void onConfirm(flowId)}
              className="h-9 w-full rounded-lg bg-[#1677ff] text-sm font-semibold tracking-wide text-white transition hover:bg-[#0f63d6] disabled:cursor-not-allowed disabled:bg-[#c3c8ef]"
            >
              {confirmLabel}
            </button>
            {hasCombos && !flowState.selectedCombo && (
              <p className="mt-2 text-xs text-slate-500">请选择当前商品的一个可选组合后继续</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};