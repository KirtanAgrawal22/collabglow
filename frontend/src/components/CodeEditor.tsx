"use client";

import { useState, useEffect, MutableRefObject, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import { Play, Loader2 } from 'lucide-react';
import { ShareButton } from './ShareButton';

interface ExecutionResult {
  output: string;
  status: string;
  time: string;
  memory: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CodeEditorProps {
  roomId?: string;
  socket?: MutableRefObject<Socket | null>;
  initialCode?: string;
  initialLanguage?: string;
}

export const CodeEditor = ({ roomId, socket, initialCode, initialLanguage }: CodeEditorProps) => {
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState('python');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [stdin, setStdin] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const isRemoteUpdate = useRef(false);

  // Load persisted state
  useEffect(() => {
    if (!roomId) return;
    if (typeof initialCode === 'string' || typeof initialLanguage === 'string') {
      if (typeof initialLanguage === 'string') setLanguage(initialLanguage);
      if (typeof initialCode === 'string') setCode(initialCode);
      return;
    }
    try {
      const saved = localStorage.getItem(`code:${roomId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.code === 'string') setCode(parsed.code);
        if (typeof parsed.language === 'string') setLanguage(parsed.language);
      }
    } catch {}
  }, [roomId, initialCode, initialLanguage]);

  // Persist state
  useEffect(() => {
    if (!roomId) return;
    try {
      localStorage.setItem(`code:${roomId}`, JSON.stringify({ code, language }));
    } catch {}
  }, [roomId, code, language]);

  const handleRunCode = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language,
          stdin
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        output: `Connection error: ${error}`,
        status: 'Error',
        time: '0.00s',
        memory: '0KB'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    setResult(null);
  };

  // Socket: outbound updates
  useEffect(() => {
    if (!roomId || !socket?.current) return;
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    socket.current.emit('code_change', { roomId, code, language });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, language]);

  // Socket: inbound updates
  useEffect(() => {
    if (!socket?.current) return;
    const s = socket.current;
    const handler = ({ code: newCode, language: newLang }: { code: string; language: string }) => {
      isRemoteUpdate.current = true;
      if (newLang && newLang !== language) setLanguage(newLang);
      if (typeof newCode === 'string' && newCode !== code) setCode(newCode);
    };
    s.on('code_update', handler);
    return () => { s.off('code_update', handler); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket?.current, language, code]);

  return (
    <div className="h-full flex flex-col bg-gray-800">
      <div className="p-3 bg-gray-700 flex items-center gap-3 flex-wrap">
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
        >
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
          <option value="c">C</option>
        </select>

        <button
          onClick={handleRunCode}
          disabled={isRunning}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm flex items-center gap-1 disabled:bg-gray-600"
        >
          {isRunning ? <Loader2 className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4" />}
          Run
        </button>
        
        <ShareButton 
          code={code} 
          language={language} 
          onShare={(url) => setShareUrl(url)}
        />

        <span className="text-sm text-gray-300">
          Language: {language.toUpperCase()}
        </span>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || '')}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: 'on',
              automaticLayout: true,
              padding: { top: 16, bottom: 16 },
            }}
          />
        </div>

        <div className="h-48 border-t border-gray-600">
          <div className="p-2 bg-gray-700 border-b border-gray-600 flex items-center justify-between">
            <span className="text-sm font-medium">Output</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Input:</span>
              <input
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="stdin"
                className="px-2 py-1 bg-gray-600 text-white rounded text-xs w-32"
              />
            </div>
          </div>
          <div className="p-3 bg-gray-800 h-40 overflow-auto">
            <pre className="text-green-400 text-sm whitespace-pre-wrap font-mono">
              {result?.output || 'Click "Run" to see output...'}
            </pre>
            {result && (
              <div className="mt-2 text-xs text-gray-400 flex gap-3">
                <span>Status: {result.status}</span>
                <span>Time: {result.time}</span>
                <span>Memory: {result.memory}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};