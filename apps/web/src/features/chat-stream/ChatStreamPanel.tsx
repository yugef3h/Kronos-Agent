import { ChatStreamPanelView } from './components/ChatStreamPanelView';
import { useChatStreamController } from './hooks/useChatStreamController';
import { ChatStreamProvider } from './ChatStreamContext';

export const ChatStreamPanel = () => {
  const controller = useChatStreamController();

  return (
    <ChatStreamProvider value={controller}>
      <ChatStreamPanelView />
    </ChatStreamProvider>
  );
};