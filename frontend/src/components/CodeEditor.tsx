"use client";

import { useState, useEffect } from 'react';
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

const defaultCode: { [key: string]: string } = {
  python: `# Welcome to CollabCode Canvas!
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print("Fibonacci sequence:")
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")`,

  javascript: `// Welcome to CollabCode Canvas!
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("Fibonacci sequence:");
for (let i = 0; i < 10; i++) {
    console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}`,

  cpp: `// Welcome to CollabCode Canvas!
#include <iostream>
using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    cout << "Fibonacci sequence:" << endl;
    for (int i = 0; i < 10; i++) {
        cout << "F(" << i << ") = " << fibonacci(i) << endl;
    }
    return 0;
}`,

  java: `// Welcome to CollabCode Canvas!
public class Main {
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }

    public static void main(String[] args) {
        System.out.println("Fibonacci sequence:");
        for (int i = 0; i < 10; i++) {
            System.out.println("F(" + i + ") = " + fibonacci(i));
        }
    }
}`,

  c: `// Welcome to CollabCode Canvas!
#include <stdio.h>

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    printf("Fibonacci sequence:\\n");
    for (int i = 0; i < 10; i++) {
        printf("F(%d) = %d\\n", i, fibonacci(i));
    }
    return 0;
}`
};

export const CodeEditor = () => {
  const [code, setCode] = useState<string>(defaultCode.python);
  const [language, setLanguage] = useState('python');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [stdin, setStdin] = useState('');
  const [shareUrl, setShareUrl] = useState('');

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
    setCode(defaultCode[newLanguage] || `// Write your ${newLanguage} code here`);
    setResult(null);
  };

  return (
    <div className="h-full flex flex-col bg-gray-800">
      {/* Toolbar */}
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
        {/* Editor */}
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

        {/* Output Panel */}
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