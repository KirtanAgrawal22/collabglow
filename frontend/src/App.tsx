import { CodeEditor } from './components/CodeEditor';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900">
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-white">Code Editor</h1>
        <p className="text-gray-400">Run code in multiple languages</p>
      </header>
      <main>
        <CodeEditor />
      </main>
    </div>
  );
}