import sys
import sqlite3

def query():
    if len(sys.argv) < 2:
        db_path = r'D:\LAN-AI-Infra\AnythingLLM\server\storage\anythingllm.db'
    else:
        db_path = sys.argv[1]
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('''
        SELECT 
            (SELECT count(*) FROM workspaces),
            (SELECT count(*) FROM event_logs WHERE event IN ('workspace_created', 'api_workspace_created')),
            (SELECT count(*) FROM event_logs WHERE event IN ('workspace_deleted', 'api_workspace_deleted')),
            (SELECT count(*) FROM workspace_documents),
            (SELECT count(*) FROM document_vectors),
            (SELECT count(*) FROM users)
    ''')
    row = c.fetchone()
    print('|'.join(str(x if x is not None else 0) for x in row))

if __name__ == '__main__':
    query()
