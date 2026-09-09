import React, { useState, useEffect, useCallback } from 'react';
import * as loggingService from '../services/loggingService';
import { LogAccessError, type ChatLog } from '../services/loggingService';

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
  // The admin token is never bundled - it is pasted here and kept only in
  // sessionStorage (cleared when the tab closes). This viewer is a convenience;
  // the CLI (backend/view_logs.py) is the primary way to read logs in prod.
  const [token, setToken] = useState(loggingService.getAdminToken());
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError('');
    try {
      const fetched = await loggingService.getLogs(t);
      loggingService.setAdminToken(t);
      setLogs(fetched);
      setAuthed(true);
    } catch (e) {
      setAuthed(false);
      setError(e instanceof LogAccessError ? e.message : 'Could not reach the log endpoint.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) load(token);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearLogs = async () => {
    if (!window.confirm('Delete ALL stored chat transcripts? This cannot be undone.')) return;
    try {
      await loggingService.clearLogs(token);
      setLogs([]);
    } catch (e) {
      setError(e instanceof LogAccessError ? e.message : 'Failed to clear logs.');
    }
  };

  const handleExportLogs = () => {
    if (logs.length === 0) { alert('There are no logs to export.'); return; }
    const formatted = logs.slice().reverse().map(log => {
      const header = `Chat Session with: ${log.chatbotTitle}\nTimestamp: ${new Date(log.timestamp).toLocaleString()}\n---------------------------------------\n`;
      const conversation = log.messages.map(msg => {
        const prefix = msg.sender === 'user' ? 'You:' : 'Bot:';
        const content = msg.text || (msg.imageUrl ? '[Generated Image]' : '[Empty Message]');
        const sources = msg.sources && msg.sources.length > 0 ? `\n  [Sources: ${msg.sources.join(', ')}]` : '';
        return `${prefix} ${content}${sources}`;
      }).join('\n');
      return header + conversation + '\n\n=======================================\n\n';
    }).join('');
    const blob = new Blob([formatted], { type: 'text/plain;charset=utf-8' });
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
            {authed && (
              <>
                <button onClick={handleExportLogs} className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-600 transition-colors">
                  Export Logs
                </button>
                <button onClick={handleClearLogs} className="bg-red-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-red-600 transition-colors">
                  Clear All Logs
                </button>
              </>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors">
              <CloseIcon />
            </button>
          </div>
        </header>

        {!authed ? (
          <div className="flex-grow flex items-center justify-center p-6">
            <form
              onSubmit={(e) => { e.preventDefault(); load(token); }}
              className="w-full max-w-sm space-y-3"
            >
              <p className="text-sm text-gray-600">
                Enter the <code>MYRI_ADMIN_TOKEN</code> to view transcripts. It is
                kept only in this tab's session storage. For scripted access use{' '}
                <code>backend/view_logs.py</code>.
              </p>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="admin token"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading || !token}
                className="w-full bg-indigo-600 text-white font-semibold py-2 rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
              >
                {loading ? 'Checking…' : 'Unlock'}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto bg-gray-50 p-4 space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
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
        )}
      </div>
    </div>
  );
};

export default LogViewerModal;
