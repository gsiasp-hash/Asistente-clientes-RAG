import { Router } from 'express'
import { chat, getConversationMessages } from '../controllers/chatController.js'
import { requireSession } from '../middleware/session.js'

export const chatRouter = Router()

chatRouter.use(requireSession)
chatRouter.post('/chat', chat)
chatRouter.get('/conversations/:id/messages', getConversationMessages)
