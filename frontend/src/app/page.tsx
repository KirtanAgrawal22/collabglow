"use client";
import{useState,useEffect} from 'react';
import{useRouter} from 'next/navigation';
import { CustomWhiteboard } from '@/components/CustomWhiteboard';
import { CodeEditor } from '@/components/CodeEditor';
import { isShareUrl } from '@/lib/shareUtils';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'editor' | 'whiteboard'>('editor');
  const [isSplitView, setIsSplitView] = useState(false);
  const router = useRouter();
  useEffect(() => {
    // Redirect to share page if URL is a share link
    if (isShareUrl()) {
      router.push(window.location.pathname);
    }
  }, [router]);
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CollabCode Canvas</h1>
            <p className="text-gray-400">Code + Custom Whiteboard</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSplitView(!isSplitView)}
              className={`px-4 py-2 rounded ${
                isSplitView ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              {isSplitView ? 'Single View' : 'Split View'}
            </button>
            
            <div className="flex bg-gray-700 rounded">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-4 py-2 rounded ${
                  activeTab === 'editor' ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                💻 Code Editor
              </button>
              <button
                onClick={() => setActiveTab('whiteboard')}
                className={`px-4 py-2 rounded ${
                  activeTab === 'whiteboard' ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                🎨 Whiteboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 h-[calc(100vh-80px)]">
        {isSplitView ? (
          // Split View - Proper 50/50 split
          <div className="flex h-full w-full">
            <div className="w-1/2 border-r border-gray-700">
              <CodeEditor />
            </div>
            <div className="w-1/2">
              <CustomWhiteboard />
            </div>
          </div>
        ) : (
          // Single View
          <div className="h-full w-full">
            {activeTab === 'editor' ? <CodeEditor /> : <CustomWhiteboard />}
          </div>
        )}
      </main>
    </div>
  );
}