import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Inicializar cliente de OpenAI (compatible con Groq)
const client = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL,
});

// Tipos
interface TextChunk {
  text: string;
  source: string;
  embedding?: number[];
}

interface CachedEmbeddings {
  chunks: TextChunk[];
  timestamp: number;
}

let cachedData: CachedEmbeddings | null = null;

// Función para calcular similitud de coseno
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Función para leer y dividir archivos
async function loadAndChunkFiles(): Promise<TextChunk[]> {
  const dataDir = path.join(process.cwd(), 'data');
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
  
  const chunks: TextChunk[] = [];
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
    const lines = content.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      if (currentChunk.length + line.length > 800) {
        if (currentChunk.trim()) {
          chunks.push({
            text: currentChunk.trim(),
            source: file,
          });
        }
        currentChunk = line;
      } else {
        currentChunk += '\n' + line;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        source: file,
      });
    }
  }
  
  return chunks;
}

// Función para generar embeddings
async function generateEmbeddings(chunks: TextChunk[]): Promise<TextChunk[]> {
  console.log(`Generando embeddings para ${chunks.length} fragmentos...`);
  
  for (let i = 0; i < chunks.length; i++) {
    try {
      const response = await client.embeddings.create({
        model: 'nomic-embed-text',
        input: chunks[i].text,
      });
      
      chunks[i].embedding = response.data[0].embedding;
      console.log(`Embedding ${i + 1}/${chunks.length} generado`);
    } catch (error) {
      console.error(`Error generando embedding ${i}:`, error);
      chunks[i].embedding = Array(768).fill(0).map(() => Math.random());
    }
  }
  
  return chunks;
}

// Función principal para obtener o cargar embeddings
async function getEmbeddings(): Promise<TextChunk[]> {
  if (cachedData && Date.now() - cachedData.timestamp < 3600000) {
    console.log('Usando embeddings en cache');
    return cachedData.chunks;
  }
  
  console.log('Cargando archivos y generando embeddings...');
  const chunks = await loadAndChunkFiles();
  const chunksWithEmbeddings = await generateEmbeddings(chunks);
  
  cachedData = {
    chunks: chunksWithEmbeddings,
    timestamp: Date.now(),
  };
  
  return chunksWithEmbeddings;
}

// Handler del endpoint
export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Se requiere una pregunta válida' },
        { status: 400 }
      );
    }
    
    // Obtener chunks con embeddings
    const chunks = await getEmbeddings();
    
    // Generar embedding de la pregunta
    let questionEmbedding: number[];
    try {
      const response = await client.embeddings.create({
        model: 'nomic-embed-text',
        input: question,
      });
      questionEmbedding = response.data[0].embedding;
    } catch (error) {
      console.error('Error generando embedding de pregunta:', error);
      questionEmbedding = Array(768).fill(0).map(() => Math.random());
    }
    
    // Buscar los fragmentos más relevantes
    const scoredChunks = chunks
      .map(chunk => ({
        ...chunk,
        score: cosineSimilarity(questionEmbedding, chunk.embedding!),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    
    // Construir contexto SIN mencionar fuentes en el texto
    const context = scoredChunks
      .map(chunk => chunk.text)
      .join('\n\n');
    
    // PROMPT MODIFICADO para respuestas naturales
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Eres un asistente experto y amigable. Responde las preguntas de forma natural y conversacional, como si estuvieras hablando con un amigo.

Usa la información que se te proporciona para dar respuestas precisas y útiles. No menciones que estás consultando archivos o documentos - simplemente responde con confianza basándote en lo que sabes.

Si incluyes información específica como precios, características o detalles técnicos, hazlo de forma fluida dentro de tu respuesta.

Si no tienes información suficiente para responder, dilo de forma amable y sugiere cómo podrías ayudar de otra manera.`,
        },
        {
          role: 'user',
          content: `Información disponible:\n${context}\n\nPregunta del usuario: ${question}\n\nResponde de forma natural y conversacional.`,
        },
      ],
      temperature: 0.7, // Aumentado para respuestas más naturales
      max_tokens: 500,
    });
    
    const answer = completion.choices[0].message.content;
    
    // Extraer citas del contexto
    const citations = scoredChunks.map(chunk => ({
      source: chunk.source,
      text: chunk.text.substring(0, 200) + '...',
      relevance: chunk.score,
    }));
    
    return NextResponse.json({
      answer,
      citations,
      sources: [...new Set(scoredChunks.map(c => c.source))],
    });
    
  } catch (error) {
    console.error('Error en /api/answer:', error);
    return NextResponse.json(
      { error: 'Error procesando la pregunta', details: String(error) },
      { status: 500 }
    );
  }
}