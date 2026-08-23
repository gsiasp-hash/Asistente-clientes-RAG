export interface DocumentSummary {
  fileName: string
  sections: number
  lastIngested: string
}

export interface DocumentsByScope {
  demo: DocumentSummary[]
  mine: DocumentSummary[]
}

export interface UploadResult {
  fileName: string
  pages: number
  chunks: number
  replacedSections: number
}

export interface ConflictInfo {
  fileName: string
  existingSections: number
  message: string
}

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface HistoryMessage extends ChatMessage {
  sources: Array<{ fileName: string; similarity: number }> | null
  createdAt: string | null
}
