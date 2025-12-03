'use client';

import { useState, useEffect } from 'react';

export default function OllamaStatus() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [models, setModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const checkOllama = async () => {
    setStatus('checking');
    try {
      const response = await fetch('/api/ollama-status', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'connected') {
          setModels(data.models || []);
          setStatus('connected');
          setError(null);
        } else {
          setStatus('disconnected');
          setError(data.error || 'Unknown error from server');
        }
      } else {
        setStatus('disconnected');
        setError(`HTTP ${response.status}`);
      }
    } catch (err) {
      setStatus('disconnected');
      setError(err instanceof Error ? err.message : '연결 실패');
    }
  };

  useEffect(() => {
    checkOllama();
    const interval = setInterval(checkOllama, 30000); // 30초마다 체크

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'color-fg-success';
      case 'disconnected': return 'color-fg-danger';
      default: return 'color-fg-muted';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return '연결됨';
      case 'disconnected': return '연결 안 됨';
      default: return '확인 중...';
    }
  };

  return (
    <div className="Box mt-4 border">
      <div className="Box-header">
        <h3 className="Box-title">Ollama 상태</h3>
      </div>
      <div className="Box-body">
        <div className="d-flex flex-items-center mb-2">
          <span className="mr-2">상태:</span>
          <span className={`text-bold ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        {status === 'connected' && (
          <>
            <div className="mb-2">
              <strong>설치된 모델:</strong>
              {models.length > 0 ? (
                <ul className="list-style-none p-0 mt-2">
                  {models.map((model, idx) => (
                    <li key={idx} className="text-small color-fg-muted">
                      • {model}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-small color-fg-muted mt-1">모델이 없습니다.</p>
              )}
            </div>
            <div className="text-small color-fg-muted">
              AI 검증 기능이 활성화되어 있습니다.
            </div>
          </>
        )}

        {status === 'disconnected' && (
          <div className="color-fg-danger">
            <p className="mb-2">Ollama가 실행되지 않았거나 연결할 수 없습니다.</p>
            <details className="mb-2">
              <summary className="text-small cursor-pointer">자세히</summary>
              <div className="text-small mt-1">
                <p>오류: {error}</p>
                <p className="mt-2">해결 방법:</p>
                <ol className="pl-4">
                  <li>Ollama가 설치되어 있는지 확인</li>
                  <li>명령 프롬프트에서 <code>ollama serve</code> 실행</li>
                  <li>포트 11434가 방화벽에 열려있는지 확인</li>
                </ol>
              </div>
            </details>
            <div className="text-small color-fg-muted">
              AI 검증 없이 기본 전략만 실행됩니다.
            </div>
            <button
              className="btn btn-sm mt-2"
              onClick={checkOllama}
            >
              재시도
            </button>
          </div>
        )}

        {status === 'checking' && (
          <div className="color-fg-muted">
            Ollama 연결 확인 중...
          </div>
        )}
      </div>
    </div>
  );
}
