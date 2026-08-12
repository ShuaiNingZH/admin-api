// 对话消息
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 对话请求参数（与具体供应商无关）
export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  system?: string;
  maxTokens?: number;
  signal?: AbortSignal;
}

// Token 用量
export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
}

// 流式输出块
export type ChatStreamChunk
  = | { type: 'reasoning'; content: string } // 思考过程（模型支持时输出）
    | { type: 'text'; content: string } // 正文
    | { type: 'done'; usage?: ChatUsage }; // 结束

// 非流式返回结果
export interface ChatResult {
  reasoning?: string;
  content: string;
  usage?: ChatUsage;
}

// 供应商接入配置
export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
}

// 供应商适配器统一接口，接入新供应商时实现该接口
export interface LLMProvider {
  // 非流式对话
  chat: (params: ChatParams) => Promise<ChatResult>;
  // 流式对话
  chatStream: (params: ChatParams) => AsyncGenerator<ChatStreamChunk>;
}
