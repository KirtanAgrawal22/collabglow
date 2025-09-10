"use client";

import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { generateShareUrl } from '@/lib/shareUtils';

interface ShareButtonProps {
  code: string;
  language: string;
  drawingData?: any;
  onShare?: (url: string) => void;
}

export const ShareButton = ({ code, language, drawingData, onShare }: ShareButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleShare = () => {
    const shareData = {
      code,
      language,
      drawing: drawingData,
      timestamp: Date.now(),
      version: '1.0'
    };

    const shareUrl = generateShareUrl(shareData);
    
    if (navigator.share) {
      // Use native share API if available
      navigator.share({
        title: 'Check out my code and drawing!',
        text: 'I created this using CollabCode Canvas',
        url: shareUrl,
      }).catch(console.error);
    } else {
      // Fallback to copy to clipboard
      setIsOpen(true);
      if (onShare) {
        onShare(shareUrl);
      }
    }
  };

  const handleCopy = () => {
    const shareData = {
      code,
      language,
      drawing: drawingData,
      timestamp: Date.now(),
      version: '1.0'
    };

    const shareUrl = generateShareUrl(shareData);
    if (onShare) {
      onShare(shareUrl);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
      >
        <Share2 size={16} />
        Share
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 min-w-80">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Share Link</h3>
          <p className="text-xs text-gray-600 mb-3">
            Copy this link to share your code and drawing:
          </p>
          
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={generateShareUrl({ code, language, drawing: drawingData })}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded bg-gray-50"
            />
            <CopyToClipboard
              text={generateShareUrl({ code, language, drawing: drawingData })}
              onCopy={handleCopy}
            >
              <button className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors">
                {isCopied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </CopyToClipboard>
          </div>
          
          <button
            onClick={() => setIsOpen(false)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};