export interface SseMessage {
  event: string
  data: string
}

export async function* parseSse(res: Response): AsyncGenerator<SseMessage> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    let separatorIndex = buffer.indexOf('\n\n')

    while (separatorIndex !== -1) {
      const rawFrame = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)

      let event = 'message'
      let data = ''
      for (const line of rawFrame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (data) yield { event, data }

      separatorIndex = buffer.indexOf('\n\n')
    }
  }
}
