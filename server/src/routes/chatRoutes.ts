import { Router } from 'express'
import { chat, getConversationMessages } from '../controllers/chatController.js'

export const chatRouter = Router()

chatRouter.post('/chat', chat)
chatRouter.get('/conversations/:id/messages', getConversationMessages)
