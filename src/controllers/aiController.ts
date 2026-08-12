import type { Request, Response } from 'express';
import * as aiService from '@/services/aiService';
import { asyncHandler } from '@/utils/handler';
import { fail, success } from '@/utils/response';
import { validate } from '@/utils/validate';
import { chatSchema } from '@/validators/aiValidators';

// 获取可用模型列表
export const getModels = asyncHandler(async (_req, res) => {
  success(res, aiService.getModels());
});

/**
 * 对话接口
 * 默认以 SSE 流式返回，每条事件为 data: {type: 'reasoning' | 'text' | 'done', ...}，
 * 结束时追加 data: [DONE]；传 stream=false 则等待完成后返回 JSON。
 * SSE 开始后发生的错误以 data: {type: 'error', message} 事件返回。
 */
export async function chat(req: Request, res: Response) {
  // 客户端断开时中止对供应商的请求，避免空耗 token
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const { stream, ...params } = validate(chatSchema, req.body);

    if (!stream) {
      const data = await aiService.chat({ ...params, signal: controller.signal });
      return success(res, data);
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲，保证逐块推送
    res.flushHeaders();

    for await (const chunk of aiService.chatStream({ ...params, signal: controller.signal })) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }
  catch (e: any) {
    // 客户端已断开，直接结束即可
    if (controller.signal.aborted)
      return res.end();

    // 流已开始则以 SSE 事件返回错误，否则返回普通错误响应
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`);
      res.end();
    }
    else {
      fail(res, e.message);
    }
  }
}
