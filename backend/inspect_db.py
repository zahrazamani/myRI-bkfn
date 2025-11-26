import sqlite3
import sys

DB_PATH = "documents/tafsir_almizan_en.db"
OUTPUT_FILE = "db_info.txt"

def inspect():
    with open(OUTPUT_FILE, "w") as f:
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Get tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            f.write(f"Tables: {tables}\n")
            
            for table in tables:
                table_name = table[0]
                f.write(f"\n--- Table: {table_name} ---\n")
                
                # Get columns
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = cursor.fetchall()
                f.write(f"Columns: {[col[1] for col in columns]}\n")
                
                # Get first row
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 1")
                row = cursor.fetchone()
                f.write(f"Sample Row: {row}\n")
                
            conn.close()
        except Exception as e:
            f.write(f"Error: {e}\n")

if __name__ == "__main__":
    inspect()
