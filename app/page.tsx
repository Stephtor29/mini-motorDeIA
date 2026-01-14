'use client';

import { useState } from 'react';

interface Citation {
  source: string;
  text: string;
  relevance: number;
}

interface ApiResponse {
  answer: string;
  citations: Citation[];
  sources: string[];
}

export default function Home() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      setError('Por favor escribe una pregunta');
      return;
    }

    setLoading(true);
    setError('');
    setResponse(null);

    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        throw new Error('Error al obtener respuesta');
      }

      const data: ApiResponse = await res.json();
      setResponse(data);
    } catch (err) {
      setError('Ocurrió un error. Por favor intenta de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-3">
            🤖 Mini Motor de IA
          </h1>
          <p className="text-gray-600 text-lg">
            Pregunta cualquier cosa sobre nuestros productos y políticas
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
                Tu pregunta:
              </label>
              <textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ejemplo: ¿Cuál es el precio del iPhone 15 Pro Max?"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={3}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Buscando respuesta...
                </span>
              ) : (
                '🔍 Buscar Respuesta'
              )}
            </button>
          </form>

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">❌ {error}</p>
            </div>
          )}
        </div>

        {/* Respuesta */}
        {response && (
          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            {/* Respuesta principal */}
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">💬 Respuesta:</h2>
              <div className="prose max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {response.answer}
                </p>
              </div>
            </div>

            {/* Fuentes */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">📚 Fuentes consultadas:</h3>
              <div className="flex flex-wrap gap-2">
                {response.sources.map((source, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>

            {/* Citas */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">📝 Fragmentos relevantes:</h3>
              <div className="space-y-3">
                {response.citations.map((citation, i) => (
                  <div
                    key={i}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-semibold text-indigo-600 uppercase">
                        {citation.source}
                      </span>
                      <span className="text-xs text-gray-500">
                        Relevancia: {(citation.relevance * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 italic">
                      "{citation.text}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 text-sm">
          <p>🚀 Mini Motor de IA con Next.js + Groq + Embeddings</p>
        </div>
      </div>
    </div>
  );
}