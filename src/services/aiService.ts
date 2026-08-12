import type { ChatParams, LLMProvider } from '@/infrastructure/llm';
import { models, providers } from '@/config/llm';
import { createProvider } from '@/infrastructure/llm';

// 供应商适配器缓存（按供应商名惰性创建）
const providerCache = new Map<string, LLMProvider>();

// 获取可用模型列表（仅返回已配置 API Key 的供应商下的模型）
export function getModels() {
  return models.filter(m => providers[m.provider]?.apiKey);
}

// 根据模型 ID 解析出对应的供应商适配器
function resolveProvider(modelId: string) {
  const model = models.find(m => m.id === modelId);
  if (!model)
    throw new Error(`不支持的模型：${modelId}`);

  const config = providers[model.provider];
  if (!config?.apiKey)
    throw new Error(`供应商 ${model.provider} 未配置 API Key`);

  let provider = providerCache.get(model.provider);
  if (!provider) {
    provider = createProvider(config);
    providerCache.set(model.provider, provider);
  }
  return provider;
}

// 非流式对话
export function chat(params: ChatParams) {
  return resolveProvider(params.model).chat(params);
}

// 流式对话
export function chatStream(params: ChatParams) {
  return resolveProvider(params.model).chatStream(params);
}
