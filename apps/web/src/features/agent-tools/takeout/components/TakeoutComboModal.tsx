import { TAKEOUT_SNACK_OPTIONS, formatTakeoutPrice } from '../helpers';
import type { TakeoutFlowState } from '../types';

type TakeoutComboModalProps = {
  flowId: number;
  flowState: TakeoutFlowState;
  onClose: () => void;
  onSelectSnack: (flowId: number, snackId: string) => void;
  onSelectCombo: (flowId: number, combo: NonNullable<TakeoutFlowState['selectedCombo']>) => void;
  onConfirm: (flowId: number) => void | Promise<void>;
};

export const TakeoutComboModal = ({
  flowId,
  flowState,
  onClose,
  onSelectSnack,
  onSelectCombo,
  onConfirm,
}: TakeoutComboModalProps) => {
  if (!flowState.selectedFood) {
    return null;
  }

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
                src={flowState.selectedFood.productImage}
                alt={flowState.selectedFood.productName}
                className="h-20 w-20 rounded-lg bg-[#f3f4f6] object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-base font-bold tracking-tight text-slate-900 md:text-lg">
                    {flowState.selectedFood.productName}
                  </p>
                  <span className="w-6" aria-hidden />
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500 md:text-xs">
                  已选：{flowState.selectedCombo?.name || '请选择套餐'}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                  <span className="rounded-md border border-[#ffb7a3] bg-[#fff4ee] px-1.5 py-0.5 font-semibold text-[#f3683d]">3.7折</span>
                  <span className="rounded-md border border-[#ffb7a3] bg-[#fff4ee] px-1.5 py-0.5 font-semibold text-[#f3683d]">1份即送</span>
                  <span className="rounded-md border border-[#ffb7a3] bg-[#fff4ee] px-1.5 py-0.5 font-semibold text-[#f3683d]">一口价</span>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-800 md:text-xs">
                  价格计算中
                  <span className="ml-2 font-medium text-[#ff5a2a]">剩0份</span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <section>
              <h3 className="text-base font-bold text-slate-900 md:text-lg">固定组成 <span className="ml-1 text-sm font-medium text-slate-400">(已包含)</span></h3>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                {[
                  { id: 'fixed-1', name: '主食', count: 'x1' },
                  { id: 'fixed-2', name: '小吃', count: 'x1' },
                  { id: 'fixed-3', name: '配餐', count: 'x1' },
                ].map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-lg border-2 border-[#2a43e8] bg-white">
                    <div className="flex h-20 items-center justify-center bg-[#f9fafb] p-1.5">
                      <img src={flowState.selectedFood?.productImage || ''} alt={item.name} className="h-full w-full object-contain" />
                    </div>
                    <div className="bg-[#edf0ff] px-2 pb-1.5 pt-1">
                      <p className="line-clamp-1 text-[13px] font-semibold text-[#1f35d0]">{item.name}</p>
                      <p className="mt-1 text-[11px] font-semibold text-[#1f35d0]">{item.count}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-4">
              <h3 className="text-base font-bold text-slate-900 md:text-lg">选择小食 <span className="ml-1 text-sm font-medium text-slate-400">(请选1份)</span></h3>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                {TAKEOUT_SNACK_OPTIONS.map((item) => {
                  const isSelected = flowState.selectedSnackId === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectSnack(flowId, item.id)}
                      className={`overflow-hidden rounded-lg border-2 text-left transition ${
                        isSelected ? 'border-[#2a43e8] bg-white' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex h-20 items-center justify-center bg-[#f9fafb] p-1.5">
                        <img src={flowState.selectedFood?.productImage || ''} alt={item.name} className="h-full w-full object-contain opacity-85" />
                      </div>
                      <div className={`${isSelected ? 'bg-[#edf0ff]' : 'bg-[#f4f5f7]'} px-2 pb-1.5 pt-1`}>
                        <p className={`line-clamp-1 text-[13px] font-medium ${isSelected ? 'text-[#1f35d0]' : 'text-slate-700'}`}>{item.name}</p>
                        <p className={`mt-1 text-[11px] font-medium ${isSelected ? 'text-[#1f35d0]' : 'text-slate-600'}`}>{item.count}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-4 pb-2">
              <h3 className="text-base font-bold text-slate-900 md:text-lg">选择饮料 <span className="ml-1 text-sm font-medium text-slate-400">(请选2份)</span></h3>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                {flowState.selectedFood.combos.map((combo) => {
                  const isSelected = flowState.selectedCombo?.id === combo.id;

                  return (
                    <button
                      key={combo.id}
                      type="button"
                      onClick={() => onSelectCombo(flowId, combo)}
                      className={`overflow-hidden rounded-lg border-2 text-left transition ${
                        isSelected ? 'border-[#2a43e8] bg-white' : 'border-slate-200 bg-[#f4f5f7]'
                      }`}
                    >
                      <div className="flex h-20 items-center justify-center bg-[#f9fafb] p-1.5">
                        <img src={flowState.selectedFood?.productImage || ''} alt={combo.name} className="h-full w-full object-contain" />
                      </div>
                      <div className={`${isSelected ? 'bg-[#edf0ff]' : 'bg-[#f4f5f7]'} px-2 pb-1.5 pt-1`}>
                        <p className={`line-clamp-1 text-[13px] font-semibold ${isSelected ? 'text-[#1f35d0]' : 'text-slate-600'}`}>
                          {combo.name}
                        </p>
                        <p className={`mt-1 text-[11px] ${isSelected ? 'text-[#1f35d0]' : 'text-slate-500'}`}>
                          +¥{formatTakeoutPrice(combo.extraPrice)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="mt-2.5 shrink-0 border-t border-slate-200 pt-2.5">
            <button
              type="button"
              disabled={flowState.isCallingApi || !flowState.selectedCombo || !flowState.selectedSnackId}
              onClick={() => void onConfirm(flowId)}
              className="h-9 w-full rounded-lg bg-[#1677ff] text-sm font-semibold tracking-wide text-white transition hover:bg-[#0f63d6] disabled:cursor-not-allowed disabled:bg-[#c3c8ef]"
            >
              选好了
            </button>
            {(!flowState.selectedSnackId || !flowState.selectedCombo) && (
              <p className="mt-2 text-xs text-slate-500">请完成每行必选项后继续</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};