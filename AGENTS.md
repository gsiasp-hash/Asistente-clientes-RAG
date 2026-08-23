# AGENTS.md — Guía para agentes de IA en este repositorio

Este archivo existe para que cualquier agente de IA (Claude Code, Cursor, Copilot, opencode, etc.) pueda poner en marcha el proyecto y trabajar sobre él siguiendo las mismas convenciones. Léelo completo antes de ejecutar o modificar nada.

## Qué es este proyecto

Asistente de soporte al cliente basado en **RAG** (Retrieval-Augmented Generation): los usuarios suben PDFs de conocimiento y un chat responde preguntas anclándose únicamente a esos documentos, con respuestas en streaming. Monorepo con dos carpetas:

- `server/` — API Express 5 + TypeScript (puerto 5000)
- `client/` — Frontend React + Vite + TypeScript + Tailwind CSS v4 (puerto 5173)

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

Completar como mínimo: `GROQ_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. El resto de variables tiene valores por defecto razonables (ver tabla en README).

### 4. Instalar y correr

```bash
# Terminal 1 — backend
cd server && npm install && npm run dev          # http://localhost:5000

# Terminal 2 — frontend
cd client && npm install && npm run dev          # http://localhost:5173 (proxy /api → 5000)
```

### 5. Validar que todo funciona

```bash
cd server && npm run verify    # prueba embeddings (Gemini), RPC (Supabase) y modelos (Groq)
```

Salida esperada: los tres checks con ✓. Si algo falla, el detalle indica qué servicio revisar.

## Comandos

| Carpeta | Comando | Uso |
| :--- | :--- | :--- |
| `server/` | `npm run dev` | Desarrollo con recarga automática (tsx watch) |
| `server/` | `npm run typecheck` | Verificación de tipos — correr SIEMPRE después de editar código del servidor |
| `server/` | `npm run build` / `start` | Compilar a `dist/` y ejecutar producción |
| `server/` | `npm run verify` | Smoke test de conexión con los 3 servicios externos |
| `client/` | `npm run dev` | Desarrollo Vite |
| `client/` | `npm run build` | Typecheck + bundle de producción — correr SIEMPRE después de editar código del cliente |

Regla de oro: tras cualquier cambio, correr `typecheck` (servidor) o `build` (cliente) antes de dar la tarea por terminada.

## Arquitectura en una mirada

```
Ingesta:   PDF → pdf-parse v2 → RecursiveCharacterTextSplitter(500/50)
           → Gemini embedContent lote 100 (RETRIEVAL_DOCUMENT) → Supabase document_sections

Consulta:  pregunta → embedding (RETRIEVAL_QUERY)
           → RPC match_document_sections(top 3, globales + sesión propia)
           → prompt anti-alucinación + historial (10 msgs) + contexto
           → Groq streaming (reasoning_format hidden) → SSE al cliente
           → respuesta persistida con fuentes en messages.sources
```

Código por capas: `services/` (lógica) → `controllers/` (HTTP/SSE) → `routes/` (montaje). Configuración centralizada en `src/config/env.ts` con validación fail-fast al arrancar.

## Modelo multi-tenant (importante para cualquier cambio)

- Toda ruta (salvo `/api/health`) exige header `X-Session-Token` — validado por `middleware/session.ts`, que además registra actividad en la tabla `sessions`
- `document_sections.session_id` y `conversations.session_id`: `NULL` = documento global de demostración (visible a todos); token = privado del visitante
- Subir con header `X-Admin-Token` igual a `ADMIN_TOKEN` guarda como global y omite límites
- Límites: 5 documentos y 300 chunks por sesión, 15 mensajes/sesión/día, 50 subidas/día global (`utils/rateLimiter.ts`, contadores en memoria)
- `services/cleanupService.ts` purga sesiones inactivas > `SESSION_TTL_HOURS` al arrancar y cada 30 min
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
| El stream SSE nunca termina en el cliente | Falta `res.end()` tras `done`/`error` | Cerrar siempre la respuesta |
| El modelo "razona" en vez de responder | gpt-oss emite reasoning | Mantener `reasoning_format: 'hidden'` en la llamada a Groq |
| `pdf-parse` crashea al importar | API v1 vieja | v2 usa clase: `new PDFParse({ data })` → `getText()` → siempre `destroy()` en `finally` |
| 400 en cualquier endpoint desde curl | Falta header de sesión | Agregar `-H "X-Session-Token: <8-64 chars alfanum>"` |
| Respuestas 429 inesperadas en pruebas | Contadores diarios activos | Reiniciar el server los vacía (memoria) o ajustar env |

## Tareas típicas y cómo abordarlas

- **"Levanta la app"**: iniciar backend y frontend (paso 4), confirmar `/api/health` y abrir localhost:5173
- **"Agrega un endpoint"**: service → controller → route, con validación de entrada y `HttpError` para fallos; registrar contador de rate-limit si consume cuota de IA
- **"Cambie las claves/modelos"**: actualizar `server/.env` y correr `npm run verify`
- **"La BD está vacía/rara"**: re-ejecutar `supabase/schema.sql` es destructivo solo si borras datos; preferir migraciones incrementales como archivos SQL nuevos versionados
