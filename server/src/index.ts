import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { documentsRouter } from './routes/documentRoutes.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'rag-support-api',
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/documents', documentsRouter)

app.use(errorHandler)

const port = Number(process.env.PORT ?? 5000)

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
