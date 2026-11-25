import sqlite3
import json
import sys

def get_tenants():
    try:
        con = sqlite3.connect('d:/LAN-AI-Infra/one-api/one-api.db')
        cur = con.cursor()
        cur.execute('SELECT id, name, plan, max_seats, status FROM tenants')
        rows = cur.fetchall()
        result = {}
        for r in rows:
            result[r[0]] = {
                'displayName': r[1],
                'plan': r[2],
                'maxSeats': r[3],
                'status': r[4]
            }
        return result
    except Exception as e:
        return {}

if __name__ == '__main__':
    tenants = get_tenants()
    sys.stdout.write(json.dumps(tenants))
