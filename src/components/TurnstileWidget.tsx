'use client'

import { useCallback, useEffect, useRef } from 'react'
import Script from 'next/script'

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string | undefined
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

interface TurnstileWidgetProps {
  siteKey: string
  onTokenChange: (token: string) => void
  resetSignal: number
}

export function TurnstileWidget({ siteKey, onTokenChange, resetSignal }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current !== null) return
    widgetIdRef.current =
      window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: 'chat',
        theme: 'light',
        size: 'normal',
        appearance: 'interaction-only',
        callback: (token: string) => onTokenChange(token),
        'expired-callback': () => onTokenChange(''),
        'error-callback': () => onTokenChange(''),
      }) ?? null
  }, [siteKey, onTokenChange])

  useEffect(() => {
    if (window.turnstile) renderWidget()
    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [renderWidget])

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current !== null && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
    }
  }, [resetSignal])

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
      />
      <div ref={containerRef} className="flex justify-center" />
    </>
  )
}
