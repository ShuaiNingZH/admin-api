import type { ProviderConfig } from '@/infrastructure/llm/types';

// 供应商接入方式：anthropic 官方 SDK / OpenAI 兼容接口
export interface LLMProviderConfig extends ProviderConfig {
  type: 'anthropic' | 'openai-compatible';
}

// 可用模型配置
export interface LLMModelConfig {
  // 模型 ID，原样透传给供应商
  id: string;
  // 展示名称
  name: string;
  // 所属供应商，对应 providers 的 key
  provider: string;
}

// 供应商注册表：接入新供应商时在此添加（OpenAI 兼容接口的供应商无需写代码，配置即可）
export const providers: Record<string, LLMProviderConfig> = {
  anthropic: {
    type: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  },
  deepseek: {
    type: 'openai-compatible',
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1',
  },
  dashscope: {
    type: 'openai-compatible',
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  openai: {
    type: 'openai-compatible',
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  },
};

// 模型注册表：开放给前端选择的模型在此添加
export const models: LLMModelConfig[] = [
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', provider: 'anthropic' },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'anthropic' },
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek' },
  { id: 'qwen-plus', name: '通义千问 Plus', provider: 'dashscope' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
];
