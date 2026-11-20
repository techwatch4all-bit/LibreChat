import sqlite3

conn = sqlite3.connect(r'D:\LAN-AI-Infra\AnythingLLM\server\storage\anythingllm.db')
cursor = conn.cursor()
cursor.execute("SELECT label, value FROM system_settings WHERE label LIKE '%llm%' OR label LIKE '%openai%' OR label LIKE '%router%'")
for row in cursor.fetchall():
    print(row[0], ':', row[1])
conn.close()
