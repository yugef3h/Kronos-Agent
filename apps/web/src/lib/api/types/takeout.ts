export type TakeoutInstruction = '识别外卖意图' | '协议同意回复' | '商品选择完成';

export type TakeoutSimulationPayload = {
	prompt?: string;
	address?: string;
	discount?: number;
};

export type TakeoutSimulationResponse = {
	reply: string;
	source: 'scenario';
	traceId: string;
	intent?: 'takeout_order' | 'takeout_recommend' | 'non_takeout';
	confidence?: number;
	slots?: {
		dishType: string | null;
		addressHint: string | null;
		budgetRange: string | null;
		timeConstraint: string | null;
		tastePreference: string[];
	};
	missingSlots?: Array<'dishType' | 'addressHint' | 'budgetRange' | 'timeConstraint'>;
	nextAction?: 'start_takeout_flow' | 'ask_for_slot' | 'fallback_to_chat';
};

export type TakeoutIntentAnalysisResponse = {
	intent: 'takeout_order' | 'takeout_recommend' | 'non_takeout';
	confidence: number;
	slots: {
		dishType: string | null;
		addressHint: string | null;
		budgetRange: string | null;
		timeConstraint: string | null;
		tastePreference: string[];
	};
	missingSlots: Array<'dishType' | 'addressHint' | 'budgetRange' | 'timeConstraint'>;
	nextAction: 'start_takeout_flow' | 'ask_for_slot' | 'fallback_to_chat';
};

export type TakeoutOrchestrationResponse = {
	action: 'chat' | 'ask_slot' | 'tool_call' | 'delegate_chat_stream';
	assistantReply: string;
	toolCall?: {
		name: 'takeout';
		params: {
			food: string;
		};
	};
};

export type TakeoutCatalogComboResponse = {
	id: string;
	name: string;
	extraPrice: number;
};

export type TakeoutCatalogFoodResponse = {
	id: string;
	shopName: string;
	shopScore: number;
	distance: string;
	productName: string;
	productTip: string;
	productImage: string;
	priceTip: string;
	name: string;
	price: number;
	deliveryTime: string;
	combos: TakeoutCatalogComboResponse[];
};

export type TakeoutCatalogResponse = {
	source: 'model' | 'fallback';
	address: string;
	discount: number;
	delivery: {
		eta: string;
		courier: string;
	};
	foods: TakeoutCatalogFoodResponse[];
};
