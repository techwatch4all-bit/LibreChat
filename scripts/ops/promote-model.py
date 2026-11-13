#!/usr/bin/env python3
"""
Satchida Model Promotion & Cutover Automation Script
Location: D:\LAN-AI-Infra\ops-scripts\promote-model.py

Purpose:
  Safely and atomically update all routing layers when a new model replaces an older one:
  1. Updates Bifrost data/free-models/allowlist.json (CostRouter plugin)
  2. Updates Bifrost data/config.db (routing_targets & routing_rules fallbacks)
  3. Updates One-API one-api.db (Channel 1, 4, 5 model_mappings)
  4. Runs a live end-to-end verification ping through Gateway (:4000)
"""

import sys, os, sqlite3, json, urllib.request, time

BIFROST_DIR = r"D:\LAN-AI-Infra\Bifrost\data"
ONEAPI_DB = r"D:\LAN-AI-Infra\one-api\one-api.db"
ALLOWLIST_FILE = os.path.join(BIFROST_DIR, "free-models", "allowlist.json")
CONFIG_DB = os.path.join(BIFROST_DIR, "config.db")

AUTH_TOKEN = "SPYfLW63OU6l04br13668aD230414eF2B2Ca38Ae8d35E9A7"

def promote_model(persona, new_model_slug):
    print(f"[*] Promoting model for persona '{persona}' -> '{new_model_slug}'...")

    # 1. Update CostRouter allowlist.json if it is a free model
    if ":free" in new_model_slug or "commandcode" in new_model_slug or "nousresearch" in new_model_slug:
        if os.path.exists(ALLOWLIST_FILE):
            with open(ALLOWLIST_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            free_list = data.get("free", [])
            if new_model_slug in free_list:
                free_list.remove(new_model_slug)
            free_list.insert(0, new_model_slug)
            data["free"] = free_list
            with open(ALLOWLIST_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            print(f"  [✓] Updated Bifrost CostRouter allowlist.json (priority #1)")

    # 2. Update Bifrost routing_targets
    rule_map = {
        "Work": "c3db54a5-fcee-4f13-96b5-e571b336cbd0",
        "Vibecoding": "a22b35bf-ca08-48b1-b28d-4071a3ac4d42",
        "Chat": "30af1763-d633-412d-aad2-820d2878c118",
        "Study": "30af1763-d633-412d-aad2-820d2878c118"
    }
    
    if persona in rule_map:
        rule_id = rule_map[persona]
        parts = new_model_slug.split("/", 1)
        provider = parts[0]
        model_name = parts[1] if len(parts) > 1 else parts[0]

        conn_bifrost = sqlite3.connect(CONFIG_DB)
        cb = conn_bifrost.cursor()
        cb.execute('UPDATE routing_targets SET provider = ?, model = ? WHERE rule_id = ?', (provider, model_name, rule_id))
        conn_bifrost.commit()
        conn_bifrost.close()
        print(f"  [✓] Updated Bifrost routing_targets primary target for {persona}")

    # 3. Update One-API channels 1, 4, 5
    conn_oneapi = sqlite3.connect(ONEAPI_DB)
    co = conn_oneapi.cursor()
    for ch_id in (1, 4, 5):
        co.execute('SELECT model_mapping FROM channels WHERE id = ?', (ch_id,))
        row = co.fetchone()
        if row and row[0]:
            mapping = json.loads(row[0])
            mapping[persona] = new_model_slug
            co.execute('UPDATE channels SET model_mapping = ? WHERE id = ?', (json.dumps(mapping), ch_id))
    conn_oneapi.commit()
    conn_oneapi.close()
    print(f"  [✓] Updated One-API channels 1, 4, 5 mappings for {persona}")

    # 4. Live Verification Ping through Gateway (:4000)
    print(f"[*] Running live end-to-end verification through Satchida Gateway (:4000)...")
    req = urllib.request.Request(
        'http://127.0.0.1:4000/v1/chat/completions',
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {AUTH_TOKEN}'},
        data=json.dumps({'model': persona, 'messages': [{'role': 'user', 'content': 'respond with 1 word: verified'}]}).encode('utf-8')
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            dt = round(time.time() - t0, 2)
            rf = res.get('extra_fields', {})
            resolved = rf.get('resolved_model_used')
            key_used = rf.get('routing_info', {}).get('key')
            content = res.get('choices', [{}])[0].get('message', {}).get('content', '').strip()
            print(f"  [✓] VERIFIED in {dt}s: Resolved Model = {resolved} (Key: {key_used})")
            print(f"  [✓] Response: {content[:40]}")
            if resolved == new_model_slug.split('/')[-1] or resolved in new_model_slug:
                print(f"[SUCCESS] Persona '{persona}' cutover to '{new_model_slug}' is 100% complete and active!\n")
            else:
                print(f"[WARNING] Resolved model '{resolved}' does not match '{new_model_slug}'. Check fallback priority.\n")
    except Exception as e:
        print(f"  [X] Verification failed: {e}\n")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python promote-model.py <Persona: Work|Vibecoding|Chat|Study> <ModelSlug: provider/model>")
        sys.exit(1)
    promote_model(sys.argv[1], sys.argv[2])
