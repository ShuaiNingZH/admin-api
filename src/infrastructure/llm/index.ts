import type { LLMProviderConfig } from '@/config/llm';
import type { LLMProvider } from '@/infrastructure/llm/types';
import { createAnthropicProvider } from '@/infrastructure/llm/anthropicProvider';
import { createOpenAICompatibleProvider } from '@/infrastructure/llm/openaiCompatibleProvider';

// 按配置创建对应的供应商适配器
export function createProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.type) {
    case 'anthropic':
      return createAnthropicProvider(config);
    case 'openai-compatible':
      return createOpenAICompatibleProvider(config);
  }
}

export type * from '@/infrastructure/llm/types';
