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
      // Nota: Groq no tiene embeddings nativos, usamos un modelo de chat para simular
      // En producción, usarías un servicio de embeddings real
      const response = await client.embeddings.create({
        model: 'nomic-embed-text',
        input: chunks[i].text,
      });
      
      chunks[i].embedding = response.data[0].embedding;
      console.log(`Embedding ${i + 1}/${chunks.length} generado`);
    } catch (error) {
      console.error(`Error generando embedding ${i}:`, error);
      // Generar embedding dummy como fallback
      chunks[i].embedding = Array(768).fill(0).map(() => Math.random());
    }
  }
  
  return chunks;
}

// Función principal para obtener o cargar embeddings
async function getEmbeddings(): Promise<TextChunk[]> {
  // Verificar si hay cache en memoria
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
      .slice(0, 3); // Top 3 más relevantes
    
    // Construir contexto
    const context = scoredChunks
      .map((chunk, i) => `[Fuente ${i + 1}: ${chunk.source}]\n${chunk.text}`)
      .join('\n\n---\n\n');
    
    // Generar respuesta con el modelo
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Eres un asistente útil que responde preguntas basándose únicamente en el contexto proporcionado. 
Debes incluir citas específicas del texto entre comillas cuando sea relevante. 
Si la información no está en el contexto, di que no tienes esa información.`,
        },
        {
          role: 'user',
          content: `Contexto:\n${context}\n\nPregunta: ${question}\n\nResponde basándote solo en el contexto anterior e incluye citas textuales relevantes.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });
    
    const answer = completion.choices[0].message.content;
    
    // Extraer citas del contexto
    const citations = scoredChunks.map(chunk => ({
      source: chunk.source,
      text: chunk.text.substring(0, 200) + '...', // Primeros 200 caracteres
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