# AGENTS.md — Guía para agentes de IA en este repositorio

Este archivo existe para que cualquier agente de IA (Claude Code, Cursor, Copilot, opencode, etc.) pueda poner en marcha el proyecto y trabajar sobre él siguiendo las mismas convenciones. Léelo completo antes de ejecutar o modificar nada.

## Qué es este proyecto

Asistente de soporte al cliente basado en **RAG** (Retrieval-Augmented Generation): los usuarios suben PDFs de conocimiento y un chat responde preguntas anclándose únicamente a esos documentos, con respuestas en streaming. Aplicación única **Next.js 16 (App Router)** en la raíz del repo: frontend React 19 + Tailwind CSS v4 y API mediante Route Handlers, mismo origen sin CORS. Desarrollo en el puerto 3000.

Stack completo, pipeline interno y documentación de la API: [`README.md`](README.md).

## Puesta en marcha paso a paso

### 1. Base de datos (Supabase — requiere cuenta gratis)

1. Crear un proyecto en [supabase.com](https://supabase.com)
2. En el **SQL Editor**, ejecutar el contenido completo de `supabase/schema.sql` (extensión pgvector, tablas `document_sections`, `conversations`, `messages`, `sessions`, índices y función RPC `match_document_sections`)
3. Copiar credenciales desde **Project Settings → Data API**:
   - **Project URL**: solo el dominio raíz (`https://xxx.supabase.co`) — NUNCA incluyas `/rest/v1`
   - **service_role secret** o secret key `sb_secret_...` (no la clave `anon`)

### 2. Claves de IA

- **Groq Cloud** ([console.groq.com](https://console.groq.com)) → API Keys → clave `gsk_...`
- **Google AI Studio** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) → Create API key → clave `AIza...`

### 3. Configurar entorno

```bash
cd server && cp .env.example .env
```

Completar como mínimo: `GROQ_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. El resto de variables tiene valores por defecto razonables (ver tabla en README). El `.env` vive en la raíz y Next lo carga automáticamente; en producción las mismas variables se configuran cifradas en Vercel Environment Variables.

### 4. Instalar y correr

```bash
npm install
npm run dev          # http://localhost:3000
```

### 5. Validar que todo funciona

```bash
npm run verify    # prueba embeddings (Gemini), RPC (Supabase) y modelos (Groq)
```

Salida esperada: los tres checks con ✓. Si algo falla, el detalle indica qué servicio revisar.

## Comandos

| Comando | Uso |
| :--- | :--- |
| `npm run dev` | Desarrollo con recarga automática (http://localhost:3000) |
| `npm run typecheck` | Verificación de tipos |
| `npm run build` | Build de producción (incluye typecheck) — correr SIEMPRE tras editar código |
| `npm run verify` | Smoke test de conexión con los 3 servicios externos |
| `npm run audit` | Auditoría del contenido de la BD |

Regla de oro: tras cualquier cambio, correr `npm run build` antes de dar la tarea por terminada.

## Arquitectura en una mirada

```
Ingesta:   PDF → unpdf (pdf.js serverless) → RecursiveCharacterTextSplitter(500/50)
           → Gemini embedContent lote 100 (RETRIEVAL_DOCUMENT) → Supabase document_sections

Consulta:  pregunta → embedding (RETRIEVAL_QUERY)
           → RPC match_document_sections(top 3, globales + sesión propia)
           → prompt anti-alucinación + formato Markdown + historial (10 msgs) + contexto
           → Groq streaming (reasoning_format hidden) → SSE al cliente
           → respuesta persistida con fuentes en messages.sources

Render:    useChatStream (parser SSE) → ChatWindow → MessageBubble
           → asistente vía MarkdownContent (react-markdown + remark-gfm):
             tablas GFM con scroll horizontal, listas y código estilizados;
             usuario = texto plano; cursor de streaming = carácter ▍ inline
```

Código por capas: `src/app/api/*/route.ts` (HTTP/SSE, delgados) → `src/server/*.ts` (services y clientes SDK). La sesión se valida con `requireSession(request)` dentro de cada handler. Configuración centralizada en `src/server/env.ts` con validación fail-fast. Las rutas que tocan IA o PDFs declaran `runtime = 'nodejs'` y `maxDuration = 60`.

## Modelo multi-tenant (importante para cualquier cambio)

- Toda ruta (salvo `/api/health`) exige header `X-Session-Token` — validado por `src/server/session.ts`, que además registra actividad en la tabla `sessions`
- `document_sections.session_id` y `conversations.session_id`: `NULL` = documento global de demostración (visible a todos); token = privado del visitante
- Subir con header `X-Admin-Token` igual a `ADMIN_TOKEN` guarda como global y omite límites
- Límites: 5 documentos y 300 chunks por sesión, 15 mensajes/sesión/día, 50 subidas/día global (`utils/rateLimiter.ts`, contadores en memoria)
- La limpieza perezosa (`session.ts` → `cleanupService.ts`) purga sesiones con throttling de 10 min al validar sesiones (patrón serverless: no hay proceso persistente). Doble criterio: inactivas > `SESSION_TTL_HOURS` **o** con vida > `SESSION_MAX_AGE_HOURS` aunque sigan activas (timeout absoluto anti-acumulación de recursos; requiere `sessions.created_at`, ya incluida en `schema.sql`)
- La RPC de búsqueda SIEMPRE recibe `p_session_id`; `initConversation` valida ownership (404 si no es tuya)

## Convenciones del proyecto

1. Todo el copy visible de la interfaz y los mensajes de error van en **español**
2. Sin comentarios en el código; nombres autoexplicativos
3. Errores HTTP mediante `throw new HttpError(status, mensaje)` — el `errorHandler` central los serializa a JSON
4. Los modelos de IA se configuran por `.env` (`EMBEDDING_MODEL`, `LLM_MODEL`), nunca hardcodeados — los proveedores rotan catálogos seguido
5. TypeScript estricto; respetar `noUncheckedIndexedAccess`

## Errores comunes ya resueltos (leer antes de depurar)

| Síntoma | Causa | Solución |
| :--- | :--- | :--- |
| RPC falla con `PGRST125 Invalid path` | `SUPABASE_URL` incluye `/rest/v1` | Usar solo el dominio raíz |
| RPC no encuentra función con 4 args | Falta ejecutar `supabase/schema.sql` o su caché | Re-ejecutar SQL y `NOTIFY pgrst, 'reload schema'` |
| El stream SSE nunca termina en el cliente | Falta `controller.close()` tras `done`/`error` | Cerrar siempre el ReadableStream en `finally` |
| El modelo "razona" en vez de responder | gpt-oss emite reasoning | Mantener `reasoning_format: 'hidden'` en la llamada a Groq |
| pdf.js crasheaba en Vercel (`DOMMatrix is not defined`, 500 vacío) | El build de pdf.js para navegador referencia globals del browser que no existen en lambdas | Extracción vía `unpdf` (build serverless de pdf.js, import dinámico perezoso); nunca importar pdf.js de navegador en el servidor |
| `extractPdf` corre contra timeout de 15s (`Promise.race`) y clasifica errores a 422 amigables (contraseña vs dañado); el error crudo queda en logs como `[extractPdf]` |
| Upload de PDF corrupto colgaba o daba 500 feo | pdf.js entra en bucle con xref malformado y lanza excepciones sin clasificar | `extractPdf` corre contra timeout de 15s (`Promise.race`) y clasifica errores a 422 amigables (contraseña vs dañado); `destroy()` también tiene tope de 3s |
| Token crasheaba en contextos inseguros o storage bloqueado | `crypto.randomUUID` exige contexto seguro (https/localhost) y el getter de `localStorage` puede lanzar | `api.ts` envuelve storage en try/catch con fallback a token en memoria y generador alfanumérico propio |
| 400 en cualquier endpoint desde curl | Falta header de sesión | Agregar `-H "X-Session-Token: <8-64 chars alfanum>"` |
| Scripts de `scripts/` no ven `.env` | Falta dotenv | Ya importan `dotenv/config`; ejecutarlos vía `npm run verify` / `npm run audit` |
| Respuestas 429 inesperadas en pruebas | Contadores diarios activos | Reiniciar el server los vacía (memoria) o ajustar env |

## Tareas típicas y cómo abordarlas

- **"Levanta la app"**: `npm run dev` (paso 4), confirmar `/api/health` y abrir localhost:3000
- **"Agrega un endpoint"**: crear `src/app/api/<ruta>/route.ts` delgado (validación + `HttpError` + `jsonError`) apoyado en un service de `src/server/`; declarar `runtime='nodejs'` si usa SDK/PDF; registrar contador de rate-limit si consume cuota de IA
- **"Cambie las claves/modelos"**: actualizar `.env` (o las Environment Variables de Vercel) y correr `npm run verify`
- **"La BD está vacía/rara"**: re-ejecutar `supabase/schema.sql` es destructivo solo si borras datos; preferir migraciones incrementales como archivos SQL nuevos versionados
- Limitaciones aceptadas (documentadas, no bugs): subidas concurrentes de la misma sesión pueden exceder transitoriamente el presupuesto de chunks (sin unique index en `session_id, file_name`); los contadores de rate-limit viven en memoria y se reinician con cada deploy; un PDF con contenido adversarial podría intentar inyección de prompt en su propia sesión (el contexto no contiene secretos)
