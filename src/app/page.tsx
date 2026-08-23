'use client'

import { Header } from '@/components/Header'
import { PdfUploader } from '@/components/PdfUploader'
import { DocumentList } from '@/components/DocumentList'
import { ChatWindow } from '@/components/ChatWindow'
import { useDocuments } from '@/hooks/useDocuments'
import { useChatStream } from '@/hooks/useChatStream'

export default function Home() {
  const documents = useDocuments()
  const chat = useChatStream()

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
        <aside className="w-full space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 lg:w-80 lg:flex-none">
          <PdfUploader uploadingFile={documents.uploadingFile} onUpload={documents.upload} />
          {documents.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {documents.error}
            </div>
          )}
          <DocumentList
            documents={documents.documents}
            loading={documents.loading}
            onRemove={(fileName) => void documents.remove(fileName)}
            onClearMine={() => void documents.clearMine()}
          />
        </aside>

        <section className="min-h-[28rem] flex-1 lg:min-h-0">
          <ChatWindow
            messages={chat.messages}
            isStreaming={chat.isStreaming}
            error={chat.error}
            onSend={chat.send}
            onStop={chat.stop}
            onNewChat={chat.newChat}
          />
        </section>
      </main>
    </div>
  )
}
