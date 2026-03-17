import { TakeoutAuthModal } from './TakeoutAuthModal';
import { TakeoutComboModal } from './TakeoutComboModal';
import { TakeoutPaymentModal } from './TakeoutPaymentModal';
import type {
  TakeoutFlowState,
  TakeoutModalState,
  TakeoutPaymentInputRef,
} from '../types';

type TakeoutToolModalsProps = {
  flowState: TakeoutFlowState;
  modalState: TakeoutModalState;
  isAgreementChecked: boolean;
  onAgreementCheckedChange: (nextValue: boolean) => void;
  onConfirmAgreement: (flowId: number) => void | Promise<void>;
  onCloseAuthorization: () => void;
  onCloseCombo: () => void;
  onSelectCombo: (flowId: number, combo: NonNullable<TakeoutFlowState['selectedCombo']>) => void;
  onConfirmSelection: (flowId: number) => void | Promise<void>;
  paymentInputRef: TakeoutPaymentInputRef;
  onClosePayment: () => void;
  onPaymentPasswordChange: (flowId: number, rawValue: string) => void;
};

export const TakeoutToolModals = ({
  flowState,
  modalState,
  isAgreementChecked,
  onAgreementCheckedChange,
  onConfirmAgreement,
  onCloseAuthorization,
  onCloseCombo,
  onSelectCombo,
  onConfirmSelection,
  paymentInputRef,
  onClosePayment,
  onPaymentPasswordChange,
}: TakeoutToolModalsProps) => {
  return (
    <>
      {modalState.authFlowId === flowState.flowId && (
        <TakeoutAuthModal
          flowId={modalState.authFlowId}
          isCallingApi={flowState.isCallingApi}
          isAgreementChecked={isAgreementChecked}
          onAgreementCheckedChange={onAgreementCheckedChange}
          onConfirm={onConfirmAgreement}
          onClose={onCloseAuthorization}
        />
      )}

      {modalState.comboFlowId === flowState.flowId && flowState.selectedFood && (
        <TakeoutComboModal
          flowId={modalState.comboFlowId}
          flowState={flowState}
          onClose={onCloseCombo}
          onSelectCombo={onSelectCombo}
          onConfirm={onConfirmSelection}
        />
      )}

      {modalState.paymentFlowId === flowState.flowId && (
        <TakeoutPaymentModal
          flowId={modalState.paymentFlowId}
          flowState={flowState}
          paymentInputRef={paymentInputRef}
          onClose={onClosePayment}
          onPaymentPasswordChange={onPaymentPasswordChange}
        />
      )}
    </>
  );
};