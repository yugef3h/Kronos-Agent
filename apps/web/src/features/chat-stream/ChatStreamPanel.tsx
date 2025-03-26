import { ChatStreamPanelView } from './components/ChatStreamPanelView';
import { useChatStreamController } from './hooks/useChatStreamController';

export const ChatStreamPanel = () => {
  const controller = useChatStreamController();

  return <ChatStreamPanelView controller={controller} />;
};