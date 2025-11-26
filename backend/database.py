import sqlite3
import json
import os
from datetime import datetime

DB_PATH = "logs.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            chatbot_id TEXT NOT NULL,
            chatbot_title TEXT,
            timestamp TEXT,
            sender TEXT NOT NULL,
            message TEXT,
            sources TEXT
        )
    ''')
    conn.commit()
    conn.close()

def log_message(session_id, chatbot_id, chatbot_title, sender, message, sources=None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    sources_json = json.dumps(sources) if sources else None
    
    cursor.execute('''
        INSERT INTO chat_logs (session_id, chatbot_id, chatbot_title, timestamp, sender, message, sources)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (session_id, chatbot_id, chatbot_title, timestamp, sender, message, sources_json))
    
    conn.commit()
    conn.close()

def get_logs(chatbot_id=None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if chatbot_id:
        cursor.execute('SELECT * FROM chat_logs WHERE chatbot_id = ? ORDER BY timestamp DESC', (chatbot_id,))
    else:
        cursor.execute('SELECT * FROM chat_logs ORDER BY timestamp DESC')
        
    rows = cursor.fetchall()
    conn.close()
    
    # Group by session_id
    sessions = {}
    for row in rows:
        session_id = row['session_id']
        if session_id not in sessions:
            sessions[session_id] = {
                'id': session_id,
                'chatbotId': row['chatbot_id'],
                'chatbotTitle': row['chatbot_title'],
                'timestamp': row['timestamp'], # Use latest message timestamp or first?
                'messages': []
            }
        
        # Prepend because we fetched DESC but want messages in order within a session? 
        # Actually, if we want to reconstruct the chat, we usually want chronological order.
        # But the UI expects "sessions".
        # Let's just return the raw rows and let the frontend or a helper format it, 
        # OR format it here to match the frontend's expected `ChatLog` interface.
        
        sessions[session_id]['messages'].insert(0, {
            'sender': row['sender'],
            'text': row['message'],
            'sources': json.loads(row['sources']) if row['sources'] else []
        })
        
    return list(sessions.values())

def clear_logs():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM chat_logs')
    conn.commit()
    conn.close()
