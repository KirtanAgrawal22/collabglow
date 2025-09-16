"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { CodeEditor } from '@/components/CodeEditor';
import { CustomWhiteboard } from '@/components/CustomWhiteboard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const [valid, setValid] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'whiteboard'>('editor');
  const [splitView, setSplitView] = useState(false);
  const [participants, setParticipants] = useState<{ id: string; name: string }[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const displayNameRef = useRef<string>('');
  const initialStateRef = useRef<{ code?: string; language?: string; whiteboard?: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      displayNameRef.current = localStorage.getItem('displayName') || '';
    }
  }, []);

  // validate room id
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`);
        const data = await res.json();
        if (!cancelled) setValid(Boolean(data.valid));
      } catch {
        if (!cancelled) setValid(false);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  // connect socket
  useEffect(() => {
    if (!roomId || valid !== true) return;
    const socket = io(API_BASE_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join_room', { roomId });
    if (displayNameRef.current) {
      socket.emit('set_name', { name: displayNameRef.current });
    }
    socket.on('room_state', (state: { code?: string; language?: string; whiteboard?: string }) => {
      initialStateRef.current = state || null;
    });
    socket.on('participants_update', (list: { id: string; name: string }[]) => {
      setParticipants(list);
    });
    socket.on('room_error', () => {
      setValid(false);
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, valid]);

  if (valid === null) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Validating room...</div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 w-full max-w-md text-center">
          <h2 className="text-xl font-semibold mb-2">Invalid room ID</h2>
          <p className="text-gray-400 mb-4">Please create a new room or check the ID.</p>
          <div className="flex gap-3 justify-center">
            <button className="px-4 py-2 bg-blue-600 rounded" onClick={() => router.push('/')}>Go to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Room {roomId}</h1>
            <p className="text-gray-400">Collaborate in real-time</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(String(roomId)); }}
              className="px-3 py-2 bg-gray-700 rounded border border-gray-600 text-sm hover:bg-gray-600"
            >Copy Room ID</button>
            <button
              onClick={() => setSplitView((v) => !v)}
              className="px-3 py-2 bg-gray-700 rounded border border-gray-600 text-sm hover:bg-gray-600"
            >{splitView ? 'Single View' : 'Split View'}</button>
            <div className="flex bg-gray-700 rounded">
              <button onClick={() => setActiveTab('editor')} className={`px-4 py-2 rounded ${activeTab === 'editor' ? 'bg-blue-600' : 'bg-gray-700'}`}>💻 Code Editor</button>
              <button onClick={() => setActiveTab('whiteboard')} className={`px-4 py-2 rounded ${activeTab === 'whiteboard' ? 'bg-blue-600' : 'bg-gray-700'}`}>🎨 Whiteboard</button>
            </div>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-80px)] flex">
        <aside className="w-56 bg-gray-800 border-r border-gray-700 p-3 hidden md:block">
          <div className="text-sm font-semibold mb-2">Participants</div>
          <ul className="space-y-1 text-sm text-gray-300">
            {participants.map((p) => (
              <li key={p.id} className="truncate">• {p.name || 'Anonymous'}</li>
            ))}
          </ul>
        </aside>
        {splitView ? (
          <div className="flex-1 grid grid-cols-2">
            <div className="border-r border-gray-700">
              <CodeEditor roomId={roomId} socket={socketRef} initialCode={initialStateRef.current?.code} initialLanguage={initialStateRef.current?.language} />
            </div>
            <div>
              <CustomWhiteboard roomId={roomId} socket={socketRef} initialImage={initialStateRef.current?.whiteboard} />
            </div>
          </div>
        ) : (
          <div className="flex-1 relative">
            <div className={activeTab === 'editor' ? 'absolute inset-0' : 'hidden'}>
              <CodeEditor roomId={roomId} socket={socketRef} initialCode={initialStateRef.current?.code} initialLanguage={initialStateRef.current?.language} />
            </div>
            <div className={activeTab === 'whiteboard' ? 'absolute inset-0' : 'hidden'}>
              <CustomWhiteboard roomId={roomId} socket={socketRef} initialImage={initialStateRef.current?.whiteboard} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}



