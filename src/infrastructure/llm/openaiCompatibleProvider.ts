import type { ChatParams, ChatResult, ChatStreamChunk, ChatUsage, LLMProvider, ProviderConfig } from '@/infrastructure/llm/types';

// 从 OpenAI 格式的 usage 字段转换为统一格式
function toUsage(usage: any): ChatUsage | undefined {
  if (!usage)
    return undefined;
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  };
}

// OpenAI 兼容接口适配器（适用于 OpenAI、DeepSeek、通义千问等提供 /chat/completions 接口的供应商）
export function createOpenAICompatibleProvider(config: ProviderConfig): LLMProvider {
  const baseURL = (config.baseURL ?? '').replace(/\/+$/, '');

  // 发起 /chat/completions 请求
  async function request(params: ChatParams, stream: boolean) {
    // OpenAI 格式中 system 作为首条消息传入
    const messages = params.system
      ? [{ role: 'system', content: params.system }, ...params.messages]
      : params.messages;

    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages,
        stream,
        ...(stream ? { stream_options: { include_usage: true } } : {}),
        ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
      }),
      signal: params.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      let message = `供应商接口请求失败（${res.status}）`;
      try {
        message = JSON.parse(body)?.error?.message ?? message;
      }
      catch {}
      throw new Error(message);
    }

    return res;
  }

  return {
    async chat(params): Promise<ChatResult> {
      const res = await request(params, false);
      const data: any = await res.json();
      const message = data.choices?.[0]?.message ?? {};

      return {
        reasoning: message.reasoning_content || undefined,
        content: message.content ?? '',
        usage: toUsage(data.usage),
      };
    },

    async* chatStream(params): AsyncGenerator<ChatStreamChunk> {
      const res = await request(params, true);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let usage: ChatUsage | undefined;

      // 解析 SSE 流，每行形如 "data: {...}"，以 "data: [DONE]" 结束
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
          const text = line.trim();
          if (!text.startsWith('data:'))
            continue;

          const payload = text.slice(5).trim();
          if (payload === '[DONE]')
            continue;

          let data: any;
          try {
            data = JSON.parse(payload);
          }
          catch {
            continue;
          }

          if (data.usage)
            usage = toUsage(data.usage);

          const delta = data.choices?.[0]?.delta;
          if (delta?.reasoning_content)
            yield { type: 'reasoning', content: delta.reasoning_content };
          if (delta?.content)
            yield { type: 'text', content: delta.content };
        }
      }

      yield { type: 'done', usage };
    },
  };
}
