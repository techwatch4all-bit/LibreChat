import sqlite3
import datetime
import subprocess

# Generate hashes using bcrypt in node
def get_bcrypt_hash(pw):
    cmd = ["node", "-e", f"const b = require('bcryptjs'); console.log(b.hashSync('{pw}', 10));"]
    res = subprocess.check_output(cmd).decode().strip()
    return res

admin_pw = "SatchidaAdmin#2026!"
manager_pw = "TenantManager#2026!"

admin_hash = get_bcrypt_hash(admin_pw)
manager_hash = get_bcrypt_hash(manager_pw)

now = datetime.datetime.now(datetime.timezone.utc).isoformat()

conn = sqlite3.connect(r'D:\LAN-AI-Infra\AnythingLLM\server\storage\anythingllm.db')
cursor = conn.cursor()

# Enable multi_user_mode
cursor.execute("SELECT id FROM system_settings WHERE label = 'multi_user_mode'")
row = cursor.fetchone()
if row:
    cursor.execute("UPDATE system_settings WHERE label = 'multi_user_mode'", ("true",))
else:
    cursor.execute("INSERT INTO system_settings (label, value) VALUES ('multi_user_mode', 'true')")

# Check existing admin
cursor.execute("SELECT id, username, role FROM users WHERE username = 'admin@satchida.com'")
admin_row = cursor.fetchone()
if not admin_row:
    cursor.execute("""
        INSERT INTO users (username, password, role, suspended, createdAt, lastUpdatedAt, bio)
        VALUES (?, ?, 'admin', 0, ?, ?, 'Central Operator Admin')
    """, ('admin@satchida.com', admin_hash, now, now))
    admin_id = cursor.lastrowid
    print(f"Created Admin user: admin@satchida.com (ID: {admin_id})")
else:
    cursor.execute("UPDATE users SET password = ?, role = 'admin' WHERE username = 'admin@satchida.com'", (admin_hash,))
    admin_id = admin_row[0]
    print(f"Updated Admin user: admin@satchida.com (ID: {admin_id})")

# Check existing manager
cursor.execute("SELECT id, username, role FROM users WHERE username = 'manager@tenant.satchida.com'")
mgr_row = cursor.fetchone()
if not mgr_row:
    cursor.execute("""
        INSERT INTO users (username, password, role, suspended, createdAt, lastUpdatedAt, bio)
        VALUES (?, ?, 'manager', 0, ?, ?, 'Tenant Operations Manager')
    """, ('manager@tenant.satchida.com', manager_hash, now, now))
    mgr_id = cursor.lastrowid
    print(f"Created Manager user: manager@tenant.satchida.com (ID: {mgr_id})")
else:
    cursor.execute("UPDATE users SET password = ?, role = 'manager' WHERE username = 'manager@tenant.satchida.com'", (manager_hash,))
    mgr_id = mgr_row[0]
    print(f"Updated Manager user: manager@tenant.satchida.com (ID: {mgr_id})")

conn.commit()

# Print confirmation
cursor.execute("SELECT id, username, role FROM users")
print("Active AnythingLLM users:", cursor.fetchall())
cursor.execute("SELECT label, value FROM system_settings WHERE label = 'multi_user_mode'")
print("Multi-user setting:", cursor.fetchall())

conn.close()
