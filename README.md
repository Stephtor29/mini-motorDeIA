------------------  Mini Motor de IA

Un sistema sencillo que responde preguntas basándose en archivos de texto locales.

------------------¿Qué hace esto?

Lee archivos .txt de la carpeta `/data`, los divide en pedazos, genera embeddings y responde preguntas usando IA.

------------------ Cómo correrlo

1. Clona el repo:
git clone https://github.com/Stephtor29/mini-motorDeIA.git
cd mini-motorDeIA/ai-backend-project

2. Instala las dependencias:
npm install


3. Creamos un archivo `.env.local` con tu API key de Groq:

AI_API_KEY=tu_key_aqui
AI_BASE_URL=https://api.groq.com/openai/v1


4. Correr el proyecto:
npm run dev

Abre http://localhost:3000

------------------ Variables de entorno necesarias

- `AI_API_KEY` - (gratis en console.groq.com)
- `AI_BASE_URL` - La URL de la API de Groq

------------------Deploy

El proyecto está deployado en Vercel: [URL cuando lo subas]

------------------ Tecnologías

- Next.js 15
- TypeScript
- Groq (para embeddings y chat)
- Tailwind CSS

------------------Estructura

/data           - Archivos de conocimiento (.txt)
/app/api/answer - Endpoint que procesa las preguntas
/app/page.tsx   - La interfaz


------------------Cómo funciona

1. Lee los archivos de `/data`
2. Los divide en chunks de ~800 caracteres
3. Genera embeddings con Groq
4. Cuando haces una pregunta, busca los chunks más relevantes
5. Le pasa esos chunks a Llama 3.3 para que responda
6. Te muestra la respuesta con las citas

Eso es todo.