'use client';

import{useState} from 'react';
import{useRouter} from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Home() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    const trimmedName = displayName.trim();
    const trimmedRoomId = roomIdInput.trim();

    if (!trimmedName) {
      setError('Please enter your name');
      return;
    }

    try {
      setSubmitting(true);
      // Persist the name for use inside rooms (e.g., attribution)
      if (typeof window !== 'undefined') {
        localStorage.setItem('displayName', trimmedName);
      }

      if (!trimmedRoomId) {
        // No room id provided → create a new room then navigate
        const res = await fetch(`${API_BASE_URL}/api/rooms`, { method: 'POST' });
        const data = await res.json();
        if (!data?.roomId) {
          setError('Failed to create a new room');
          return;
        }
        router.push(`/room/${data.roomId}`);
        return;
      }

      // Room id provided → validate then navigate
      const validateRes = await fetch(`${API_BASE_URL}/api/rooms/${trimmedRoomId}`);
      const validateData = await validateRes.json();
      if (!validateData?.valid) {
        setError('Invalid room ID. Create a new room or check the ID.');
        return;
      }
      router.push(`/room/${trimmedRoomId}`);
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h1 className="text-2xl font-bold mb-2">CollabCode Canvas</h1>
        <p className="text-gray-400 mb-6">Enter your name and optionally a room ID.</p>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-300">Your name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex"
              className="mt-1 w-full px-3 py-2 bg-gray-700 rounded outline-none"
              suppressHydrationWarning
            />
          </div>

          <div>
            <label className="text-sm text-gray-300">Room ID (optional)</label>
            <input
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              placeholder="Leave empty to create a new room"
              className="mt-1 w-full px-3 py-2 bg-gray-700 rounded outline-none"
              suppressHydrationWarning
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-60"
            suppressHydrationWarning
          >
            {submitting ? 'Please wait…' : 'Continue'}
          </button>
        </div>

        {error && <div className="mt-4 text-sm text-red-400">{error}</div>}

        <p className="mt-6 text-xs text-gray-500">If no room ID is provided, a new sharable room will be created.</p>
      </div>
    </div>
  );
}