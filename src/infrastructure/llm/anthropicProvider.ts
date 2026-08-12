import type { ChatParams, ChatResult, ChatStreamChunk, LLMProvider, ProviderConfig } from '@/infrastructure/llm/types';
import Anthropic from '@anthropic-ai/sdk';

// 默认输出上限：流式给足空间，非流式受 HTTP 超时限制取小一些
const STREAM_MAX_TOKENS = 64000;
const MAX_TOKENS = 16000;

// 构造 Anthropic 请求体（自适应思考，思考摘要随响应返回）
function buildParams(params: ChatParams, defaultMaxTokens: number) {
  return {
    model: params.model,
    max_tokens: params.maxTokens ?? defaultMaxTokens,
    system: params.system,
    messages: params.messages,
    thinking: { type: 'adaptive', display: 'summarized' },
  } satisfies Anthropic.MessageCreateParams;
}

// Anthropic 官方 SDK 适配器（Claude 系列模型）
export function createAnthropicProvider(config: ProviderConfig): LLMProvider {
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL || undefined,
  });

  return {
    async chat(params): Promise<ChatResult> {
      const response = await client.messages.create(
        buildParams(params, MAX_TOKENS),
        { signal: params.signal },
      );

      if (response.stop_reason === 'refusal') {
        throw new Error('请求被模型安全策略拒绝');
      }

      let reasoning = '';
      let content = '';
      for (const block of response.content) {
        if (block.type === 'thinking') {
          reasoning += block.thinking;
        }
        else if (block.type === 'text') {
          content += block.text;
        }
      }

      return {
        reasoning: reasoning || undefined,
        content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },

    async* chatStream(params): AsyncGenerator<ChatStreamChunk> {
      const stream = client.messages.stream(
        buildParams(params, STREAM_MAX_TOKENS),
        { signal: params.signal },
      );

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'thinking_delta') {
            yield { type: 'reasoning', content: event.delta.thinking };
          }
          else if (event.delta.type === 'text_delta') {
            yield { type: 'text', content: event.delta.text };
          }
        }
      }

      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') {
        throw new Error('请求被模型安全策略拒绝');
      }

      yield {
        type: 'done',
        usage: {
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
        },
      };
    },
  };
}
