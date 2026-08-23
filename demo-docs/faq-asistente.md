# Preguntas frecuentes sobre este asistente

Este documento describe, en formato de preguntas y respuestas, cómo funciona el asistente de soporte que estás probando. Está dirigido a personas técnicas curiosas, reclutadores y a cualquiera que quiera entender qué hay detrás de cada respuesta.

## ¿Qué es este asistente y qué hace?

Es un sistema de soporte al cliente basado en **RAG** (Retrieval-Augmented Generation, generación aumentada por recuperación). Los usuarios suben documentos PDF con conocimiento — manuales, guías, preguntas frecuentes — y luego conversan por chat. El sistema recupera los fragmentos relevantes de esos documentos y un modelo de lenguaje redacta respuestas **ancladas únicamente a ese contenido**, entregadas en tiempo real mediante streaming.

## ¿Qué significa exactamente RAG?

Retrieval-Augmented Generation combina dos etapas: primero **recuperar** (buscar en una base vectorial los pasajes más similares a la pregunta) y después **generar** (pedirle al modelo que responda usando solo esos pasajes como contexto). La ventaja frente a usar el modelo "de memoria" es doble: las respuestas citan conocimiento real de tus documentos y el sistema puede decir honestamente "no lo sé" cuando la información no está.

## ¿Cómo se procesa un PDF desde que lo subo?

Al subir un archivo, el servidor extrae su texto con la biblioteca `pdf-parse` versión 2, divide el contenido en fragmentos de aproximadamente 500 caracteres con solapamiento de 50 para no cortar ideas a mitad de frase, y convierte cada fragmento en un **vector de embedding**. Los lotes de embeddings se calculan de hasta 100 fragmentos por llamada y las inserciones a base de datos van de hasta 200 filas por lote. Si subes un archivo con el mismo nombre dos veces, el sistema te avisa y puedes reemplazarlo confirmando con `?replace=true`.

## ¿Qué son los embeddings y qué modelo se usa?

Un embedding es una representación numérica del significado de un texto: textos con sentido parecido producen vectores cercanos entre sí. Este proyecto usa **gemini-embedding-001** de Google, configurado con 768 dimensiones de salida. Es importante distinguir los dos modos: los documentos se indexan con tipo de tarea `RETRIEVAL_DOCUMENT` y las preguntas del usuario se convierten con `RETRIEVAL_QUERY`, porque cada modo optimiza el vector para comparaciones distintas.

Los nombres de modelos nunca están escritos dentro del código fuente: viven en variables de entorno (`EMBEDDING_MODEL` y `LLM_MODEL`), porque los proveedores retiran y agregan catálogos con frecuencia. Cambiar de modelo requiere editar `.env`, nada más.

## ¿Dónde se guardan mis documentos y sus vectores?

En **Supabase**, específicamente en PostgreSQL con la extensión **pgvector**. Cada fila de la tabla `document_sections` guarda el texto del fragmento, su vector de 768 dimensiones, el nombre del archivo origen, el identificador de sesión propietaria y marcas de tiempo. Hay índices HNSW para acelerar la búsqueda por similitud coseno incluso con miles de fragmentos.

## ¿Cómo encuentra el asistente los fragmentos correctos?

Cuando haces una pregunta, el backend genera su embedding y ejecuta una función RPC llamada `match_document_sections` directamente dentro de PostgreSQL. Esta función calcula la distancia coseno entre tu pregunta y todos los candidatos, devuelve los **3 mejores fragmentos** cuyo puntaje supere un umbral mínimo de similitud, y mezcla resultados de dos fuentes: los documentos globales de demostración y los tuyos privados de sesión.

## ¿Qué modelo redacta las respuestas y cómo llegan tan rápido?

La generación corre en **Groq Cloud** usando `openai/gpt-oss-120b`, un modelo abierto optimizado para latencia ultrabaja. Las respuestas llegan por **SSE (Server-Sent Events)**: el servidor emite eventos `meta`, `delta` y `done`, y la interfaz pinta el texto palabra a palabra mientras se genera. Se eligió SSE en lugar de WebSockets porque el flujo es unidireccional (servidor → cliente), más simple de implementar, con reconexión nativa del navegador y sin infraestructura adicional.

## ¿Cómo evita inventar respuestas?

El prompt del sistema prohíbe explícitamente usar conocimiento externo: el modelo debe responder exclusivamente con los fragmentos recuperados. Si la búsqueda no encuentra pasajes con suficiente similitud, el asistente responde que no tiene información sobre el tema en los documentos cargados y sugiere reformular o subir material relevante. Prefiere admitir ignorancia antes que fabricar datos.

## ¿El chat recuerda la conversación anterior?

Sí, dentro de límites. Cada conversación guarda sus mensajes en Supabase y al responder se incluyen los **últimos 10 mensajes** como historial contextual. Por eso puedes preguntar "¿y cuánto dura eso?" refiriéndote a algo mencionado antes. Al pulsar "Nuevo chat" se inicia una conversación limpia sin arrastrar contexto.

## ¿Qué es una sesión anónima y por qué existe?

Para permitir probar la demo sin registro, cada visitante genera un token aleatorio criptográfico que viaja en el header `X-Session-Token` de cada petición. Ese token identifica "tu espacio": tus documentos, tus conversaciones y tus contadores de uso. Nadie más puede verlos. Las sesiones inactivas durante **1 hora se purgan automáticamente** junto con todo su contenido, en barridos que ocurren al arrancar el servidor y cada 30 minutos. No hay cuentas ni correos: si pierdes el token, empiezas de cero.

## ¿Qué medidas anti-abuso incorpora?

Cuatro límites aplicados en el middleware: máximo de **5 documentos y 300 chunks por sesión**, **15 mensajes por sesión al día** y **50 subidas diarias en todo el sistema**. Cuando alcanzas un límite recibes un HTTP 429 con mensaje claro en español y el tiempo de espera sugerido. Además, toda entrada se valida: tipos MIME de archivos, tamaños máximos de 10 MB, formatos de token y longitudes de mensajes.

## ¿Qué son los documentos globales de demostración?

Son PDFs marcados como públicos (sin sesión asociada) que todos los visitantes pueden consultar, ideales para probar la demo sin subir nada propio. Solo pueden crearlos o borrarlos operaciones autenticadas con el header `X-Admin-Token`. En esta instancia están cargados el manual ficticio de la cafetera AromaX Pro 200 y este mismo documento de preguntas frecuentes.

## ¿Cuál es el stack completo del proyecto?

Backend: **Node.js + Express 5 + TypeScript estricto** (con `noUncheckedIndexedAccess`), organizado en capas services → controllers → routes. Frontend: **React + Vite + TypeScript + Tailwind CSS v4**, con hooks personalizados para streaming SSE y gestión de documentos. Datos: **Supabase** con pgvector y funciones RPC. IA: embeddings de **Google Gemini** y generación en streaming con **Groq**. Todo el copy de interfaz y errores está en español.

## ¿Puedo montar mi propia copia?

Sí. El repositorio incluye un README con instrucciones humanas y un archivo `AGENTS.md` pensado para agentes de IA de código: basta pedirle a tu agente favorito que lea ese archivo y te guiará por la configuración de Supabase, claves API y arranque local. El script `npm run verify` comprueba en segundos que los tres servicios externos responden correctamente.
