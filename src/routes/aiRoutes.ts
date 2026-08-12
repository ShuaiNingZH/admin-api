import { Router } from 'express';
import { chat, getModels } from '@/controllers/aiController';
import { authenticate } from '@/middlewares/authMiddleware';

const router = Router();

// 获取可用模型列表
router.get('/ai/models', authenticate, getModels);

// 对话（默认 SSE 流式返回）
router.post('/ai/chat', authenticate, chat);

export default router;
