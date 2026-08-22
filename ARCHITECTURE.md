  # 🤖 AI Customer Support RAG — Arquitectura & Guía de Inicio

Sistema de soporte al cliente inteligente basado en **RAG (Retrieval-Augmented Generation)**. La aplicación permite a las empresas cargar documentos PDF de conocimiento (FAQs, políticas, manuales) y responder dudas de los usuarios en tiempo real de forma precisa, evitando alucinaciones y utilizando un stack **100% gratuito** de alto rendimiento.

---

## 🏗️ Arquitectura del Sistema

El flujo de información se divide en dos procesos principales: **Ingesta de Documentos (Indexación)** y **Consulta & Generación (RAG)**.

```
                    ┌─────────────────────────────────────────────────────────┐
                    │            1. INGESTA DE DOCUMENTOS (PDF)               │
                    └─────────────────────────────────────────────────────────┘
                                                 │
  ┌──────────────┐      ┌─────────────────┐      │      ┌─────────────────────────┐      ┌────────────────────────┐
  │  Cliente     │ ───> │  Node.js API    │ ────┼───>  │ Google Gemini Embeddings│ ───> │ Supabase (pgvector)    │
  │  (Subir PDF) │      │  (Text Splitter)│      │      │ (text-embedding-004)    │      │ (Vector Storage)       │
  └──────────────┘      └─────────────────┘             └─────────────────────────┘      └────────────────────────┘

                                                 
                    ┌─────────────────────────────────────────────────────────┐
                    │            2. CONSULTA & GENERACIÓN EN STREAM           │
                    └─────────────────────────────────────────────────────────┘
                                                 │
  ┌──────────────┐      ┌─────────────────┐      │      ┌─────────────────────────┐
  │  Usuario     │ ───> │  Node.js API    │ ────┼───>  │  Vector Search          │
  │  (Pregunta)  │      │  (Embedding Q)  │      │      │  (Supabase RPC Match)   │
  └──────────────┘      └─────────────────┘             └────────────┬────────────┘
                                                             │ Contexto Relevante
                                                             ▼
  ┌──────────────┐                                      ┌─────────────────────────┐
  │  Respuesta   │ <─────────────────────────────────── │ Groq Cloud API          │
  │  Streaming   │    Server-Sent Events (SSE)          │ (gpt-oss-120b)          │
  └──────────────┘                                      └─────────────────────────┘
```

---

## 🛠️ Tech Stack & Herramientas Gratuitas

| Capa | Tecnología / Servicio | Plan / Uso |
| :--- | :--- | :--- |
| **Frontend** | React (Vite / Next.js) + Tailwind CSS | Hosting gratis en Vercel |
| **Backend** | Node.js (Express) | Hosting gratis en Render / Railway |
| **Vector Database** | Supabase (PostgreSQL + `pgvector`) | Free Tier (Hasta 500 MB) |
| **Embeddings Model** | Google Gemini (`gemini-embedding-001`, salida a 768 dims) | AI Studio API (Gratis) |
| **Inference LLM** | Groq Cloud (`openai/gpt-oss-120b`) | Groq Console (Gratis) |
| **Procesamiento PDF** | `pdf-parse` + LangChain Text Splitter | NPM Packages |

---

## 🗄️ Esquema de Base de Datos (Supabase)

Ejecuta el siguiente script en el **SQL Editor** de Supabase para activar la extensión vectorial y crear la estructura necesaria:

```sql
-- 1. Habilitar extensión de vectores
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Crear tabla de secciones de documentos
CREATE TABLE IF NOT EXISTS document_sections (
  id BIGSERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- Dimensiones de salida de gemini-embedding-001
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear índice IVFFlat para optimizar búsquedas por similitud
CREATE INDEX ON document_sections USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4. Función de búsqueda semántica RPC
CREATE OR REPLACE FUNCTION match_document_sections (
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id BIGINT,
  file_name TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    document_sections.id,
    document_sections.file_name,
    document_sections.content,
    1 - (document_sections.embedding <=> query_embedding) AS similarity
  FROM document_sections
  WHERE 1 - (document_sections.embedding <=> query_embedding) > match_threshold
  ORDER BY document_sections.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;
```

---

## 📁 Estructura del Proyecto (Monorepo / Separado)

```text
ai-customer-support/
├── client/                      # Frontend en React
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWindow.jsx   # UI del chat con soporte streaming
│   │   │   ├── PdfUploader.jsx  # Subida de documentos PDF
│   │   │   └── Header.jsx
│   │   ├── hooks/
│   │   │   └── useChatStream.js # Hook para consumir SSE
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
└── server/                      # Backend en Node.js Express
    ├── src/
    │   ├── config/
    │   │   ├── groq.js          # Cliente Groq Cloud SDK
    │   │   ├── gemini.js        # Cliente Gemini SDK (Embeddings)
    │   │   └── supabase.js      # Cliente Supabase SDK
    │   ├── services/
    │   │   ├── pdfService.js    # Ingesta, chunking y almacenamiento
    │   │   └── ragService.js    # Búsqueda vectorial y generación Llama
    │   ├── controllers/
    │   │   ├── documentController.js
    │   │   └── chatController.js
    │   └── index.js             # Express Server Setup
    ├── .env.example
    └── package.json
```

---

## 🚀 Configuración de Entorno (`.env`)

Crea un archivo `.env` en la carpeta `server/`:

```env
PORT=5000

# Groq Cloud Key (https://console.groq.com)
GROQ_API_KEY=tu_groq_api_key_aqui

# Google Gemini API Key (https://aistudio.google.com)
GEMINI_API_KEY=tu_gemini_api_key_aqui

# Supabase Credentials (https://supabase.com)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_supabase_service_role_key
```

---

## 🚦 Roadmap de Desarrollo

- [x] **Fase 1: Configuración de Infraestructura**
  - [x] Crear proyectos en Supabase, Groq Console y Google AI Studio.
  - [x] Ejecutar script de base de datos vectorial en Supabase.
- [x] **Fase 2: Pipeline de Ingesta (Backend)**
  - [x] Endpoint `/api/documents/upload` para recibir PDF (con flujo de duplicados: 409 + `replace=true`).
  - [x] Extracción de texto y chunking (`chunkSize: 500`, `chunkOverlap: 50`).
  - [x] Generación de embeddings con Gemini y guardado en Supabase.
- [x] **Fase 3: Pipeline RAG & Streaming (Backend)**
  - [x] Generar embedding de la consulta del usuario.
  - [x] Consulta RPC a Supabase para recuperar Top 3 chunks.
  - [x] Generación de respuesta con Groq vía Server-Sent Events (SSE), con memoria conversacional (10 mensajes) y rechazo honesto ante preguntas fuera de alcance.
- [ ] **Fase 4: Interfaz de Usuario (Frontend)**
  - [ ] Componente de carga de PDF con barra de progreso.
  - [ ] Componente de Chat con renderizado progresivo del texto.
- [ ] **Fase 5: Despliegue y Portafolio**
  - [ ] Desplegar Frontend en Vercel y Backend en Render.
  - [ ] Grabar video corto de demostración (GIF / Loom) para el `README.md` final.
