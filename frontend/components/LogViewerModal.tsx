import React, { useState, useEffect } from 'react';
import * as loggingService from '../services/loggingService';
import type { ChatLog } from '../services/loggingService';

interface LogViewerModalProps {
  onClose: () => void;
}

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);


const LogViewerModal: React.FC<LogViewerModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<ChatLog[]>([]);

  useEffect(() => {
    loggingService.getLogs().then(fetchedLogs => {
      setLogs(fetchedLogs); // Backend already returns them in some order, but we might want to ensure reverse chron
    });
  }, []);

  const handleClearLogs = async () => {
    if (window.confirm('Are you sure you want to delete all chat logs? This cannot be undone.')) {
      await loggingService.clearLogs();
      setLogs([]);
    }
  };

  const handleExportLogs = () => {
    if (logs.length === 0) {
      alert("There are no logs to export.");
      return;
    }

    // Reverse again to export in chronological order
    const formattedLogs = logs.slice().reverse().map(log => {
      const header = `Chat Session with: ${log.chatbotTitle}\nTimestamp: ${new Date(log.timestamp).toLocaleString()}\n---------------------------------------\n`;
      const conversation = log.messages.map(msg => {
        const prefix = msg.sender === 'user' ? 'You:' : 'Bot:';
        const content = msg.text || (msg.imageUrl ? '[Generated Image]' : '[Empty Message]');
        const sources = msg.sources && msg.sources.length > 0 ? `\n  [Sources: ${msg.sources.join(', ')}]` : '';
        return `${prefix} ${content}${sources}`;
      }).join('\n');
      return header + conversation + '\n\n=======================================\n\n';
    }).join('');

    const blob = new Blob([formattedLogs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mri-chat-logs.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] max-h-[800px] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-indigo-700">Chat Log Viewer</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleExportLogs}
              className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-600 transition-colors"
            >
              Export Logs
            </button>
            <button
              onClick={handleClearLogs}
              className="bg-red-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-600 transition-colors"
            >
              Clear All Logs
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors">
              <CloseIcon />
            </button>
          </div>
        </header>
        <div className="flex-grow overflow-y-auto bg-gray-50 p-4 space-y-4">
          {logs.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              <p>No chat sessions have been logged yet.</p>
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
                <div className="flex justify-between items-center mb-2 pb-2 border-b">
                  <h3 className="font-bold text-gray-800">{log.chatbotTitle}</h3>
                  <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {log.messages.map((msg, index) => (
                    <div key={index} className={`flex text-sm ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`rounded-lg py-1 px-3 max-w-md ${msg.sender === 'user'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-gray-100 text-gray-800'
                        }`}>
                        <p className="whitespace-pre-wrap">{msg.text || '[Image]'}</p>
                        {msg.sources && msg.sources.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1 border-t pt-1">Sources: {msg.sources.join(', ')}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LogViewerModal;