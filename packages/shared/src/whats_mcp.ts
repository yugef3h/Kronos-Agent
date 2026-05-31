// 对应原理解析：
// 统一入口：AI 只需要和 mcp.callTool 打交道，不用关心支付和短信 API 各自的调用方式；
// 解耦：如果以后要换支付渠道（比如从微信支付换成支付宝），只需要修改 ThirdPartyPaymentAPI，AI 的代码完全不用改；
// 安全控制：可以在 callTool 里加权限校验、参数脱敏、日志记录，避免 AI 直接操作敏感 API。

// 真实 MCP 基于 JSON-RPC 2.0 协议，有完整的会话管理、错误处理和双向通信；
// 真实 MCP 会定义严格的工具 schema（用 JSON Schema），AI 可以自动理解工具的功能和参数；
// 真实 MCP 支持更多能力，比如读取文件、访问数据库、调用本地服务等，不只是 HTTP API。

// 光有 MCP 不行；MCP 只是 “连接协议”，真正的能力是 Skill！！！

// 模拟第三方支付API
const ThirdPartyPaymentAPI = {
    async pay(amount, orderId) {
        console.log(`调用支付API：订单 ${orderId}，金额 ${amount} 元`);
        // 模拟API返回
        return {
            success: true,
            transactionId: `TXN_${Date.now()}`,
            message: "支付成功"
        };
    }
};

// 模拟短信通知API
const SmsNotificationAPI = {
    async send(phone, message) {
        console.log(`调用短信API：给 ${phone} 发送：${message}`);
        return {
            success: true,
            messageId: `SMS_${Date.now()}`,
            message: "短信发送成功"
        };
    }
};

type ToolSchema = {
    type: string;
    properties: Record<string, { type: string }>;
    required: string[];
};

type ToolCallResult = {
    success: boolean;
    transactionId?: string;
    messageId?: string;
    message: string;
};

type ToolDefinition = {
    handler: (...args: unknown[]) => Promise<ToolCallResult>;
    schema: ToolSchema;
};

class MCPManager {
    tools: Record<string, ToolDefinition>;

    constructor() {
        // 注册可用的工具（对应不同的第三方API）
        this.tools = {
            "payment": {
                handler: ThirdPartyPaymentAPI.pay,
                // 定义AI调用时需要的参数格式（schema）
                schema: {
                    type: "object",
                    properties: {
                        amount: { type: "number" },
                        orderId: { type: "string" }
                    },
                    required: ["amount", "orderId"]
                }
            },
            "send_sms": {
                handler: SmsNotificationAPI.send,
                schema: {
                    type: "object",
                    properties: {
                        phone: { type: "string" },
                        message: { type: "string" }
                    },
                    required: ["phone", "message"]
                }
            }
        };
    }

    // AI 调用工具的统一入口
    async callTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
        const tool = this.tools[toolName];
        if (!tool) {
            throw new Error(`工具 ${toolName} 不存在`);
        }

        // （简化版）参数校验（真实MCP会严格按schema校验）
        const requiredParams = Object.keys(tool.schema.properties);
        const missingParams = requiredParams.filter(p => !(p in params));
        if (missingParams.length > 0) {
            throw new Error(`缺少必要参数：${missingParams.join(', ')}`);
        }

        // 调用对应的第三方API
        const result = await tool.handler(...Object.values(params));
        return result;
    }

    // 给AI返回所有可用工具的信息（让AI知道自己能做什么）
    getAvailableTools() {
        return Object.entries(this.tools).map(([name, tool]) => ({
            name,
            schema: tool.schema
        }));
    }
}


// 初始化MCP管理器
const mcp = new MCPManager();

// 模拟AI：先获取可用工具
console.log("AI获取可用工具：", mcp.getAvailableTools());

// 场景1：AI要发起支付
async function aiInitiatePayment() {
    try {
        const result = await mcp.callTool("payment", {
            amount: 99.9,
            orderId: "ORDER_12345"
        });
        console.log("AI收到支付结果：", result);
        // AI拿到结果后，还可以继续做后续操作（比如生成支付成功的回复）
        return `支付已完成，交易号：${result.transactionId}`;
    } catch (e) {
        console.error("支付失败：", e instanceof Error ? e.message : e);
        return "抱歉，支付请求出错了";
    }
}

// 场景2：AI要发送短信通知
async function aiSendNotification() {
    try {
        const result = await mcp.callTool("send_sms", {
            phone: "13800138000",
            message: "您的订单已支付成功，交易号：TXN_12345"
        });
        console.log("AI收到短信结果：", result);
        return `短信已发送至 ${result.messageId}`;
    } catch (e) {
        console.error("短信发送失败：", e instanceof Error ? e.message : e);
        return "抱歉，短信通知发送失败";
    }
}

// 运行测试
(async () => {
    console.log(await aiInitiatePayment());
    console.log("---");
    console.log(await aiSendNotification());
})();