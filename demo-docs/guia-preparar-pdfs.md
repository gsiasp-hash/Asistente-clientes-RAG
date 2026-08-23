# Guía para preparar tus PDFs — consigue mejores respuestas del asistente

Este asistente no lee documentos "como una persona": divide cada PDF en fragmentos de texto de aproximadamente 500 caracteres y busca los 3 más relevantes para responder cada pregunta. Eso significa que **la calidad de las respuestas depende directamente de cómo está escrito tu documento**. Esta guía reúne las prácticas recomendadas para que el chat entienda y cite bien tu material.

## 1. Usa PDFs con texto real, no escaneados

El extractor lee texto digital. Un PDF escaneado (fotos de páginas) o hecho solo con imágenes **no produce ningún fragmento** y quedará como documento vacío.

- ❌ Escaneo de un manual impreso guardado como imágenes
- ✅ PDF exportado desde Word, Google Docs, Notion o cualquier editor de texto

**Prueba rápida**: abre tu PDF e intenta seleccionar y copiar un párrafo con el mouse. Si puedes copiarlo, el asistente podrá leerlo.

## 2. Escribe párrafos que se expliquen solos

Cada fragmento viaja al modelo sin el resto del documento. Si un párrafo dice *"esta cubre dos años"* sin decir qué es "esta", ese fragmento suelto no sirve para responder.

- ❌ "Esta cobertura incluye repuestos. Vence si no se hace el mantenimiento."
- ✅ "La garantía de la AromaX Pro 200 cubre repuestos y mano de obra por 24 meses desde la compra. Vence si el equipo no recibió la descalcificación programada."

Regla práctica: asume que cada párrafo puede ser leído fuera de contexto, porque literalmente lo será.

## 3. Nombra las cosas con su nombre completo

Los pronombres y abreviaturas locales del documento confunden a los fragmentos aislados. Repite el nombre completo del producto, proceso o concepto dentro del mismo párrafo donde lo explicas.

- ❌ "El filtro debe cambiarse cada 60 días." (¿qué filtro? ¿de qué máquina?)
- ✅ "El filtro de agua carbónico de la AromaX Pro 200 debe cambiarse cada 60 días."

## 4. Pon los datos clave en prosa, no solo en tablas

Las tablas complejas pierden su estructura al extraer texto: las columnas pueden mezclarse en líneas incomprensibles. Si un dato es importante, dilo también en una oración.

```text
❌ Solo tabla:   | E04 | Sarro | Descalcificar |

✅ Tabla + prosa:
   Tabla de errores (ver abajo).
   El error E04 indica sarro acumulado en los circuitos; la solución
   es ejecutar un ciclo de descalcificación completo.
```

## 5. Un documento = un tema

Mezclar varios productos, políticas o temas en un mismo PDF diluye la recuperación: los fragmentos compiten entre sí y bajan la precisión. Separa el manual de la cafetera del manual del horno, aunque sean de la misma marca.

## 6. Concreta números, fechas y pasos

El modelo responde con la precisión que le entregues. Los datos vagos producen respuestas vagas; los datos exactos producen respuestas citables.

- ❌ "Limpia la máquina regularmente."
- ✅ "Realiza la limpieza del grupo de extracción una vez al mes con pastilla de limpieza de grasas."

Para procedimientos, usa pasos numerados: sobreviven bien a la división en fragmentos y el chat los reproduce en orden.

## 7. Cuida el nombre del archivo

El nombre aparece en la lista de documentos y acompaña internamente al contexto de búsqueda. `manual-aromax-pro200.pdf` ayuda mucho más que `doc-final-v3.pdf` o `scan_0023.pdf`.

## 8. Evita layouts decorativos

Columnas dobles, cuadros flotantes, texto dentro de gráficos y pies de página repetidos se extraen desordenados o contaminan fragmentos vecinos. Un documento de una columna, con encabezados claros y párrafos seguidos, es el ideal.

## 9. Respeta los límites técnicos

| Límite | Valor |
| :--- | :--- |
| Tamaño máximo por archivo | 10 MB |
| Documentos por sesión | 5 |
| Fragmentos totales por sesión | ~300 (equivale a unas 40–60 páginas según densidad) |

Si tu material excede los límites, prioriza: sube primero las secciones que responden las preguntas más frecuentes de tus usuarios.

## 10. Termina con preguntas frecuentes

Una sección final de FAQ genera fragmentos que responden directo a preguntas naturales ("¿cuánto dura la garantía?", "¿cada cuánto descalcifico?"). Es la forma más barata de mejorar las respuestas: escribes la pregunta tal como la haría un usuario y la respuesta completa justo debajo.

## Checklist antes de subir

- [ ] Puedo copiar y pegar texto desde el PDF (no es escaneado)
- [ ] Cada párrafo tiene sentido leído solo, sin depender del anterior
- [ ] Los nombres de producto/proceso aparecen completos en cada explicación
- [ ] Los datos clave de tablas están también escritos en oraciones
- [ ] El documento trata un solo tema
- [ ] Hay números, plazos y pasos concretos, no instrucciones vagas
- [ ] El nombre del archivo describe su contenido
- [ ] Sin columnas dobles ni texto atrapado en imágenes
