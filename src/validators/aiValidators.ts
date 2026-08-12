import { z } from 'zod';

// 对话请求校验
export const chatSchema = z.object({
  model: z.string().nonempty('model 不能为空'),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant'], 'role 只能为 user 或 assistant'),
        content: z.string().nonempty('消息内容不能为空'),
      }),
    )
    .min(1, 'messages 不能为空'),
  system: z.string().optional(),
  stream: z.boolean().optional().default(true),
  maxTokens: z.number().int('maxTokens 必须为整数').positive('maxTokens 必须为正数').optional(),
});
