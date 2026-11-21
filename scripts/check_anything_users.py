import sqlite3

conn = sqlite3.connect(r'D:\LAN-AI-Infra\AnythingLLM\server\storage\anythingllm.db')
cursor = conn.cursor()
cursor.execute('SELECT id, username, role FROM users')
print('Users:', cursor.fetchall())
cursor.execute("SELECT label, value FROM system_settings WHERE label LIKE '%multi%'")
print('Multi-user settings:', cursor.fetchall())
conn.close()
