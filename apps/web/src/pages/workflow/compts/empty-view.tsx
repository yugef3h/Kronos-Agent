import { Link } from 'react-router-dom';
export const EmptyView = () => {
    return <section className="space-y-4">
        <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 shadow-[0_24px_60px_-32px_rgba(217,119,6,0.32)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">No App Selected</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">尚未选择应用</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
                请先回到 Workflow 空间，通过“创建空白应用”弹窗完成初始化，再进入本页。
            </p>
            <Link
                to="/workflow?create=blank"
                className="mt-4 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
                去创建空白应用
            </Link>
        </div>
    </section>;
};