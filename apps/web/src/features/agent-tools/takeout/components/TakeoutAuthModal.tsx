import kronos_icon from '../../../../assets/kronos.png';
import relate_icon from '../../../../assets/relate.png';
import taobao_icon from '../../../../assets/taobao.png';

type TakeoutAuthModalProps = {
  flowId: number;
  isCallingApi: boolean;
  isAgreementChecked: boolean;
  onAgreementCheckedChange: (nextValue: boolean) => void;
  onConfirm: (flowId: number) => void | Promise<void>;
  onClose: () => void;
};

export const TakeoutAuthModal = ({
  flowId,
  isCallingApi,
  isAgreementChecked,
  // onAgreementCheckedChange,
  onConfirm,
  onClose,
}: TakeoutAuthModalProps) => {
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/45 px-0 pt-8 md:items-center md:px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-t-[26px] bg-white p-4 shadow-[0_30px_70px_-24px_rgba(2,6,23,0.5)] md:rounded-[26px] md:p-5">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-lg font-semibold text-slate-800">账号绑定</p>
          <span className="w-8" aria-hidden />
        </div>

        <div className="mb-5 flex items-center justify-center gap-3">
          <div className="h-14 w-14 overflow-hidden">
            <img src={taobao_icon} alt="淘宝头像" className="h-full w-full object-cover" />
          </div>
          <div className="h-4 w-4 overflow-hidden">
            <img src={relate_icon} alt="关联" className="h-full w-full object-cover" />
          </div>
          <div className="h-11 w-11 overflow-hidden">
            <img src={kronos_icon} alt="Kronos头像" className="h-full w-full object-cover" />
          </div>
        </div>

        <h3 className="mb-3 text-center text-lg font-medium text-slate-800">选择淘宝账号，并与 Kronos 绑定</h3>

        <div className="mb-5 space-y-2 px-1 text-sm leading-6 text-slate-600">
          <p>
            为方便使用淘宝闪购服务，根据您的账号信息推荐以下淘宝账号进行绑定，同时为您查询/创建并绑定淘宝闪购账号，并向 Kronos Agent 授权以下信息：
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[13px] leading-5">
            <li>账号信息及推荐收货地址：用于推荐附近商品、填写配送信息。</li>
            <li>当前渠道订单信息：用于在对话内展示及查询订单信息。</li>
            <li>权益、优惠信息：用于计算商品优惠价格。</li>
          </ul>
        </div>

        <div className="mb-5 rounded-xl bg-slate-100 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 overflow-hidden rounded-full bg-slate-200">
                <img src="https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/samantha/logo-icon-white-bg.png" alt="淘宝头像" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">tb049949_49</p>
                <p className="text-xs text-slate-500">175****5008</p>
              </div>
            </div>
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#1677ff]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m20 6-11 11-5-5" />
            </svg>
          </div>
        </div>

        <label className="mb-4 flex cursor-pointer items-start gap-2 px-1">
          <span className="text-xs leading-5 text-slate-500">
            同意
            <span className="mx-1 cursor-pointer text-[#f60]">《绑定协议》</span>
            <span className="mx-1 cursor-pointer text-[#f60]">《用户服务相关协议》</span>
            <span className="mx-1 cursor-pointer text-[#f60]">《授权协议》</span>
          </span>
        </label>

        <div className="space-y-2">
          <button
            type="button"
            disabled={isCallingApi || !isAgreementChecked}
            onClick={() => void onConfirm(flowId)}
            className="h-11 w-full rounded-lg bg-[#ff5000] text-base font-medium text-white transition hover:bg-[#ff5a22] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            确认绑定
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-lg bg-slate-100 text-base font-medium text-slate-800 transition hover:bg-slate-200"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};