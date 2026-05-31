import { useCallback, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Handle, Position } from 'reactflow';
import {
  beginAppendHandlePointerState,
  consumeAppendHandleClick,
  createAppendHandlePointerState,
  endAppendHandlePointerState,
  updateAppendHandlePointerState,
} from '../utils/append-handle-pointer';

const appendTriggerHandleStyle: CSSProperties = {
  top: 0,
  right: 0,
  width: '100%',
  height: '100%',
  transform: 'none',
};

type AppendConnectorTriggerProps = {
  handleId: string;
  isDisabled?: boolean;
  wrapperClassName: string;
  visual: ReactNode;
  onTriggerClick: () => void;
};

export const AppendConnectorTrigger = ({
  handleId,
  isDisabled = false,
  wrapperClassName,
  visual,
  onTriggerClick,
}: AppendConnectorTriggerProps) => {
  const pointerStateRef = useRef(createAppendHandlePointerState());

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStateRef.current = beginAppendHandlePointerState({
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointerStateRef.current = updateAppendHandlePointerState(pointerStateRef.current, {
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const handlePointerEnd = useCallback(() => {
    pointerStateRef.current = endAppendHandlePointerState(pointerStateRef.current);
  }, []);

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      const result = consumeAppendHandleClick(pointerStateRef.current);
      pointerStateRef.current = result.nextState;
      if (!isDisabled && result.shouldOpen) {
        onTriggerClick();
      }
    },
    [isDisabled, onTriggerClick],
  );

  return (
    <div
      className={wrapperClassName}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClick={handleClick}
    >
      {visual}
      <Handle
        id={handleId}
        type="source"
        position={Position.Right}
        isConnectable={!isDisabled}
        isConnectableStart={!isDisabled}
        isConnectableEnd={false}
        style={appendTriggerHandleStyle}
        className="nodrag nopan !z-20 !border-0 !bg-transparent !opacity-0"
      />
    </div>
  );
};
