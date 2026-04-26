import taobaoIcon from '../../../assets/taobao.png';
import { StreamingMarkdownMessage } from '../../markdown-stream/StreamingMarkdownMessage';
import { resolveAssistantInvocation } from '../assistantInvocation';
import { AssistantInvocationBar } from './AssistantInvocationBar';
import { FILE_INPUT_ACCEPT } from '../../agent-tools/file';
import {
  TakeoutMessageCard,
  TakeoutToolModals,
  isTakeoutWideCardMessage,
} from '../../agent-tools/takeout';
// import { ChatTimelineFold } from './ChatTimelineFold';
import { HistorySwitchConfirmDialog } from './HistorySwitchConfirmDialog';
import type { UseChatStreamControllerResult } from '../hooks/useChatStreamController';
import VariableSelect from '../../../components/form/variable-select';
import { WorkflowBlankAppCreateDialog } from '../../../domains/workflow/app/WorkflowBlankAppCreateDialog';
import {
  formatUploadSize,
  getRenderableImageName,
  getRenderableImageSource,
} from '../utils/chatStreamHelpers';

type ChatStreamPanelViewProps = {
  controller: UseChatStreamControllerResult;
};

export const ChatStreamPanelView = ({ controller }: ChatStreamPanelViewProps) => {
  const {
    canSend,
    // currentTimelineEvent,
    fileInputRef,
    formatTimestamp,
    handleDocumentFileChange,
    handleExplainFileClick,
    handleExplainImageClick,
    handleHistoryItemClick,
    handleStartNewConversation,
    handleHotTopicClick,
    handleImageFileChange,
    handlePromptKeyDown,
    handleQuickActionClick,
    handleTakeoutCancel,
    confirmHistorySessionSwitch,
    cancelHistorySessionSwitch,
    historyPanelRef,
    historySwitchConfirmTarget,
    hotTopics,
    imageInputRef,
    isAnalyzingImage,
    isHistoryLoading,
    isHistoryOpen,
    isOrchestrating,
    isStreaming,
    isTakeoutAgreementChecked,
    isTakeoutLoading,
    messageListRef,
    messages,
    modalState,
    onAgreementCheckedChange,
    onCloseAuthorization,
    onCloseCombo,
    onClosePayment,
    onConfirmAgreement,
    onConfirmSelection,
    onOpenAuthorizationModal,
    onOpenPaymentModal,
    onPaymentPasswordChange,
    onSelectCombo,
    onSelectFood,
    pendingFile,
    pendingImage,
    paymentInputRef,
    prompt,
    promptQuickActions,
    promptTextareaRef,
    recentDialogues,
    renderPlainMessageContent,
    scrollToBottom,
    sendPrompt,
    sessionId,
    // stageLabelMap,
    // statusLabelMap,
    setPendingFile,
    setPendingImage,
    setPrompt,
    showHotTopics,
    showScrollToBottom,
    showTakeoutScrollHint,
    takeoutFlowState,
    takeoutFoodsScrollerRef,
    takeoutLoadingLabel,
    // timelineEvents,
    toggleHistoryPanel,
    publishedChatbotWorkflowAppId,
    publishedChatbotRagValueSelector,
    publishedChatbotRagVariableOptions,
    handlePublishedChatbotRagVariableChange,
    clearPublishedChatbotRagSelection,
    isWorkflowBlankCreateDialogOpen,
    closeWorkflowBlankCreateDialog,
    handleWorkflowBlankAppCreated,
  } = controller;

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_16px_48px_-24px_rgba(14,116,144,0.45)] backdrop-blur md:p-5">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-cyan-100/70 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-sky-100/80 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          {/* <h2 className="mt-1 font-display text-xl text-ink">Kronos Chat</h2> */}
          {/* {publishedChatbotWorkflowAppId ? (
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-600" role="status">
              当前会话已收录进右上角「<span className="font-semibold text-slate-800">历史对话</span>」；可随时切回默认 Playground 或该应用下的其他记录。
            </p>
          ) : null} */}
        </div>

        <div ref={historyPanelRef} className="relative flex items-center gap-[10px]">
          <button
            type="button"
            onClick={handleStartNewConversation}
            aria-label="新建对话"
            title="新建对话"
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-xl border border-slate-300/90 bg-white text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={toggleHistoryPanel}
            className="rounded-xl border border-slate-300/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
          >
            历史对话
          </button>

          {isHistoryOpen && (
            <div className="absolute right-0 top-10 z-30 w-[26rem] max-w-[85vw] rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur">
              <div className="mb-1 px-2 text-xs font-semibold text-slate-600">最近 10 条历史对话</div>
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {isHistoryLoading && <p className="rounded-lg bg-slate-50 px-2 py-2 text-xs text-slate-500">读取中...</p>}
                {!isHistoryLoading && recentDialogues.length === 0 && (
                  <p className="rounded-lg bg-slate-50 px-2 py-2 text-xs text-slate-500">暂无本地缓存对话</p>
                )}
                {!isHistoryLoading && recentDialogues.map((item) => {
                  const isActiveRow =
                    item.basePlaygroundSessionId === sessionId &&
                    (item.publishedChatbotWorkflowAppId ?? null) === (publishedChatbotWorkflowAppId ?? null);
                  return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleHistoryItemClick(item)}
                    className={`w-full rounded-xl border px-2 py-2 text-left transition ${isActiveRow
                      ? 'border-cyan-300 bg-cyan-50/70'
                      : 'border-slate-100 bg-slate-50/80 hover:border-cyan-200 hover:bg-cyan-50/50'
                      }`}
                  >
                    <p className="text-[11px] text-slate-500">
                      {formatTimestamp(item.updatedAt)}
                      {' · '}
                      <span className={item.playgroundSurface === 'published' ? 'text-cyan-700' : 'text-slate-600'}>
                        {item.playgroundSurface === 'published' ? '已发布应用' : '默认'}
                      </span>
                    </p>
                    <div className="mt-1" />
                    <p className="line-clamp-1 text-xs text-slate-700" title={item.userContent || '（无用户输入）'}>{item.userContent || '（无用户输入）'}</p>
                  </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1">
          <div
            ref={messageListRef}
            className="soft-scrollbar h-full w-full space-y-4 overflow-y-auto border-slate-200/85 from-white via-slate-50/35 to-cyan-50/20 pb-8 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
          >
            {messages.length === 0 && (
              <div className="mx-auto mt-8 max-w-5xl text-center">
                <h3 className="mt-2 font-display text-xl text-slate-800 md:text-2xl">有什么我能帮你的吗？</h3>
                {showHotTopics && (
                  <div className="mt-6">
                    <div className="mt-4 flex flex-wrap justify-center gap-4 text-center">
                      {hotTopics.map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => handleHotTopicClick(topic)}
                          disabled={isStreaming || isOrchestrating || isAnalyzingImage}
                          className="group w-full max-w-full rounded-[16px] border border-transparent bg-slate-100/95 px-2 py-2 text-center text-[14px] leading-7 text-slate-800 shadow-none transition hover:bg-slate-200/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
                        >
                          <span className="block whitespace-normal sm:whitespace-nowrap">{topic}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {messages.map((message, index) => {
              const imageSource = getRenderableImageSource(message);
              const imageName = getRenderableImageName(message);
              const assistantInvocation = message.role === 'assistant'
                ? resolveAssistantInvocation(message, messages, index)
                : null;

              return (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <article
                    className={`max-w-[80%] rounded-2xl border text-sm shadow-sm md:text-[15px] ${message.role === 'user'
                      ? imageSource || (message.fileName && message.fileExtension)
                        ? 'border-transparent bg-transparent px-0 py-0 text-ink shadow-none'
                        : 'border-cyan-200/90 bg-cyan-50/95 px-3.5 py-2.5 text-ink'
                      : isTakeoutWideCardMessage(message)
                        ? 'border-transparent bg-transparent px-0 py-1 text-slate-700 shadow-none'
                        : 'border-slate-200/90 bg-white px-3.5 py-2.5 text-slate-700'
                      }`}
                  >
                    {assistantInvocation ? (
                      <AssistantInvocationBar
                        invocation={assistantInvocation}
                        className={isTakeoutWideCardMessage(message) ? 'px-3.5' : undefined}
                      />
                    ) : null}
                    {message.flowType === 'takeout' && message.takeoutMessageType ? (
                      <TakeoutMessageCard
                        message={message}
                        flowState={takeoutFlowState}
                        showTakeoutScrollHint={showTakeoutScrollHint}
                        foodsScrollerRef={takeoutFoodsScrollerRef}
                        onCancel={handleTakeoutCancel}
                        onOpenAuthorizationModal={onOpenAuthorizationModal}
                        onSelectFood={onSelectFood}
                        onOpenPaymentModal={onOpenPaymentModal}
                      />
                    ) : imageSource ? (
                      <div className="space-y-2">
                        <img
                          src={imageSource}
                          alt={imageName || '用户上传图片'}
                          className="max-h-64 w-auto max-w-full rounded-xl object-contain"
                        />
                        {message.content ? (
                          <p className="whitespace-pre-wrap text-sm text-slate-700">{message.content}</p>
                        ) : null}
                      </div>
                    ) : message.fileName && message.fileExtension ? (
                      <div className="w-[18rem] max-w-full rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.4)]">
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 shadow-inner shadow-cyan-200/70">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                              <path d="M14 3v5h5" />
                            </svg>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">{message.fileName}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-slate-500">
                              {message.fileExtension}
                              {typeof message.fileSize === 'number' ? ` | ${formatUploadSize(message.fileSize)}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : !message.content && message.role === 'assistant' && !message.isIncomplete ? (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
                      </span>
                    ) : message.role === 'assistant' ? (
                      <StreamingMarkdownMessage
                        content={message.content}
                        isIncomplete={message.isIncomplete}
                        isStreaming={Boolean(message.isStreamingText)}
                      />
                    ) : (
                      renderPlainMessageContent(message)
                    )}
                  </article>
                </div>
              );
            })}

            {isTakeoutLoading && (
              <div className="flex justify-start">
                <article className="max-w-[80%] rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm md:text-[15px]">
                  <span className="inline-flex items-center gap-2 text-slate-500">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500" />
                    {takeoutLoadingLabel}
                  </span>
                </article>
              </div>
            )}
          </div>

          {showScrollToBottom && (
            <button
              type="button"
              onClick={scrollToBottom}
              aria-label="滚动到底部"
              className="absolute bottom-3 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 shadow-md backdrop-blur transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14" />
                <path d="m6 13 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>

        <div className="mt-3 w-full self-center space-y-2">
          {/* <ChatTimelineFold
            timelineEvents={timelineEvents}
            currentTimelineEvent={currentTimelineEvent}
            stageLabelMap={stageLabelMap}
            statusLabelMap={statusLabelMap}
            isActive={isStreaming || isOrchestrating}
          /> */}
          <div className="relative w-full rounded-2xl border border-slate-300 bg-white px-3 pb-12 pt-2 shadow-[0_8px_24px_-12px_rgba(14,116,144,0.18),inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-200/70">
            <input ref={fileInputRef} type="file" accept={FILE_INPUT_ACCEPT} className="hidden" onChange={handleDocumentFileChange} />
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageFileChange} />

            {pendingFile && (
              <div className="mb-2 rounded-lg pt-1 text-xs text-cyan-800">
                <div className="group relative inline-block max-w-full">
                  <div className="w-[18rem] max-w-full rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.4)]">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 shadow-inner shadow-cyan-200/70">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                          <path d="M14 3v5h5" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{pendingFile.fileName}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-slate-500">
                          {pendingFile.extension}
                          {' | '}
                          {formatUploadSize(pendingFile.size)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingFile(null)}
                    aria-label="移除文件"
                    className="absolute right-[-8px] top-[-8px] inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/90 text-white opacity-0 shadow-sm transition hover:bg-black focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 5l10 10" />
                      <path d="M15 5L5 15" />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleExplainFileClick}
                    disabled={isStreaming || isOrchestrating || isAnalyzingImage || prompt.trim().length > 0}
                    className="rounded-[6px] bg-[#f4f5f5] px-3 py-1 text-xs text-black transition hover:bg-[#e0e0e0] disabled:cursor-not-allowed"
                  >
                    解读文件 -&gt;
                  </button>
                </div>
              </div>
            )}

            {pendingImage && (
              <div className="mb-2 rounded-lg pt-1 text-xs text-cyan-800">
                <div className="group relative inline-block max-w-full">
                  <img src={pendingImage.dataUrl} alt={pendingImage.fileName} className="max-h-16 w-auto max-w-full rounded-lg object-contain" />
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    aria-label="移除图片"
                    className="absolute right-[-8px] top-[-8px] inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/90 text-white opacity-0 shadow-sm transition hover:bg-black focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 5l10 10" />
                      <path d="M15 5L5 15" />
                    </svg>
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleExplainImageClick}
                    disabled={isStreaming || isOrchestrating || isAnalyzingImage || prompt.trim().length > 0}
                    className="rounded-[6px] bg-[#f4f5f5] px-3 py-1 text-xs text-black transition hover:bg-[#e0e0e0] disabled:cursor-not-allowed"
                  >
                    解释图片 -&gt;
                  </button>
                </div>
              </div>
            )}

            <textarea
              ref={promptTextareaRef}
              rows={1}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handlePromptKeyDown}
              className="max-h-[160px] min-h-[44px] w-full resize-none border-none bg-transparent py-1 text-sm leading-6 text-slate-800 outline-none"
              placeholder={pendingImage
                ? pendingImage.imgbbUploadState === 'pending'
                  ? '图片上传中，请稍候…'
                  : '可继续输入问题，或点“解释图片”直接发送'
                : pendingFile
                  ? '输入你希望如何解读这个文件，例如总结重点、提取风险或生成结论'
                  : '发消息，可以试着点餐哦~'}
            />

            <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
              <div className="pointer-events-auto flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {promptQuickActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => handleQuickActionClick(action.key)}
                      title={action.key === 'takeout' ? '打开外卖模拟流程' : action.key === 'image' ? '上传图片进行识别' : action.key === 'file' ? '上传文件进行解读' : `${action.label}功能即将上线`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                    >
                      {action.key === 'file' && (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                          <path d="M14 3v5h5" />
                        </svg>
                      )}
                      {action.key === 'image' && (
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <circle cx="9" cy="10" r="1.4" />
                          <path d="m21 16-5.5-5.5L8 18" />
                        </svg>
                      )}
                      {action.key === 'takeout' && (
                        <div className="h-6 w-6 overflow-hidden">
                          <img src={taobaoIcon} alt="淘宝头像" className="h-full w-full object-cover" />
                        </div>
                      )}
                      <span>{action.label}</span>
                    </button>
                  ))}

                  <VariableSelect
                    className="w-[160px]"
                    pillTrigger
                    value={publishedChatbotRagValueSelector}
                    options={publishedChatbotRagVariableOptions}
                    optionClassName="min-h-9 py-2"
                    placeholder="选择或创建 RAG 应用"
                    onChange={handlePublishedChatbotRagVariableChange}
                    showClear={Boolean(publishedChatbotWorkflowAppId)}
                    onClear={clearPublishedChatbotRagSelection}
                    disabled={isStreaming || isOrchestrating || isAnalyzingImage}
                  />
                </div>
              </div>

              <button
                type="button"
                aria-label="发送消息"
                disabled={!canSend}
                onClick={() => {
                  void sendPrompt();
                }}
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-600 to-sky-600 text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <TakeoutToolModals
        flowState={takeoutFlowState}
        modalState={modalState}
        isAgreementChecked={isTakeoutAgreementChecked}
        onAgreementCheckedChange={onAgreementCheckedChange}
        onConfirmAgreement={onConfirmAgreement}
        onCloseAuthorization={onCloseAuthorization}
        onCloseCombo={onCloseCombo}
        onSelectCombo={onSelectCombo}
        onConfirmSelection={onConfirmSelection}
        paymentInputRef={paymentInputRef}
        onClosePayment={onClosePayment}
        onPaymentPasswordChange={onPaymentPasswordChange}
      />

      {historySwitchConfirmTarget && (
        <HistorySwitchConfirmDialog
          target={historySwitchConfirmTarget}
          onCancel={cancelHistorySessionSwitch}
          onConfirm={confirmHistorySessionSwitch}
        />
      )}

      <WorkflowBlankAppCreateDialog
        open={isWorkflowBlankCreateDialogOpen}
        onClose={closeWorkflowBlankCreateDialog}
        onCreated={handleWorkflowBlankAppCreated}
      />
    </section>
  );
};