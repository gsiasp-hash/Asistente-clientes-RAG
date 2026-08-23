# Asistente de Soporte al Cliente (RAG)

Sistema de soporte al cliente inteligente basado en **RAG** (Retrieval-Augmented Generation): se cargan PDFs de conocimiento (FAQs, políticas, manuales) y un chat responde preguntas en tiempo real anclándose únicamente a esos documentos — sin alucinaciones. Incluye un panel de administración multi-tenant pensado para demostraciones públicas de portafolio.

## Características

- Ingesta de PDFs: extracción de texto, fragmentación inteligente y embeddings semánticos
- Chat con respuestas en streaming (SSE, token a token)
- Memoria conversacional: el asistente recuerda las últimas 10 interacciones de la sesión
- Rechazo honesto: si la información no está en los documentos, lo dice en vez de inventar
- Búsqueda vectorial híbrida: documentos globales de demostración + documentos privados por visitante
- Multi-tenant sin login: sesiones anónimas aisladas con limpieza automática
- Blindajes de cuota para stacks gratuitos: límites por sesión y contadores diarios

## Stack tecnológico

| Capa | Tecnología |
| :--- | :--- |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS v4 |
| Backend | Node.js (≥20) · Express 5 · TypeScript |
| Base de datos vectorial | Supabase (PostgreSQL + pgvector) |
| Embeddings | Google Gemini — `gemini-embedding-001` (768 dimensiones) |
| LLM | Groq Cloud — `openai/gpt-oss-120b` |
| Procesamiento PDF | pdf-parse v2 + LangChain TextSplitter (500 chars / overlap 50) |

Todos los modelos son configurables vía variables de entorno, ya que los proveedores rotan sus catálogos con frecuencia.

---

## Arranca el proyecto con un agente de IA

Este repositorio incluye un archivo [`AGENTS.md`](AGENTS.md) con instrucciones paso a paso diseñadas para que **cualquier agente de IA de código** (Claude Code, Cursor, GitHub Copilot, opencode, etc.) ponga el proyecto en funcionamiento por ti: configurar Supabase, obtener las claves de IA, completar el `.env`, instalar dependencias y levantar ambos servidores.

Para usarlo, abre este proyecto con tu agente favorito y dile algo como:

```
Lee el archivo AGENTS.md y guíame paso a paso para dejar la app funcionando en local.
```

El agente te irá pidiendo lo único que no puede hacer solo: crear tus cuentas gratuita en Supabase/Groq/Google AI Studio y pegar tus credenciales en `server/.env`. Todo lo demás (SQL, instalación, arranque y verificación) lo ejecuta él siguiendo la guía.

---

## Puesta en marcha

### 1. Base de datos (Supabase)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com)
2. Abre el **SQL Editor** y ejecuta el contenido completo de [`supabase/schema.sql`](supabase/schema.sql). Esto crea la extensión `pgvector`, las tablas (`document_sections`, `conversations`, `messages`, `sessions`), los índices y la función RPC de búsqueda semántica.
3. En **Project Settings → API Keys** copia la clave `service_role` (o una secret key `sb_secret_...`) y el **Project URL** — solo el dominio raíz, sin `/rest/v1`.

### 2. Claves de IA

- **Groq Cloud** ([console.groq.com](https://console.groq.com)) → API Keys → crea una clave (`gsk_...`)
- **Google AI Studio** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)) → Create API key (`AIza...`)

### 3. Configurar el backend

```bash
cd server
cp .env.example .env
```

Edita `server/.env` con tus valores:

```env
PORT=5000

GROQ_API_KEY=tu_groq_api_key
GEMINI_API_KEY=tu_gemini_api_key

# Solo el dominio raíz del proyecto, SIN /rest/v1
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_role_key

EMBEDDING_MODEL=gemini-embedding-001
LLM_MODEL=openai/gpt-oss-120b
RAG_MATCH_THRESHOLD=0.4

ADMIN_TOKEN=un_token_secreto_para_documentos_globales
SESSION_TTL_HOURS=1
DAILY_UPLOAD_LIMIT=50
SESSION_MESSAGE_LIMIT=15
```

### 4. Correr en local

```bash
# Terminal 1 — backend en http://localhost:5000
cd server && npm install && npm run dev

# Terminal 2 — frontend en http://localhost:5173
cd client && npm install && npm run dev
```

El cliente ya tiene un proxy de desarrollo: todas las llamadas a `/api` se redirigen al puerto 5000 sin configurar CORS.

### 5. Verificar la instalación (opcional pero recomendado)

```bash
cd server && npm run verify
```

Prueba las credenciales contra los tres servicios (embeddings, RPC de búsqueda y catálogo de modelos) sin exponer claves por pantalla.

---

## Variables de entorno

| Variable | Default | Descripción |
| :--- | :--- | :--- |
| `PORT` | `5000` | Puerto del backend |
| `GROQ_API_KEY` | — | Clave de Groq Cloud (requerida) |
| `GEMINI_API_KEY` | — | Clave de Google AI Studio (requerida) |
| `SUPABASE_URL` | — | Dominio raíz del proyecto Supabase (requerida) |
| `SUPABASE_SERVICE_KEY` | — | Clave service_role / secret key (requerida) |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Modelo de embeddings de Gemini |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Modelo de chat en Groq |
| `RAG_MATCH_THRESHOLD` | `0.4` | Similitud mínima (0–1) para considerar un fragmento relevante |
| `ADMIN_TOKEN` | vacío | Si se define, permite subir documentos globales de demostración |
| `SESSION_TTL_HOURS` | `1` | Horas de inactividad antes de purgar una sesión |
| `DAILY_UPLOAD_LIMIT` | `50` | Tope diario global de subidas (anti-abuso) |
| `SESSION_MESSAGE_LIMIT` | `15` | Mensajes de chat por sesión y día |

---

## API

Todas las rutas requieren el header `X-Session-Token` (cadena alfanumérica de 8–64 caracteres que identifica la sesión anónima). El frontend lo genera automáticamente y lo persiste en `localStorage`.

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Estado del servicio (público) |
| `POST` | `/api/documents/upload` | Sube un PDF (multipart, campo `file`, máx. 10 MB). Con `?replace=true` reemplaza uno existente |
| `GET` | `/api/documents` | Lista `{demo: [...], mine: [...]}` con secciones y fecha |
| `DELETE` | `/api/documents/:fileName` | Elimina un documento de tu sesión |
| `POST` | `/api/chat` | `{conversationId?, message}` → respuesta en streaming SSE |
| `GET` | `/api/conversations/:id/messages` | Historial completo de una conversación propia |

### Flujo de duplicados

Si el archivo ya existe, la subida responde `409` con detalle; el cliente confirma con el usuario y reenvía con `?replace=true` para borrar las secciones previas e indexar de nuevo.

### Eventos SSE del chat

```
event: meta    data: {"conversationId":"uuid"}
event: delta   data: {"text":"fragmento"}
event: done    data: {"conversationId":"uuid"}
event: error   data: {"message":"..."}
```

### Documentos globales de demostración

Subiendo con el header adicional `X-Admin-Token: <ADMIN_TOKEN>`, el documento se guarda como global (`session_id NULL`): es visible para todos los visitantes como material de demostración y nunca expira. Ideal para precargar 2–3 PDFs curados sobre un tema específico antes de compartir el link del portafolio.

---

## Prepara tus PDFs para mejores respuestas

El asistente divide cada documento en fragmentos de ~500 caracteres y responde usando solo los 3 más relevantes por pregunta. Para que las respuestas sean precisas:

- **PDF con texto seleccionable**: los escaneados (imágenes) no producen fragmentos
- **Párrafos autocontenidos**: cada fragmento se lee fuera de contexto — nombra completo el producto/proceso que explicas
- **Datos clave en prosa**, no solo en tablas (las tablas densas pierden su estructura al extraerse)
- **Un tema por documento** y datos concretos: números, plazos, pasos numerados
- **Nombres de archivo descriptivos** y layouts simples de una columna
- **Cierra con una sección de FAQ**: genera fragmentos que responden directo a preguntas naturales

Guía completa con ejemplos ❌/✅ y checklist: [`demo-docs/guia-preparar-pdfs.md`](demo-docs/guia-preparar-pdfs.md).

---

## Modelo multi-tenant para portafolio público

Pensado para que cualquier visitante pueda probar la app sin contaminar la base ni agotar cuotas gratuitas:

- Cada visitante recibe una **sesión anónima** aislada: sus documentos e historiales son invisibles para los demás
- Tras **1 hora de inactividad**, un trabajo de limpieza borra sus documentos, conversaciones y mensajes (barrido al arrancar y cada 30 minutos)
- Límites por sesión: **5 documentos**, **300 fragmentos** indexados y **15 mensajes de chat por día**
- Límite global: **50 subidas por día**
- Los errores de límite responden con mensajes amigables en español (HTTP 400/429)

La seguridad de acceso directo a la base está cubierta con RLS activado y sin políticas públicas: solo el backend con `service_role` lee y escribe.

## Cómo funciona (pipeline)

1. **Ingesta**: PDF → extracción de texto (pdf-parse) → normalización → fragmentación (500 chars, overlap 50) → embeddings por lotes de 100 con `RETRIEVAL_DOCUMENT` → inserción en `document_sections`
2. **Consulta**: pregunta → embedding con `RETRIEVAL_QUERY` → RPC `match_document_sections` (top 3, globales + sesión propia) → prompt con reglas anti-alucinación + historial (10 msgs) + contexto recuperado → streaming desde Groq → respuesta persistida con sus fuentes

## Estructura del proyecto

```
├── client/                  # Frontend React + Vite + Tailwind
│   └── src/
│       ├── components/      # Header, PdfUploader, DocumentList, ChatWindow, MessageBubble
│       ├── hooks/           # useDocuments, useChatStream (parser SSE propio)
│       ├── lib/             # api.ts (fetch tipado), sse.ts
│       └── types.ts
├── server/                  # Backend Express + TypeScript
│   └── src/
│       ├── config/          # env, supabase, gemini, groq
│       ├── controllers/     # documentController, chatController
│       ├── middleware/      # errorHandler, session
│       ├── routes/          # documentRoutes, chatRoutes
│       ├── services/        # pdfService, chatService, cleanupService
│       ├── scripts/         # verify-setup (npm run verify)
│       └── utils/           # errors, rateLimiter, sse
└── supabase/
    ├── schema.sql           # Esquema completo para instalaciones nuevas
    └── multi-tenant.sql     # Migración para bases preexistentes
```

## Scripts disponibles

| Carpeta | Comando | Acción |
| :--- | :--- | :--- |
| `server/` | `npm run dev` | Desarrollo con recarga automática |
| `server/` | `npm run build` / `npm start` | Compilar a `dist/` y ejecutar producción |
| `server/` | `npm run typecheck` | Verificación de tipos |
| `server/` | `npm run verify` | Prueba de conexión con Gemini, Supabase y Groq |
| `client/` | `npm run dev` | Desarrollo en puerto 5173 |
| `client/` | `npm run build` | Build de producción |

## Estado del proyecto

- [x] Fase 0 — Monorepo (backend + frontend)
- [x] Fase 1 — Infraestructura, credenciales y esquema de BD
- [x] Fase 2 — Pipeline de ingesta de PDFs
- [x] Fase 3 — Chat RAG con streaming SSE y memoria conversacional
- [x] Fase 4 — Panel de administración multi-tenant
- [ ] Fase 5 — Despliegue (Vercel + Render) y demo pública

¿Quieres profundizar en la arquitectura o modificar el proyecto? El archivo [`AGENTS.md`](AGENTS.md) documenta la estructura interna, las convenciones y los errores comunes ya resueltos.
