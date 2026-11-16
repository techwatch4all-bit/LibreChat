/* Satchida Admin — full RBAC management UI. Vanilla JS, no framework.
 * Reuses the operator JWT stored in sessionStorage by login.html and sends it
 * as `Authorization: Bearer` (the session cookie is Secure/SameSite=Strict and
 * therefore not sent over plain HTTP on this host). */
const BASE = '/api/admin';

const API = (path, opts = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = sessionStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;
  const stepUpToken = sessionStorage.getItem('stepUpToken');
  if (stepUpToken) headers['X-Admin-StepUp-Token'] = stepUpToken;
  return fetch(path, { credentials: 'include', ...opts, headers });
};

async function apiAdmin(path, opts = {}) {
  let res;
  try {
    res = await API(BASE + path, opts);
  } catch {
    return { ok: false, status: 0, statusText: 'network', json: null };
  }
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  // Only remove token if the primary session verification explicitly failed,
  // NEVER on 403 (step-up required / RBAC restriction) or endpoint-specific 401s.
  if (res.status === 401 && path === '/verify') {
    sessionStorage.removeItem('token');
  }
  return { ok: res.ok, status: res.status, statusText: res.statusText, json };
}

const escapeHtml = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const truncate = (s, n = 90) => {
  const t = String(s ?? '');
  return t.length > n ? t.slice(0, n) + '…' : t;
};

function normalizeList(res) {
  if (!res?.json) return [];
  const j = res.json;
  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.members)) return j.members;
  if (Array.isArray(j?.users)) return j.users;
  if (Array.isArray(j?.roles)) return j.roles;
  if (Array.isArray(j?.groups)) return j.groups;
  if (Array.isArray(j?.grants)) return j.grants;
  if (Array.isArray(j?.items)) return j.items;
  if (Array.isArray(j?.entries)) return j.entries;
  if (Array.isArray(j?.data)) return j.data;
  if (Array.isArray(j?.results)) return j.results;
  if (j && typeof j === 'object') return [j];
  return [];
}

const uid = (u) => u._id || u.id || u.userId || '';
const uname = (u) => u.name || u.displayName || u.username || u.email || uid(u);

/* SystemCapabilities served by the platform (OPERATOR_CONTROL omitted — the server
 * rejects it on assign, and it must never be self-granted). */
const CAPS = [
  'access:admin',
  'read:users',
  'manage:users',
  'read:groups',
  'manage:groups',
  'read:roles',
  'manage:roles',
  'read:configs',
  'manage:configs',
  'assign:configs',
  'read:usage',
  'read:insights',
  'read:agents',
  'manage:agents',
  'manage:code_environments',
  'read:prompts',
  'manage:prompts',
  'read:sharedlinks',
  'manage:sharedlinks',
  'read:assistants',
  'manage:assistants',
  'read:audit_log',
];

/* Account-type tiers mirror one-api's seeded policy groups exactly (lowercase).
 * one-api resolves a seat's group with an exact name match, so a mis-cased name
 * silently bypasses that side's MaxSeats cap. */
const ACCOUNT_TYPES = [
  { label: '— none —', value: '' },
  { label: 'Basic', value: 'basic' },
  { label: 'Standard', value: 'standard' },
  { label: 'Family (Pooled 4 Users)', value: 'family' },
  { label: 'Pro', value: 'pro' },
  { label: 'Pro_Family (Pooled 4 Users)', value: 'pro_family' },
  { label: 'Enterprise', value: 'enterprise' },
  { label: 'Privacy', value: 'privacy' },
];

const FAMILY_ROLE_OPTIONS = [
  { label: '— not applicable (individual account) —', value: '' },
  { label: 'Family Bundle Primary (Owner / Head)', value: 'owner' },
  { label: 'Family Member (Adult)', value: 'adult' },
  { label: 'Family Member (Minor / Student)', value: 'minor' },
];

const S = {
  users: [],
  roles: [],
  groups: [],
  grants: [],
  effective: [],
  isOperator: false,
  tenantId: null,
  /* Server-side page cursors. The server caps a page at 200 rows, so a tenant
   * with thousands of accounts is reached by paging, never by fetching all. */
  userPage: { limit: 100, offset: 0, total: 0 },
  groupPage: { limit: 100, offset: 0, total: 0 },
};
let CURRENT = 'users';

/* ---------- toast ---------- */
function toast(msg, kind = 'info', ms = 3600) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    t.setAttribute('role', 'alert');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast show ' + (kind === 'err' ? 'toastErr' : 'toastOk');
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------- modal singleton ---------- */
const Modal = (() => {
  let node, titleEl, bodyEl, footEl, resolveFn, closeHook;
  function ensure() {
    if (node) return;
    node = document.createElement('div');
    node.id = 'satchidaModalWrap';
    node.innerHTML =
      '<div class="satchidaModal">' +
      '<div class="satchidaModalHead"><span class="satchidaModalTitle"></span>' +
      '<button class="satchidaModalClose" type="button" aria-label="close">&times;</button></div>' +
      '<div class="satchidaModalBody"></div>' +
      '<div class="satchidaModalFoot"></div>' +
      '</div>';
    node.addEventListener('click', (e) => {
      if (e.target === node || e.target.classList.contains('satchidaModalClose')) close();
    });
    document.body.appendChild(node);
    titleEl = node.querySelector('.satchidaModalTitle');
    bodyEl = node.querySelector('.satchidaModalBody');
    footEl = node.querySelector('.satchidaModalFoot');
  }
  function close() {
    if (node) node.style.display = 'none';
    if (closeHook) {
      const h = closeHook;
      closeHook = null;
      try { h(); } catch {}
    }
    if (resolveFn) {
      const r = resolveFn;
      resolveFn = null;
      r(null);
    }
  }
  function setOnClose(fn) {
    closeHook = fn;
  }
  function show(title, renderBody, renderFoot) {
    closeHook = null;
    ensure();
    titleEl.textContent = title;
    bodyEl.innerHTML = '';
    renderBody(bodyEl);
    footEl.innerHTML = '';
    if (renderFoot) renderFoot(footEl);
    node.style.display = 'block';
  }
  function wait(title, renderBody, renderFoot) {
    return new Promise((res) => {
      resolveFn = (v) => {
        res(v);
      };
      show(title, renderBody, renderFoot);
    });
  }
  return { show, close, wait, setOnClose };
})();

function confirmDialog(message) {
  return new Promise((resolve) => {
    Modal.show(
      'Confirm action',
      (b) => {
        const p = document.createElement('p');
        p.textContent = message;
        b.appendChild(p);
      },
      (f) => {
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Cancel';
        cancel.className = 'btn btn-ghost';
        cancel.onclick = () => {
          Modal.close();
          resolve(false);
        };
        const ok = document.createElement('button');
        ok.type = 'button';
        ok.textContent = 'Confirm';
        ok.className = 'btn btn-primary';
        ok.onclick = () => {
          Modal.close();
          resolve(true);
        };
        f.appendChild(cancel);
        f.appendChild(ok);
      },
    );
  });
}

/* formModal: fields [{key,label,type,value,required,options}], resolves with
 * values object on submit (after onSubmit ok), or null on cancel. */
function formModal(title, fields, submitLabel, defaults, onSubmit) {
  return Modal.wait(
    title,
    (b) => {
      const form = document.createElement('form');
      form.className = 'modalForm';
      form.noValidate = true;
      fields.forEach((fld) => {
        const fx = document.createElement('div');
        fx.className = 'modalField';
        const lbl = document.createElement('label');
        lbl.textContent = fld.label;
        lbl.htmlFor = fld.key;
        let input;
        if (fld.type === 'select') {
          input = document.createElement('select');
          input.id = fld.key;
          input.name = fld.key;
          (fld.options || []).forEach((op) => {
            const o = document.createElement('option');
            o.value = op.value;
            o.textContent = op.label;
            if (String(op.value) === String((defaults || {})[fld.key] ?? fld.value ?? ''))
              o.selected = true;
            input.appendChild(o);
          });
        } else if (fld.type === 'textarea') {
          input = document.createElement('textarea');
          input.id = fld.key;
          input.name = fld.key;
          input.rows = 3;
          input.value = (defaults || {})[fld.key] ?? fld.value ?? '';
        } else {
          input = document.createElement('input');
          input.type = fld.type || 'text';
          input.id = fld.key;
          input.name = fld.key;
          input.value = (defaults || {})[fld.key] ?? fld.value ?? '';
          if (fld.placeholder) input.placeholder = fld.placeholder;
          if (fld.disabled) {
            input.disabled = true;
            input.style.opacity = '0.6';
            input.style.cursor = 'not-allowed';
          }
          if (fld.type === 'checkbox') {
            delete input.value;
            input.checked = !!(defaults || {})[fld.key];
          }
          if (fld.required) input.required = true;
        }
        if (fld.disabled) {
          input.disabled = true;
          input.style.opacity = '0.6';
          input.style.cursor = 'not-allowed';
        }
        fx.appendChild(lbl);
        fx.appendChild(input);
        if (fld.hint) {
          const hint = document.createElement('small');
          hint.textContent = fld.hint;
          hint.style.cssText = 'font-size:11px;color:var(--muted);margin-top:2px;display:block';
          fx.appendChild(hint);
        }
        form.appendChild(fx);
      });
      b.appendChild(form);
      const idCat = form.querySelector('#idCategory');
      const uidInput = form.querySelector('#uniqueIdentifier');
      if (idCat && uidInput) {
        idCat.addEventListener('change', () => {
          if (idCat.value === 'school') {
            uidInput.placeholder = 'e.g. SCH-2024-0482 (Permanent Admission/GR No. across years)';
          } else if (idCat.value === 'rwa') {
            uidInput.placeholder = 'e.g. Tower B - Flat 402 (or Block C - Plot 14)';
          } else if (idCat.value === 'corporate') {
            uidInput.placeholder = 'e.g. EMP-1082 or ENG-402';
          } else if (idCat.value === 'healthcare') {
            uidInput.placeholder = 'e.g. MED-3042 or DOC-108';
          } else {
            uidInput.placeholder = 'e.g. Freeform Unique Reference ID';
          }
        });
      }
    },
    (f) => {
      const err = document.createElement('span');
      err.className = 'modalError';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.className = 'btn btn-ghost';
      cancel.onclick = () => {
        Modal.close();
      };
      const sub = document.createElement('button');
      sub.type = 'button';
      sub.textContent = submitLabel;
      sub.className = 'btn btn-primary';
      sub.onclick = async () => {
        const form = f.closest('.satchidaModal').querySelector('.modalForm');
        const values = {};
        new FormData(form).forEach((v, k) => (values[k] = v));
        sub.disabled = true;
        sub.textContent = 'Saving…';
        err.textContent = '';
        const result = await onSubmit(values);
        if (result && result.ok === false) {
          err.textContent = result.error || 'Could not save.';
          sub.disabled = false;
          sub.textContent = submitLabel;
          f.insertBefore(err, f.firstChild);
        } else {
          closeSubmit();
        }
      };
      function closeSubmit() {
        Modal.close();
      }
      f.appendChild(err);
      f.appendChild(cancel);
      f.appendChild(sub);
    },
  );
}

/* ---------- loaders ---------- */
/**
 * Reflect a page of results into its "showing X–Y of N" line and the Prev/Next
 * buttons. `total` is the server's count, so the label describes the whole
 * tenant rather than the rows that happen to be on screen.
 */
function syncPager(state, ids, shown) {
  const from = shown === 0 ? 0 : state.offset + 1;
  const to = state.offset + shown;
  const range = document.getElementById(ids.range);
  if (range) {
    range.textContent = state.total ? `Showing ${from}–${to} of ${state.total}` : 'No records';
  }
  const bar = document.getElementById(ids.bar);
  if (bar) bar.hidden = false;
  const prev = document.getElementById(ids.prev);
  if (prev) prev.disabled = state.offset <= 0;
  const next = document.getElementById(ids.next);
  if (next) next.disabled = state.total > 0 && to >= state.total;
}

const USER_PAGER_IDS = {
  bar: 'usersPagerBar',
  range: 'usersRange',
  prev: 'usersPrevBtn',
  next: 'usersNextBtn',
};

const GROUP_PAGER_IDS = {
  bar: 'groupsPagerBar',
  range: 'groupsRange',
  prev: 'groupsPrevBtn',
  next: 'groupsNextBtn',
};

async function loadUsers() {
  const state = S.userPage;
  const res = await apiAdmin(`/users?limit=${state.limit}&offset=${state.offset}`);
  const items = normalizeList(res).filter((u) => uid(u));

  /* Deleting the last row of the last page leaves an empty page — step back one
   * page instead of showing a dead end. Terminates because offset strictly decreases. */
  if (res.ok && items.length === 0 && state.offset > 0) {
    state.offset = Math.max(0, state.offset - state.limit);
    return loadUsers();
  }

  S.users = items;
  state.total = Number.isFinite(res.json?.total) ? res.json.total : items.length;
  const c = document.getElementById('usersCount');
  if (c) c.textContent = `${state.total} record(s)`;
  renderUsers();
  syncPager(state, USER_PAGER_IDS, items.length);
  if (!res.ok) toast(`Could not load users (HTTP ${res.status})`, 'err');
}

async function loadRoles() {
  const res = await apiAdmin('/roles');
  S.roles = normalizeList(res).filter((r) => r && (r.name || r._id));
  renderRoles();
  const c = document.getElementById('rolesCount');
  if (c) c.textContent = `${S.roles.length} record(s)`;
  populateGrantsAssign();
  if (!res.ok) toast(`Could not load roles (HTTP ${res.status})`, 'err');
}

async function loadGroups() {
  const state = S.groupPage;
  const res = await apiAdmin(`/groups?limit=${state.limit}&offset=${state.offset}`);
  const items = normalizeList(res).filter((g) => g && (g._id || g.id || g.name));

  if (res.ok && items.length === 0 && state.offset > 0) {
    state.offset = Math.max(0, state.offset - state.limit);
    return loadGroups();
  }

  S.groups = items;
  state.total = Number.isFinite(res.json?.total) ? res.json.total : items.length;
  const c = document.getElementById('groupsCount');
  if (c) c.textContent = `${state.total} record(s)`;
  renderGroups();
  syncPager(state, GROUP_PAGER_IDS, items.length);
  /* Groups feed the grant-assignment picker, so refresh it from the current page. */
  populateGrantsAssign();
  if (!res.ok) toast(`Could not load groups (HTTP ${res.status})`, 'err');
}

function renderQRCodeSVG(text, size = 180) {
  if (window.qrcodegen && window.qrcodegen.QrCode) {
    try {
      const qr = window.qrcodegen.QrCode.encodeText(text, window.qrcodegen.QrCode.Ecc.MEDIUM);
      const s = qr.size;
      const border = 2;
      const total = s + border * 2;
      let svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
        total +
        ' ' +
        total +
        '" width="' +
        size +
        '" height="' +
        size +
        '" style="background:#fff;border-radius:8px;padding:6px;display:block;margin:12px auto">';
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          if (qr.getModule(x, y)) {
            svg +=
              '<rect x="' +
              (x + border) +
              '" y="' +
              (y + border) +
              '" width="1" height="1" fill="#000"/>';
          }
        }
      }
      svg += '</svg>';
      return svg;
    } catch (e) {
      console.warn('QR render error:', e);
    }
  }
  return '';
}

/**
 * Prompts the admin for Step-Up TOTP authentication (or enrollment if not yet setup).
 * Returns true if step-up authentication succeeded, false otherwise.
 */
async function promptStepUpAuth() {
  if (sessionStorage.getItem('stepUpToken')) {
    return true;
  }

  const vRes = await apiAdmin('/verify');
  const twoFactorEnabled = vRes.json?.twoFactorEnabled === true || vRes.json?.user?.twoFactorEnabled === true;

  if (!twoFactorEnabled) {
    // Initiate 2FA enrollment wizard
    const sRes = await apiAdmin('/2fa/setup', { method: 'POST' });
    if (!sRes.ok) {
      toast('Failed to initialize 2FA setup: ' + (sRes.json?.error || sRes.status), 'err');
      return false;
    }
    const { secret, otpauthUrl } = sRes.json;
    const qrSvg = renderQRCodeSVG(otpauthUrl, 180);

    const bodyHtml =
      '<div style="text-align:center">' +
      '<p style="color:var(--text);font-size:14px;margin-bottom:8px"><strong>Step-Up Security Requirement</strong></p>' +
      '<p style="color:var(--muted);font-size:13px">Grants & Audit Log access requires Two-Factor Authentication (TOTP). Scan this QR code with Google Authenticator, 1Password, or Microsoft Authenticator:</p>' +
      (qrSvg ||
        '<p style="font-family:monospace;padding:12px;background:var(--panel2);border-radius:6px;margin:12px 0">' +
          escapeHtml(otpauthUrl) +
          '</p>') +
      '<p style="font-size:12px;color:var(--muted);margin-bottom:12px">Secret key: <code style="color:var(--accent);font-weight:600">' +
      escapeHtml(secret) +
      '</code></p>' +
      '<div class="modalField" style="text-align:left"><label for="stepUpVerifyCode">Enter 6-digit Authenticator Code</label>' +
      '<input id="stepUpVerifyCode" type="text" placeholder="123456" maxlength="6" autocomplete="off" style="font-size:18px;letter-spacing:4px;text-align:center" /></div>' +
      '</div>';

    return new Promise((resolve) => {
      let resolved = false;
      const done = (val) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };
      Modal.setOnClose(() => done(false));
      Modal.show(
        'Enroll Two-Factor Authentication',
        (b) => {
          b.innerHTML = bodyHtml;
        },
        (f) => {
          f.innerHTML =
            '<button type="button" id="cancelEnrollBtn" class="btn btn-ghost">Cancel</button>' +
            '<button type="button" id="confirmEnrollBtn" class="btn btn-primary">Verify & Continue</button>';
        },
      );
      document.getElementById('cancelEnrollBtn')?.addEventListener('click', () => {
        Modal.close();
        done(false);
      });
      const input = document.getElementById('stepUpVerifyCode');
      input?.focus();
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('confirmEnrollBtn')?.click();
        }
      });
      document.getElementById('confirmEnrollBtn')?.addEventListener('click', async () => {
        const code = document.getElementById('stepUpVerifyCode')?.value?.trim();
        if (!code || code.length < 6) {
          toast('Please enter a 6-digit verification code.', 'err');
          return;
        }
        const cRes = await apiAdmin('/2fa/confirm', {
          method: 'POST',
          body: JSON.stringify({ token: code }),
        });
        if (cRes.ok && cRes.json?.stepUpToken) {
          sessionStorage.setItem('stepUpToken', cRes.json.stepUpToken);
          toast('2FA enrolled and verified successfully!', 'ok');
          Modal.close();
          done(true);
        } else {
          toast('Verification failed: ' + (cRes.json?.error || 'Invalid code'), 'err');
        }
      });
    });
  }

  // Already enrolled, prompt for 6-digit TOTP (or backup code)
  const bodyHtml =
    '<div style="text-align:center">' +
    '<p style="color:var(--text);font-size:14px;margin-bottom:8px"><strong>Protected Security Gate</strong></p>' +
    '<p style="color:var(--muted);font-size:13px;margin-bottom:16px">Grants & Audit Log access requires active offline TOTP step-up authentication. Enter the current 6-digit code from your authenticator app (or a backup code):</p>' +
    '<div class="modalField" style="text-align:left"><label for="stepUpCode">Authenticator or Backup Code</label>' +
    '<input id="stepUpCode" type="text" placeholder="123456" maxlength="16" autocomplete="off" style="font-size:18px;letter-spacing:4px;text-align:center" /></div>' +
    '</div>';

  return new Promise((resolve) => {
    let resolved = false;
    const done = (val) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };
    Modal.setOnClose(() => done(false));
    Modal.show(
      'Security Verification Required',
      (b) => {
        b.innerHTML = bodyHtml;
      },
      (f) => {
        f.innerHTML =
          '<button type="button" id="cancelStepUpBtn" class="btn btn-ghost">Cancel</button>' +
          '<button type="button" id="verifyStepUpBtn" class="btn btn-primary">Authenticate</button>';
      },
    );
    document.getElementById('cancelStepUpBtn')?.addEventListener('click', () => {
      Modal.close();
      done(false);
    });
    const input = document.getElementById('stepUpCode');
    input?.focus();
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('verifyStepUpBtn')?.click();
      }
    });
    document.getElementById('verifyStepUpBtn')?.addEventListener('click', async () => {
      const rawCode = document.getElementById('stepUpCode')?.value?.trim();
      if (!rawCode) {
        toast('Please enter your 6-digit code or backup code.', 'err');
        return;
      }
      const isOtp = /^\d{6}$/.test(rawCode);
      const payload = isOtp ? { token: rawCode } : { backupCode: rawCode };
      const res = await apiAdmin('/step-up', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.ok && res.json?.stepUpToken) {
        sessionStorage.setItem('stepUpToken', res.json.stepUpToken);
        toast('Step-up verification approved.', 'ok');
        Modal.close();
        done(true);
      } else {
        toast('Verification failed: ' + (res.json?.error || 'Invalid code'), 'err');
      }
    });
  });
}

async function loadGrants() {
  if (!sessionStorage.getItem('stepUpToken')) {
    const ok = await promptStepUpAuth();
    if (!ok) {
      const el = document.getElementById('grantsTable');
      if (el) el.innerHTML = '<p class="empty">Step-up verification required to view grants. <button type="button" class="btn btn-sm btn-ghost" onclick="loadGrants()" style="margin-left:8px">Verify & Unlock</button></p>';
      return;
    }
  }
  let res = await apiAdmin('/grants');
  if (res.status === 403 && res.json?.stepUpRequired) {
    sessionStorage.removeItem('stepUpToken');
    const ok = await promptStepUpAuth();
    if (ok) {
      res = await apiAdmin('/grants');
    } else {
      const el = document.getElementById('grantsTable');
      if (el) el.innerHTML = '<p class="empty">Step-up verification required to view grants. <button type="button" class="btn btn-sm btn-ghost" onclick="loadGrants()" style="margin-left:8px">Verify & Unlock</button></p>';
      return;
    }
  }
  S.grants = normalizeList(res);
  renderGrants();
  const c = document.getElementById('grantsCount');
  if (c) c.textContent = `${S.grants.length} record(s)`;
  if (!res.ok) toast(`Could not load grants (HTTP ${res.status})`, 'err');
}

async function loadEffective() {
  const res = await apiAdmin('/grants/effective');
  S.effective = res.ok && Array.isArray(res.json?.capabilities) ? res.json.capabilities : [];
  renderEffective();
}

function populateAuditTenantFilter() {
  const sel = document.getElementById('auditTenantFilter');
  if (!sel) return;
  const current = sel.value;
  const tenants = new Set();
  (S.users || []).forEach((u) => {
    if (u.tenantId) tenants.add(u.tenantId);
  });
  tenants.add('satchida-master');

  const options = [
    '<option value="all">All Scopes (Platform & Tenants)</option>',
    '<option value="__platform__">Platform Operations</option>',
  ];
  Array.from(tenants)
    .sort()
    .forEach((t) => {
      options.push(`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`);
    });
  sel.innerHTML = options.join('');
  if (current && Array.from(sel.options).some((o) => o.value === current)) {
    sel.value = current;
  }
}

async function loadAudit() {
  if (!sessionStorage.getItem('stepUpToken')) {
    const ok = await promptStepUpAuth();
    if (!ok) {
      document.getElementById('auditTable').innerHTML =
        '<p class="empty">Step-up verification required to view audit logs. <button type="button" class="btn btn-sm btn-ghost" onclick="loadAudit()" style="margin-left:8px">Verify & Unlock</button></p>';
      return;
    }
  }

  populateAuditTenantFilter();
  const searchInput = document.getElementById('auditSearch');
  const tenantSel = document.getElementById('auditTenantFilter');
  const catSel = document.getElementById('auditCategoryFilter');

  const params = new URLSearchParams({ limit: '100' });
  const tenantVal = tenantSel ? tenantSel.value : 'all';
  if (tenantVal && tenantVal !== 'all') {
    params.set('tenantId', tenantVal);
  } else {
    params.set('tenantId', 'all');
  }

  const searchVal = searchInput ? searchInput.value.trim() : '';
  if (searchVal) params.set('search', searchVal);

  const catVal = catSel ? catSel.value : 'all';
  if (catVal && catVal !== 'all') params.set('category', catVal);

  let res = await apiAdmin('/audit-log?' + params.toString());
  if (res.status === 403 && res.json?.stepUpRequired) {
    sessionStorage.removeItem('stepUpToken');
    const ok = await promptStepUpAuth();
    if (ok) {
      res = await apiAdmin('/audit-log?' + params.toString());
    } else {
      document.getElementById('auditTable').innerHTML =
        '<p class="empty">Step-up verification required to view audit logs. <button type="button" class="btn btn-sm btn-ghost" onclick="loadAudit()" style="margin-left:8px">Verify & Unlock</button></p>';
      return;
    }
  }

  const list = normalizeList(res);
  const total = Number.isFinite(res.json?.total) ? res.json.total : list.length;
  const c = document.getElementById('auditCount');
  if (c) c.textContent = `${total} record(s)${list.length < total ? ` (showing latest ${list.length})` : ''}`;
  if (!res.ok) {
    document.getElementById('auditTable').innerHTML =
      '<p class="empty">Could not load audit log (HTTP ' + res.status + '). ' +
      (res.json?.error ? escapeHtml(res.json.error) : '') +
      ' <button type="button" class="btn btn-sm btn-ghost" onclick="loadAudit()" style="margin-left:8px">Retry</button></p>';
    return;
  }
  const auditColumns = [
    {
      h: 'Timestamp',
      v: (it) => {
        const d = it.timestamp || it.createdAt;
        return d ? new Date(d).toLocaleString() : '';
      },
    },
    {
      h: 'Actor',
      v: (it) => {
        const a = it.actor || {};
        return (a.name || a.email || a.id || a.type || 'system') + (a.type ? ` (${a.type})` : '');
      },
    },
    { h: 'Action', v: (it) => it.action || '' },
    { h: 'Category', v: (it) => it.category || '' },
    {
      h: 'Outcome',
      v: (it) => {
        const out = it.outcome || 'success';
        const isOk = out === 'success';
        return `<span class="pill" style="${isOk ? 'color:#4ade80' : 'color:#f87171'}">${escapeHtml(out)}</span>`;
      },
      raw: true,
    },
    {
      h: 'Target',
      v: (it) => {
        const t = it.target || {};
        return (t.name || t.id || t.type || '—') + (t.type ? ` [${t.type}]` : '');
      },
    },
    {
      h: 'Scope / Tenant',
      v: (it) => it.tenantId || (it.chainKey === '__platform__' ? 'platform' : it.chainKey || '—'),
    },
    {
      h: 'IP / Origin',
      v: (it) => (it.context && it.context.ip) || '—',
    },
  ];
  renderTable('#auditTable', list, auditColumns, false);
}

/* ---------- generic table renderer ---------- */
function renderTable(containerSel, rows, columns, allFields) {
  const el = document.querySelector(containerSel);
  if (!el) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    el.innerHTML = '<p class="empty">No records.</p>';
    return;
  }
  const cols =
    columns ||
    (allFields
      ? Array.from(new Set(list.flatMap((r) => Object.keys(r)))).map((k) => ({ h: k, k }))
      : []);
  const head = cols.map((c) => '<th>' + escapeHtml(c.h) + '</th>').join('');
  const body = list
    .map(
      (it) =>
        '<tr>' +
        cols
          .map((c) => {
            const val = typeof c.v === 'function' ? c.v(it) : it[c.k];
            return '<td>' + (c.raw ? val : escapeHtml(val)) + '</td>';
          })
          .join('') +
        '</tr>',
    )
    .join('');
  el.innerHTML =
    '<table class="dataTable"><thead><tr>' +
    head +
    '</tr></thead><tbody>' +
    body +
    '</tbody></table>';
}

function populateTenantFilter() {
  const sel = document.getElementById('usersTenantFilter');
  if (!sel) return;
  const current = sel.value || 'all';
  const tenants = new Set();
  S.users.forEach((u) => {
    if (u.tenantId) tenants.add(u.tenantId);
    else tenants.add('satchida-master');
  });
  let html = '<option value="all">All Tenants</option>';
  Array.from(tenants)
    .sort()
    .forEach((t) => {
      html +=
        '<option value="' +
        escapeHtml(t) +
        '"' +
        (t === current ? ' selected' : '') +
        '>' +
        escapeHtml(t) +
        '</option>';
    });
  sel.innerHTML = html;
}

function getFilteredUsers() {
  const tenantFilter = document.getElementById('usersTenantFilter')?.value || 'all';
  const tierFilter = document.getElementById('usersTierFilter')?.value || 'all';
  const seatFilter = document.getElementById('usersSeatFilter')?.value || 'all';

  return S.users.filter((u) => {
    const userTenant = u.tenantId || 'satchida-master';
    if (tenantFilter !== 'all' && userTenant !== tenantFilter) return false;

    const userTier = (u.accountType || '').toLowerCase();
    if (tierFilter === 'none') {
      if (userTier && userTier !== 'none' && userTier !== 'null') return false;
    } else if (tierFilter !== 'all') {
      if (userTier !== tierFilter) return false;
    }

    if (seatFilter === 'assigned' && !u.seatAssigned) return false;
    if (seatFilter === 'unassigned' && u.seatAssigned) return false;

    return true;
  });
}

/* ---------- per-tab renderers (with action buttons) ---------- */
function renderUsers() {
  const el = document.getElementById('usersTable');
  if (!el) return;
  populateTenantFilter();
  const filtered = getFilteredUsers();
  if (!filtered.length) {
    el.innerHTML = '<p class="empty">No matching users.</p>';
    return;
  }
  const head =
    '<tr><th>Email</th><th>Name</th><th>Identifier</th><th>Role</th><th>Account type</th><th>Tenant</th><th>Family</th><th>Seat</th><th class="thActions">Actions</th></tr>';
  const body = filtered
    .map((u) => {
      const id = uid(u);
      const userRole = u.role || u.roleName || '';
      /* Tenant admins must NOT be able to edit, reset, or delete ADMIN-role accounts.
       * They also must not be able to add ADMIN-role accounts or see the Delete button for them. */
      const isAdminUser = userRole === 'ADMIN';
      const canManage = S.isOperator || !isAdminUser;
      const seat = u.seatAssigned
        ? '<span class="pill">' + escapeHtml(u.seatTokenHint || 'assigned') + '</span>'
        : '';
      return (
        '<tr data-uid="' +
        escapeHtml(id) +
        '">' +
        '<td>' +
        escapeHtml(u.email || u.emailAddress || '') +
        '</td>' +
        '<td>' +
        escapeHtml(uname(u)) +
        '</td>' +
        '<td>' +
        escapeHtml(u.uniqueIdentifier || '—') +
        '</td>' +
        '<td>' +
        escapeHtml(userRole) +
        (isAdminUser
          ? ' <span class="pill" style="color:var(--accent-2)">operator-managed</span>'
          : '') +
        '</td>' +
        '<td>' +
        escapeHtml(u.accountType || '') +
        '</td>' +
        '<td>' +
        escapeHtml(u.tenantId || '') +
        '</td>' +
        '<td>' +
        escapeHtml(u.familyRole || '') +
        '</td>' +
        '<td>' +
        seat +
        '</td>' +
        '<td class="actions">' +
        (canManage
          ? '<button type="button" data-op="editUser" data-uid="' +
            escapeHtml(id) +
            '" class="action" title="Edit account">Edit</button>'
          : '') +
        (canManage
          ? '<button type="button" data-op="assignSeat" data-uid="' +
            escapeHtml(id) +
            '" class="action" title="Assign seat (licence) type">Seat</button>'
          : '') +
        (canManage && u.seatAssigned
          ? '<button type="button" data-op="revokeSeat" data-uid="' +
            escapeHtml(id) +
            '" class="action actionDel" title="Revoke seat token">Revoke seat</button>'
          : '') +
        '<button type="button" data-op="userGroups" data-uid="' +
        escapeHtml(id) +
        '" class="action" title="Group memberships">Groups</button>' +
        (canManage
          ? '<button type="button" data-op="resetUser" data-uid="' +
            escapeHtml(id) +
            '" class="action" title="Reset password">Reset pwd</button>'
          : '') +
        (canManage
          ? '<button type="button" data-op="reset2FA" data-uid="' +
            escapeHtml(id) +
            '" class="action" title="Clear user\'s 2FA so they can re-enroll">Reset 2FA</button>'
          : '') +
        (canManage
          ? '<button type="button" data-op="delUser" data-uid="' +
            escapeHtml(id) +
            '" class="action actionDel" title="Delete account">Delete</button>'
          : '') +
        '</td></tr>'
      );
    })
    .join('');
  el.innerHTML =
    '<table class="dataTable"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
}

function renderRoles() {
  const el = document.getElementById('rolesTable');
  if (!el) return;
  /* Only operators may create or modify roles */
  const createBtn = document.getElementById('rolesCreateBtn');
  if (createBtn) createBtn.style.display = S.isOperator ? '' : 'none';
  if (!S.roles.length) {
    el.innerHTML = '<p class="empty">No roles.</p>';
    return;
  }
  const head = '<tr><th>Name</th><th>Description</th><th class="thActions">Actions</th></tr>';
  const body = S.roles
    .map((r) => {
      const name = r.name || r._id || '';
      const desc = r.description || '';
      const sys = name === 'ADMIN' || name === 'USER' || name === 'ERROR';
      /* Tenant admins see only the Members button; operators get Edit and Delete */
      const manageButtons = S.isOperator
        ? '<button type="button" data-op="editRole" data-role="' +
          escapeHtml(name) +
          '" class="action" title="Edit">Edit</button>' +
          (sys
            ? ''
            : '<button type="button" data-op="delRole" data-role="' +
              escapeHtml(name) +
              '" class="action actionDel" title="Delete">Delete</button>')
        : '';
      return (
        '<tr data-role="' +
        escapeHtml(name) +
        '">' +
        '<td>' +
        escapeHtml(name) +
        (sys ? ' <span class="pill">system</span>' : '') +
        '</td>' +
        '<td>' +
        escapeHtml(truncate(desc, 70)) +
        '</td>' +
        '<td class="actions">' +
        manageButtons +
        '<button type="button" data-op="roleMembers" data-role="' +
        escapeHtml(name) +
        '" class="action" title="Members">Members</button>' +
        '</td></tr>'
      );
    })
    .join('');
  el.innerHTML =
    '<table class="dataTable"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
}

function renderGroups() {
  const el = document.getElementById('groupsTable');
  if (!el) return;
  /* Hide "Create group" for tenant admins — only operators may create groups */
  const createBtn = document.getElementById('groupsCreateBtn');
  if (createBtn) createBtn.style.display = S.isOperator ? '' : 'none';
  if (!S.groups.length) {
    el.innerHTML = '<p class="empty">No groups.</p>';
    return;
  }
  const head =
    '<tr><th>Name</th><th>Seat type</th><th>Description</th><th>Source</th><th>Members</th><th class="thActions">Actions</th></tr>';
  const body = S.groups
    .map((g) => {
      const id = g._id || g.id || '';
      /* Tenant admins may only view member lists, not edit/delete groups */
      const manageButtons = S.isOperator
        ? '<button type="button" data-op="editGroup" data-gid="' +
          escapeHtml(id) +
          '" class="action" title="Edit">Edit</button>' +
          '<button type="button" data-op="delGroup" data-gid="' +
          escapeHtml(id) +
          '" class="action actionDel" title="Delete">Delete</button>'
        : '';
      return (
        '<tr data-gid="' +
        escapeHtml(id) +
        '">' +
        '<td>' +
        escapeHtml(g.name || '') +
        '</td>' +
        '<td>' +
        (g.accountType
          ? '<span class="badge">' + escapeHtml(g.accountType) + '</span>'
          : '<span class="muted">—</span>') +
        '</td>' +
        '<td>' +
        escapeHtml(truncate(g.description || '', 70)) +
        '</td>' +
        '<td>' +
        escapeHtml(g.source || '') +
        '</td>' +
        '<td>' +
        escapeHtml(String((g.memberIds || []).length || g.memberCount || 0)) +
        '</td>' +
        '<td class="actions">' +
        manageButtons +
        '<button type="button" data-op="groupMembers" data-gid="' +
        escapeHtml(id) +
        '" class="action" title="Members">Members</button>' +
        '</td></tr>'
      );
    })
    .join('');
  el.innerHTML =
    '<table class="dataTable"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
}

function renderGrants() {
  const el = document.getElementById('grantsTable');
  if (!el) return;
  if (!S.grants.length) {
    el.innerHTML = '<p class="empty">No grants.</p>';
    return;
  }
  const head =
    '<tr><th>Principal type</th><th>Principal id</th><th>Capability</th><th class="thActions">Actions</th></tr>';
  const body = S.grants
    .map((g) => {
      const pt = g.principalType || '';
      const pid = g.principalId || '';
      const cap = g.capability || '';
      return (
        '<tr data-pt="' +
        escapeHtml(pt) +
        '" data-pid="' +
        escapeHtml(pid) +
        '" data-cap="' +
        escapeHtml(cap) +
        '">' +
        '<td>' +
        escapeHtml(pt) +
        '</td>' +
        '<td>' +
        escapeHtml(String(pid)) +
        '</td>' +
        '<td>' +
        escapeHtml(cap) +
        '</td>' +
        '<td class="actions">' +
        '<button type="button" data-op="revoke" data-pt="' +
        escapeHtml(pt) +
        '" data-pid="' +
        escapeHtml(pid) +
        '" data-cap="' +
        escapeHtml(cap) +
        '" class="action actionDel" title="Revoke">Revoke</button>' +
        '</td></tr>'
      );
    })
    .join('');
  el.innerHTML =
    '<table class="dataTable"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
}

function renderEffective() {
  const el = document.getElementById('grantsEffective');
  if (!el) return;
  const caps = S.effective.length ? S.effective : [];
  el.innerHTML =
    '<div class="effCaps">' +
    (caps.length
      ? '<span class="hint">Your effective capabilities: </span>' +
        caps.map((c) => '<span class="pill cap">' + escapeHtml(c) + '</span>').join('')
      : '<span class="hint">No effective additional capabilities.</span>') +
    '</div>';
  populateGrantsAssign();
}

function updateGrantPrincipalInputs() {
  const type = (document.getElementById('grantPrincipalType') || {}).value || 'role';
  const show = (id, on) => {
    const el = document.getElementById(id);
    if (el) el.style.display = on ? '' : 'none';
  };
  show('grantRole', type === 'role');
  show('grantGroup', type === 'group');
  show('grantUserId', type === 'user');
}

function populateGrantsAssign() {
  const wrap = document.getElementById('grantsAssignForm');
  if (!wrap) return;
  wrap.style.display = 'inline-flex';
  const psel = document.getElementById('grantPrincipalType');
  if (psel) {
    /* Only an operator may target group/user principals; a tenant admin is
     * limited to roles, and the server enforces the same boundary. */
    psel.innerHTML = (
      S.isOperator
        ? [
            ['role', 'role'],
            ['group', 'group'],
            ['user', 'user'],
          ]
        : [['role', 'role']]
    )
      .map(([v, t]) => '<option value="' + v + '">' + t + '</option>')
      .join('');
    psel.value = 'role';
  }
  const rsel = document.getElementById('grantRole');
  if (rsel) {
    rsel.innerHTML = '<option value="">role…</option>';
    S.roles.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = encodeURIComponent(r.name || r._id || '');
      opt.textContent = r.name || r._id || '';
      rsel.appendChild(opt);
    });
  }
  const gsel = document.getElementById('grantGroup');
  if (gsel) {
    gsel.innerHTML = '<option value="">group…</option>';
    S.groups.forEach((g) => {
      const gid = g._id || g.id || '';
      const opt = document.createElement('option');
      opt.value = encodeURIComponent(gid);
      opt.textContent = g.name || gid;
      gsel.appendChild(opt);
    });
  }
  const csel = document.getElementById('grantCap');
  if (csel) {
    csel.innerHTML = '<option value="">capability…</option>';
    CAPS.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      csel.appendChild(opt);
    });
  }
  const tInput = document.getElementById('grantTenantId');
  if (tInput) {
    tInput.style.display = S.isOperator ? '' : 'none';
    tInput.placeholder = 'target tenant (blank = your own)';
  }
  const pBtn = document.getElementById('provisionTenantAdminBtn');
  if (pBtn) pBtn.style.display = S.isOperator ? '' : 'none';
  updateGrantPrincipalInputs();
}

/* ---------- action handlers ---------- */
async function resetUserPassword(u) {
  const id = uid(u);
  const vals = await formModal(
    'Reset password for ' + (u.email || uname(u)),
    [
      { key: 'newPassword', label: 'New password', type: 'password', required: true },
      { key: 'confirm', label: 'Confirm new password', type: 'password', required: true },
    ],
    'Reset password',
    {},
    (v) => {
      if (!v.newPassword || v.newPassword.length < 8) {
        return { ok: false, error: 'Password must be at least 8 characters.' };
      }
      if (v.newPassword !== v.confirm) {
        return { ok: false, error: 'Passwords do not match.' };
      }
      return { ok: true };
    },
  );
  if (!vals) return;
  const res = await apiAdmin('/users/' + encodeURIComponent(id) + '/reset-password', {
    method: 'POST',
    body: JSON.stringify({ newPassword: vals.newPassword }),
  });
  if (res.ok) {
    toast('Password reset. The user must sign in again.', 'ok');
  } else {
    toast('Reset failed: ' + ((res.json && res.json.error) || `HTTP ${res.status}`), 'err');
  }
}

async function deleteUser(u) {
  const id = uid(u);
  const ok = await confirmDialog(
    'Delete user ' + escapeHtml(u.email || uname(u)) + '? This cannot be undone.',
  );
  if (!ok) return;
  const res = await apiAdmin('/users/' + encodeURIComponent(id), { method: 'DELETE' });
  if (res.ok) {
    toast('User deleted.', 'ok');
    await Promise.all([loadUsers(), loadGroups()]);
  } else {
    toast('Delete failed: ' + ((res.json && res.json.error) || `HTTP ${res.status}`), 'err');
  }
}

async function reset2FA(u) {
  const id = uid(u);
  const label = escapeHtml(u.email || uname(u));
  if (!u.twoFactorEnabled) {
    toast(label + ' does not have 2FA enabled — nothing to reset.', 'info');
    return;
  }
  const ok = await confirmDialog(
    'Clear 2FA for ' + label + '? They will be prompted to re-enroll on next login.',
  );
  if (!ok) return;
  const res = await apiAdmin('/users/' + encodeURIComponent(id) + '/2fa', { method: 'DELETE' });
  if (res.ok) {
    toast('2FA cleared for ' + label + '. User must re-enroll.', 'ok');
    await loadUsers();
  } else {
    toast('Reset 2FA failed: ' + ((res.json && res.json.error) || `HTTP ${res.status}`), 'err');
  }
}

async function createUser() {  /* Tenant admins may only create USER-role accounts — ADMIN is operator-only */
  const roleOptions = S.isOperator
    ? [
        { label: 'USER (Standard)', value: 'USER' },
        { label: 'ADMIN (Tenant Admin)', value: 'ADMIN' },
      ]
    : [{ label: 'USER (Standard)', value: 'USER' }];

  await formModal(
    'Create User Account',
    [
      {
        key: 'email',
        label: 'Email Address (Used for Login)',
        type: 'email',
        required: true,
        placeholder: 'user@example.com',
      },
      {
        key: 'password',
        label: 'Initial Password (Leave blank to auto-generate temporary password)',
        type: 'password',
        placeholder: 'Min. 8 characters (or leave blank for auto-generated)',
      },
      {
        key: 'name',
        label: 'Full Name',
        type: 'text',
        placeholder: 'e.g. John Doe (Optional: defaults to email prefix)',
      },
      {
        key: 'idCategory',
        label: 'Community / Organization Identifier Type',
        type: 'select',
        options: [
          { label: 'School / University (Permanent Student ID / Admission No.)', value: 'school' },
          { label: 'Residential Society / RWA (Tower & Flat / Plot No.)', value: 'rwa' },
          { label: 'Corporate / Business (Employee ID)', value: 'corporate' },
          { label: 'Hospital / Healthcare (Staff / Medical ID)', value: 'healthcare' },
          { label: 'Other / General Unique Reference', value: 'other' },
        ],
        hint: 'Select the identifier format pattern appropriate for your organization or community.',
      },
      {
        key: 'uniqueIdentifier',
        label: 'Unique Identifier',
        type: 'text',
        placeholder: 'e.g. SCH-2024-0482 (School) | Tower A - Flat 402 (RWA) | EMP-1082 (Corporate)',
        hint: 'For schools: use permanent admission ID (independent of yearly class/division progression). For RWA: Tower/Block + Flat.',
      },
      {
        key: 'role',
        label: 'Role',
        type: 'select',
        options: roleOptions,
      },
      {
        key: 'accountType',
        label: 'Account Tier / License',
        type: 'select',
        options: ACCOUNT_TYPES,
      },
      {
        key: 'familyRole',
        label: 'Family Bundle Membership (For Family / Pro_Family Tier)',
        type: 'select',
        options: FAMILY_ROLE_OPTIONS,
        hint: 'Select "Family Bundle Primary" for the main head account, or "Family Member" for pooled accounts.',
      },
      {
        key: 'mustChangePassword',
        label: 'Require password change at first sign-in',
        type: 'select',
        value: 'true',
        options: [
          { label: 'yes (recommended when using temporary passwords)', value: 'true' },
          { label: 'no (permanent password)', value: 'false' },
        ],
      },
      {
        key: 'quota',
        label: 'Initial Token Quota',
        type: 'number',
        value: '100000',
        disabled: true,
        hint: 'Managed automatically by One-API Seat Policy for the selected Tier.',
      },
    ],
    'Provision Account',
    { quota: '100000', mustChangePassword: 'true' },
    async (v) => {
      if (!v.email || !v.email.trim())
        return { ok: false, error: 'A valid email address is required.' };
      const emailPattern = /^\S+@\S+\.\S+$/;
      if (!emailPattern.test(v.email.trim()))
        return { ok: false, error: 'Please enter a valid email address (e.g. user@domain.com).' };
      if (v.password && v.password.trim() && v.password.trim().length < 8) {
        return { ok: false, error: 'Password must be at least 8 characters long.' };
      }
      const payload = {
        name: v.name?.trim() || undefined,
        email: v.email.trim(),
        uniqueIdentifier: v.uniqueIdentifier?.trim() || undefined,
        role: v.role,
        quota: v.quota,
        accountType: v.accountType || undefined,
        familyRole: v.familyRole || undefined,
        mustChangePassword: v.mustChangePassword === 'true',
      };
      if (v.password && v.password.trim()) {
        payload.password = v.password.trim();
      }
      const res = await apiAdmin('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const u = res.json?.user;
        const tempPwd = u?.tempPassword || res.json?.temporaryPassword;
        const msg = payload.password
          ? `Account provisioned for ${v.email.trim()} with specified password.`
          : `Account provisioned. Temporary password: ${tempPwd}`;
        toast(msg, 'ok', 12000);
        await Promise.all([loadUsers(), loadGroups()]);
        return { ok: true };
      }
      return { ok: false, error: (res.json && res.json.error) || `HTTP ${res.status}` };
    },
  );
}

async function editUser(u) {
  const id = uid(u);
  /* Tenant admins can only assign USER role — ADMIN role changes are operator-only */
  const editRoleOptions = S.isOperator
    ? [
        { label: 'USER (Standard)', value: 'USER' },
        { label: 'ADMIN (Tenant Admin)', value: 'ADMIN' },
      ]
    : [{ label: 'USER (Standard)', value: 'USER' }];

  await formModal(
    'Edit ' + (u.email || uname(u)),
    [
      { key: 'email', label: 'Email Address', type: 'email', value: u.email || '', required: true },
      {
        key: 'password',
        label: 'New Password (Leave blank to keep current password)',
        type: 'password',
        placeholder: 'Min. 8 characters (or leave empty to keep existing)',
      },
      { key: 'name', label: 'Full Name', type: 'text', value: u.name || '' },
      {
        key: 'idCategory',
        label: 'Community / Organization Identifier Type',
        type: 'select',
        options: [
          { label: 'School / University (Permanent Student ID / Admission No.)', value: 'school' },
          { label: 'Residential Society / RWA (Tower & Flat / Plot No.)', value: 'rwa' },
          { label: 'Corporate / Business (Employee ID)', value: 'corporate' },
          { label: 'Hospital / Healthcare (Staff / Medical ID)', value: 'healthcare' },
          { label: 'Other / General Unique Reference', value: 'other' },
        ],
      },
      {
        key: 'uniqueIdentifier',
        label: 'Unique Identifier',
        type: 'text',
        value: u.uniqueIdentifier || '',
        placeholder: 'e.g. SCH-2024-0482 (School) | Tower A - Flat 402 (RWA) | EMP-1082 (Corporate)',
        hint: 'Permanent student admission number across years, Tower/Flat, or Employee ID.',
      },
      {
        key: 'role',
        label: 'Role',
        type: 'select',
        value: u.role || 'USER',
        options: editRoleOptions,
      },
      {
        key: 'accountType',
        label: 'Account Tier / License',
        type: 'select',
        value: u.accountType || '',
        options: ACCOUNT_TYPES,
      },
      {
        key: 'familyRole',
        label: 'Family Bundle Membership (For Family / Pro_Family Tier)',
        type: 'select',
        value: u.familyRole || '',
        options: FAMILY_ROLE_OPTIONS,
      },
      {
        key: 'mustChangePassword',
        label: 'Require password change at next sign-in',
        type: 'select',
        value: String(!!u.mustChangePassword),
        options: [
          { label: 'no', value: 'false' },
          { label: 'yes', value: 'true' },
        ],
      },
    ],
    'Save changes',
    {},
    async (v) => {
      if (v.password && v.password.trim() && v.password.trim().length < 8) {
        return { ok: false, error: 'New password must be at least 8 characters long.' };
      }
      const payload = {
        name: v.name,
        email: v.email,
        uniqueIdentifier: v.uniqueIdentifier?.trim() || null,
        role: v.role,
        accountType: v.accountType || null,
        familyRole: v.familyRole || null,
        mustChangePassword: v.mustChangePassword === 'true',
      };
      if (v.password && v.password.trim()) {
        payload.password = v.password.trim();
      }
      const res = await apiAdmin('/users/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast('User updated successfully' + (payload.password ? ' (password changed)' : ''), 'ok');
        await loadUsers();
        return { ok: true };
      }
      return { ok: false, error: (res.json && res.json.error) || `HTTP ${res.status}` };
    },
  );
}

async function assignSeat(u) {
  await formModal(
    'Assign seat — ' + (u.email || uname(u)),
    [
      {
        key: 'accountType',
        label: 'Seat type (licence)',
        type: 'select',
        options: seatTypeOptions(u.accountType || ''),
      },
    ],
    'Assign',
    {},
    async (v) => {
      if (!v.accountType) return { ok: false, error: 'Pick a seat type.' };
      const res = await apiAdmin('/users/' + encodeURIComponent(uid(u)) + '/seat-token', {
        method: 'POST',
        body: JSON.stringify({ accountType: v.accountType }),
      });
      if (res.ok) {
        toast('Seat assigned: ' + v.accountType, 'ok');
        await Promise.all([loadUsers(), loadGroups()]);
        return { ok: true };
      }
      return { ok: false, error: (res.json && res.json.error) || `HTTP ${res.status}` };
    },
  );
}

async function revokeSeat(u) {
  const ok = await confirmDialog(
    "Revoke this user's seat token? Their requests will fall back to the shared gateway credential.",
  );
  if (!ok) return;
  const res = await apiAdmin('/users/' + encodeURIComponent(uid(u)) + '/seat-token', {
    method: 'DELETE',
  });
  if (res.ok) {
    toast('Seat revoked.', 'ok');
    await Promise.all([loadUsers(), loadGroups()]);
  } else {
    toast((res.json && res.json.error) || `HTTP ${res.status}`, 'err');
  }
}

async function userGroups(u) {
  const id = uid(u);
  const res = await apiAdmin('/users/' + encodeURIComponent(id) + '/groups');
  if (!res.ok) {
    toast(`Failed to load group memberships (HTTP ${res.status})`, 'err');
    return;
  }
  const groups = res.json?.groups || [];
  const html = groups.length
    ? '<ul class="memberList">' +
      groups
        .map(
          (g) =>
            '<li>' +
            escapeHtml(g.name || '') +
            (g.description ? ' — ' + escapeHtml(truncate(g.description, 60)) : '') +
            '</li>',
        )
        .join('') +
      '</ul>'
    : '<p class="hint">No group memberships.</p>';
  Modal.show(
    'Groups for ' + (u.email || uname(u)),
    (b) => {
      b.innerHTML = html;
    },
    (f) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost';
      btn.textContent = 'Close';
      btn.addEventListener('click', () => Modal.close());
      f.appendChild(btn);
    },
  );
}

/** Operator-only: grants a tenant's ADMIN role the tenant-scoped admin surface. */
async function provisionTenantAdmin() {
  await formModal(
    'Provision tenant administrator',
    [
      { key: 'tenantId', label: 'Tenant id (e.g. hgrwa)', type: 'text', required: true },
      { key: 'roleName', label: 'Role to grant (default ADMIN)', type: 'text', value: 'ADMIN' },
    ],
    'Provision',
    { roleName: 'ADMIN' },
    async (v) => {
      if (!v.tenantId || !v.tenantId.trim()) return { ok: false, error: 'Tenant id is required.' };
      const res = await apiAdmin('/grants/tenant-admin', {
        method: 'POST',
        body: JSON.stringify({ tenantId: v.tenantId.trim(), roleName: v.roleName || 'ADMIN' }),
      });
      if (res.ok) {
        toast(
          `Tenant admin provisioned for "${v.tenantId.trim()}" (access:admin + user/group/role management).`,
          'ok',
          9000,
        );
        await loadGrants();
        await loadEffective();
        return { ok: true };
      }
      return { ok: false, error: (res.json && res.json.error) || `HTTP ${res.status}` };
    },
  );
}

/**
 * Rows posted per request. Comfortably under the server's 500-row batch limit,
 * so one request never has to hash thousands of passwords before responding.
 */
const BULK_CHUNK_SIZE = 200;

/** Browser-side CSV parse, mirroring the server's column handling. */
function parseRosterCsv(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < 2 || !cols[1]) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || '';
    });
    rows.push(row);
  }
  return rows;
}

function setBulkProgress(done, total, created, skipped) {
  const bar = document.getElementById('bulkProgressBar');
  const el = document.getElementById('bulkProgress');
  const text = document.getElementById('bulkProgressText');
  if (bar) bar.hidden = false;
  if (el) {
    el.max = total;
    el.value = done;
  }
  if (text) {
    text.textContent = `Importing ${done}/${total} — ${created} created, ${skipped} skipped`;
  }
}

function hideBulkProgress() {
  const bar = document.getElementById('bulkProgressBar');
  if (bar) bar.hidden = true;
}

/** CSV writer that escapes embedded quotes and commas. */
function toCsv(headers, rows, pick) {
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(',')]
    .concat(rows.map((row) => headers.map((h) => cell(pick(row, h))).join(',')))
    .join('\n');
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCredentialSlips(slips) {
  const map = {
    name: 'name',
    email: 'email',
    role: 'role',
    account_type: 'accountType',
    group: 'group',
    tempPassword: 'tempPassword',
  };
  downloadCsv(
    `credential_slips_${Date.now()}.csv`,
    toCsv(Object.keys(map), slips, (row, key) => row[map[key]]),
  );
}

/**
 * Run a parsed roster in chunks, reporting progress and never failing silently.
 *
 * A partial import is the dangerous outcome here — a registrar who sees nothing
 * cannot tell which students were created. So on a mid-way failure this reports
 * how many rows landed, downloads the slips for those, and stops.
 */
async function runBulkImport(rows) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += BULK_CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + BULK_CHUNK_SIZE));
  }

  let created = 0;
  let skippedCount = 0;
  const slips = [];
  const skippedRows = [];
  setBulkProgress(0, rows.length, 0, 0);

  for (let i = 0; i < chunks.length; i++) {
    const res = await apiAdmin('/users/bulk', {
      method: 'POST',
      body: JSON.stringify({ users: chunks[i] }),
    });

    if (!res.ok) {
      const detail = (res.json && res.json.error) || `HTTP ${res.status}`;
      hideBulkProgress();
      toast(`Import stopped at row ${i * BULK_CHUNK_SIZE + 1}: ${detail}`, 'err', 12000);
      if (created > 0) {
        toast(`Imported ${created} row(s) before stopping.`, 'info', 12000);
        downloadCredentialSlips(slips);
      }
      await loadUsers();
      return;
    }

    const data = res.json || {};
    created += data.createdCount || 0;
    skippedCount += data.skippedCount || 0;
    if (Array.isArray(data.slips)) slips.push(...data.slips);
    if (Array.isArray(data.skipped)) skippedRows.push(...data.skipped);
    setBulkProgress(
      Math.min(rows.length, (i + 1) * BULK_CHUNK_SIZE),
      rows.length,
      created,
      skippedCount,
    );
  }

  hideBulkProgress();
  toast(`Bulk import complete — ${created} created, ${skippedCount} skipped.`, 'ok', 10000);
  if (slips.length) downloadCredentialSlips(slips);
  /* A skip list is what a registrar needs to fix and re-upload a roster. */
  if (skippedRows.length) {
    downloadCsv(
      `skipped_rows_${Date.now()}.csv`,
      toCsv(['email', 'reason'], skippedRows, (row, key) => row[key]),
    );
  }
  await loadUsers();
}

async function bulkImportUsers() {
  const body = document.createElement('div');
  body.innerHTML =
    '<div class="modalField"><label for="bulkCsv">CSV roster (columns: name,email,role,account_type,group,quota)</label>' +
    '<textarea id="bulkCsv" rows="10" placeholder="name,email,role,account_type,group,quota&#10;John Doe,john.doe@school.edu,USER,basic,Grade-10,100000"></textarea></div>' +
    `<p class="hint">Rows are uploaded in batches of ${BULK_CHUNK_SIZE}, so a large roster reports progress instead of timing out.</p>`;

  const foot = document.createElement('div');
  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'btn btn-primary';
  start.textContent = 'Start import';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn-ghost';
  cancel.textContent = 'Cancel';
  foot.appendChild(start);
  foot.appendChild(cancel);

  Modal.show('Bulk CSV Roster Import', body, foot);

  cancel.addEventListener('click', () => Modal.close());
  start.addEventListener('click', async () => {
    const raw = (document.getElementById('bulkCsv') || {}).value || '';
    if (!raw.trim()) {
      toast('Paste a CSV roster first.', 'err');
      return;
    }
    const rows = parseRosterCsv(raw);
    if (!rows.length) {
      toast('No data rows found in that CSV.', 'err');
      return;
    }
    Modal.close();
    await runBulkImport(rows);
  });
}

async function downloadTemplate() {
  try {
    const res = await API('/api/admin/users/csv-template');
    if (!res.ok) {
      toast(`Failed to download template: HTTP ${res.status}`, 'err');
      return;
    }
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'satchida_user_roster_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Downloaded template.', 'ok');
  } catch (err) {
    toast(`Download failed: ${err.message}`, 'err');
  }
}

function editRole(name) {
  const r = S.roles.find((x) => (x.name || x._id) === name) || { name, description: '' };
  formModal(
    'Edit role',
    [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    'Save',
    { name: r.name, description: r.description || '' },
    async (v) => {
      if (!v.name || !v.name.trim()) return { ok: false, error: 'Name is required.' };
      const res = await apiAdmin('/roles/' + encodeURIComponent(name), {
        method: 'PATCH',
        body: JSON.stringify({ name: v.name.trim(), description: v.description || '' }),
      });
      if (res.ok) {
        await loadRoles();
        await refreshDependents();
        return { ok: true };
      }
      return { ok: false, error: (res.json && res.json.error) || `HTTP ${res.status}` };
    },
  );
}

async function createRole() {
  await formModal(
    'Create role',
    [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
    'Create',
    {},
    async (v) => {
      if (!v.name || !v.name.trim()) return { ok: false, error: 'Name is required.' };
      const res = await apiAdmin('/roles', {
        method: 'POST',
        body: JSON.stringify({ name: v.name.trim(), description: v.description || '' }),
      });
      if (res.ok) {
        await loadRoles();
        await refreshDependents();
        return { ok: true };
      }
      return { ok: false, error: (res.json && res.json.error) || `HTTP ${res.status}` };
    },
  );
}

async function deleteRole(name) {
  const ok = await confirmDialog(
    'Delete role "' + escapeHtml(name) + '"? Members will be unaffected (role is detached).',
  );
  if (!ok) return;
  const res = await apiAdmin('/roles/' + encodeURIComponent(name), { method: 'DELETE' });
  if (res.ok) {
    toast('Role deleted.', 'ok');
    await loadRoles();
    await refreshDependents();
  } else {
    toast('Delete failed: ' + ((res.json && res.json.error) || `HTTP ${res.status}`), 'err');
  }
}

async function roleMembers(name) {
  /* fetch members for this role */
  const res = await apiAdmin('/roles/' + encodeURIComponent(name) + '/members');
  const members = normalizeList(res);

  let html = '';
  if (!members.length) {
    html = '<p class="empty">No members assigned to role "' + escapeHtml(name) + '".</p>';
  } else {
    html =
      '<table class="dataTable"><thead><tr><th>User</th><th>Email</th><th class="thActions">Actions</th></tr></thead><tbody>';
    html += members
      .map((u) => {
        const id = uid(u);
        return (
          '<tr data-uid="' +
          escapeHtml(id) +
          '">' +
          '<td>' +
          escapeHtml(uname(u)) +
          '</td>' +
          '<td>' +
          escapeHtml(u.email || '') +
          '</td>' +
          '<td class="actions"><button type="button" data-op="removeRoleMember" data-name="' +
          escapeHtml(name) +
          '" data-uid="' +
          escapeHtml(id) +
          '" class="action actionDel">Remove</button></td></tr>'
        );
      })
      .join('');
    html += '</tbody></table>';
  }

  Modal.show(
    'Members of role "' + escapeHtml(name) + '"',
    (b) => {
      b.innerHTML = html;
    },
    (f) => {
      f.innerHTML =
        '<button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>';
    },
  );

  // delegated listener for remove
  const wrap = document.querySelector('#satchidaModalWrap .satchidaModalBody');
  if (wrap && !wrap.__boundRoleRemove) {
    wrap.__boundRoleRemove = true;
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-op="removeRoleMember"]');
      if (!b) return;
      const n = b.dataset.name,
        uidv = b.dataset.uid;
      (async () => {
        const res = await apiAdmin(
          '/roles/' + encodeURIComponent(n) + '/members/' + encodeURIComponent(uidv),
          { method: 'DELETE' },
        );
        if (res.ok) {
          toast('Member removed.', 'ok');
          await roleMembers(n);
        } else {
          toast('Remove failed: ' + ((res.json && res.json.error) || 'HTTP ' + res.status), 'err');
        }
      })();
    });
  }
}

async function refreshDependents() {
  // roles/grants may reference each other; keep selects fresh
  populateGrantsAssign();
}

// Seat/licence types — mirrors One-API's TENANT_ACCOUNT_TYPES catalogue
// (packages/data-schemas/src/types/entitlement.ts). A group carrying one of
// these is a licensed seat type: every member of the group holds that account
// type, which is what the operator's policy and billing enforce.
const SEAT_TYPES = ['basic', 'standard', 'family', 'pro', 'pro_family', 'enterprise', 'privacy'];

function seatTypeOptions(current) {
  return [{ value: '', label: '— none (plain group) —' }]
    .concat(
      SEAT_TYPES.map(function (t) {
        return { value: t, label: t };
      }),
    )
    .map(function (o) {
      return {
        value: o.value,
        label: o.label,
        selected: String(o.value) === String(current || ''),
      };
    });
}

async function createGroup() {
  const fields = [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
  ];
  if (S.isOperator) {
    fields.push({
      key: 'accountType',
      label: 'Seat type (licence)',
      type: 'select',
      options: seatTypeOptions(''),
    });
  }
  fields.push(
    { key: 'shared', label: 'Shared seat budget (family-style pooling)', type: 'checkbox' },
    { key: 'localPrivacyEnabled', label: 'Local Privacy mode allowed', type: 'checkbox' },
  );

  await formModal(
    'Create group',
    fields,
    'Create',
    {},
    async (v) => {
      if (!v.name || !v.name.trim()) return { ok: false, error: 'Name is required.' };
      const body = { name: v.name.trim(), description: v.description || '' };
      if (S.isOperator && v.accountType) body.accountType = v.accountType;
      body.shared = v.shared === 'on';
      body.localPrivacyEnabled = v.localPrivacyEnabled === 'on';
      const res = await apiAdmin('/groups', { method: 'POST', body: JSON.stringify(body) });
      if (res.ok) {
        await loadGroups();
        return { ok: true };
      }
      return { ok: false, error: (res.json && res.json.error) || `HTTP ${res.status}` };
    },
  );
}

function editGroup(id) {
  const g = S.groups.find((x) => (x._id || x.id) === id) || { name: '', description: '' };
  const fields = [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
  ];
  if (S.isOperator) {
    fields.push({
      key: 'accountType',
      label: 'Seat type (licence)',
      type: 'select',
      options: seatTypeOptions(g.accountType || ''),
    });
  } else {
    fields.push({
      key: 'accountType',
      label: 'Seat type (licence) — Operator managed',
      type: 'text',
      value: g.accountType || 'none',
      disabled: true,
      hint: 'Only the platform operator may modify seat licence types on groups.',
    });
  }
  fields.push(
    { key: 'shared', label: 'Shared seat budget (family-style pooling)', type: 'checkbox' },
    { key: 'localPrivacyEnabled', label: 'Local Privacy mode allowed', type: 'checkbox' },
  );

  formModal(
    'Edit group',
    fields,
    'Save',
    {
      name: g.name || '',
      description: g.description || '',
      accountType: g.accountType || '',
      shared: !!g.shared,
      localPrivacyEnabled: !!g.localPrivacyEnabled,
    },
    async (v) => {
      if (!v.name || !v.name.trim()) return { ok: false, error: 'Name is required.' };
      const body = { name: v.name.trim(), description: v.description || '' };
      if (S.isOperator) {
        body.accountType = v.accountType || null;
      }
      body.shared = v.shared === 'on';
      body.localPrivacyEnabled = v.localPrivacyEnabled === 'on';
      const res = await apiAdmin('/groups/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await loadGroups();
        return { ok: true };
      }
      return { ok: false, error: (res.json && res.json.error) || `HTTP ${res.status}` };
    },
  );
}

async function deleteGroup(id) {
  const ok = await confirmDialog('Delete group?');
  if (!ok) return;
  const res = await apiAdmin('/groups/' + encodeURIComponent(id), { method: 'DELETE' });
  if (res.ok) {
    toast('Group deleted.', 'ok');
    await loadGroups();
  } else toast('Delete failed: ' + ((res.json && res.json.error) || `HTTP ${res.status}`), 'err');
}

async function groupMembers(id) {
  const res = await apiAdmin('/groups/' + encodeURIComponent(id) + '/members');
  const members = normalizeList(res);
  let html =
    '<table class="dataTable"><thead><tr><th>User</th><th>Email</th><th class="thActions">Actions</th></tr></thead><tbody>';
  if (members.length) {
    html += members
      .map((u) => {
        const uidv = uid(u);
        return (
          '<tr data-uid="' +
          escapeHtml(uidv) +
          '">' +
          '<td>' +
          escapeHtml(uname(u)) +
          '</td>' +
          '<td>' +
          escapeHtml(u.email || '') +
          '</td>' +
          '<td class="actions"><button type="button" data-op="removeGroupMember" data-gid="' +
          escapeHtml(id) +
          '" data-uid="' +
          escapeHtml(uidv) +
          '" class="action actionDel">Remove</button></td></tr>'
        );
      })
      .join('');
  } else {
    html += '<tr><td colspan="3" class="empty">No members.</td></tr>';
  }
  html += '</tbody></table>';
  // add member form row — tenant admins only see USER-role users (not ADMIN-role)
  const eligibleUsers = S.isOperator
    ? S.users
    : S.users.filter((u) => (u.role || u.roleName || '') !== 'ADMIN');
  // also check if this is the admin group — tenant admins must NOT add users to it
  const grp = S.groups.find((x) => (x._id || x.id) === id);
  const groupName = grp?.name ? `"${grp.name}"` : id;
  const isAdminGroup = (grp?.name || '').toLowerCase() === 'admin';
  const canAddMembers = S.isOperator || !isAdminGroup;

  if (canAddMembers) {
    html +=
      '<div class="modalField" style="margin-top:12px"><label for="addGroupMember">Add member</label>' +
      '<select id="addGroupMember"><option value="">select a user…</option>' +
      eligibleUsers
        .map(
          (u) =>
            '<option value="' +
            escapeHtml(uid(u)) +
            '">' +
            escapeHtml(uname(u) + ' (' + (u.email || '') + ')') +
            '</option>',
        )
        .join('') +
      '</select></div>';
  } else {
    html +=
      '<p class="hint" style="margin-top:12px;color:var(--accent-2)">⚠ Adding members to the admin group requires operator access.</p>';
  }

  const title = 'Members of group ' + groupName;
  Modal.show(
    title,
    (b) => {
      b.innerHTML = html;
    },
    (f) => {
      f.innerHTML =
        '<button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>';
    },
  );
  const body = document.querySelector('#satchidaModalWrap .satchidaModalBody');
  if (body) {
    body.onclick = async (e) => {
      const b = e.target.closest('button[data-op]');
      if (!b) return;
      const op = b.dataset.op;
      const uidv = b.dataset.uid;
      if (op === 'removeGroupMember') {
        const res = await apiAdmin(
          '/groups/' + encodeURIComponent(b.dataset.gid) + '/members/' + encodeURIComponent(uidv),
          { method: 'DELETE' },
        );
        if (res.ok) {
          toast('Member removed.', 'ok');
          await loadGroups();
          await groupMembers(id);
        } else
          toast('Remove failed: ' + ((res.json && res.json.error) || 'HTTP ' + res.status), 'err');
      }
    };
    body.onchange = async (e) => {
      if (e.target.id === 'addGroupMember' && e.target.value) {
        const sel = e.target;
        const val = sel.value;
        sel.value = '';
        const res = await apiAdmin('/groups/' + encodeURIComponent(id) + '/members', {
          method: 'POST',
          body: JSON.stringify({ userId: val }),
        });
        if (res.ok) {
          toast('Member added.', 'ok');
          await loadGroups();
          await groupMembers(id);
        } else
          toast('Add failed: ' + ((res.json && res.json.error) || 'HTTP ' + res.status), 'err');
      }
    };
  }
}

window.closeModal = function () {
  Modal.close();
};

function grantPrincipalValue() {
  const type = (document.getElementById('grantPrincipalType') || {}).value || 'role';
  if (type === 'user') {
    const input = document.getElementById('grantUserId');
    return { principalType: 'user', principalId: input ? input.value.trim() : '' };
  }
  const sel = document.getElementById(type === 'group' ? 'grantGroup' : 'grantRole');
  const enc = sel ? sel.value : '';
  return { principalType: type, principalId: enc ? decodeURIComponent(enc) : '' };
}

async function assignGrant() {
  const { principalType, principalId } = grantPrincipalValue();
  const capSel = document.getElementById('grantCap');
  const cap = capSel ? capSel.value : '';
  const tenantInput = document.getElementById('grantTenantId');
  const tenantId = tenantInput && S.isOperator ? tenantInput.value.trim() : '';
  if (!principalId || !cap) return toast('Select a principal and a capability.', 'err');
  const body = { principalType, principalId, capability: cap };
  if (tenantId) body.tenantId = tenantId;
  const res = await apiAdmin('/grants', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res.ok) {
    toast(`Grant assigned to ${principalType} ${principalId}.`, 'ok');
    await loadGrants();
    await loadEffective();
  } else {
    toast('Assign failed: ' + ((res.json && res.json.error) || `HTTP ${res.status}`), 'err');
  }
}

async function revokeGrant(pt, pid, cap) {
  const ok = await confirmDialog('Revoke capability ' + cap + ' from ' + pt + ' "' + pid + '"?');
  if (!ok) return;
  const res = await apiAdmin(
    '/grants/' +
      encodeURIComponent(pt) +
      '/' +
      encodeURIComponent(pid) +
      '/' +
      encodeURIComponent(cap),
    { method: 'DELETE' },
  );
  if (res.ok) {
    toast('Grant revoked.', 'ok');
    await loadGrants();
    await loadEffective();
  } else {
    toast('Revoke failed: ' + ((res.json && res.json.error) || `HTTP ${res.status}`), 'err');
  }
}

/* ---------- wiring ---------- */
function setupTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tab = btn.dataset.tab;

      /* Grants and Audit log require offline TOTP step-up before ANY data loads.
       * promptStepUpAuth() returns false if the user cancels or enrollment fails. */
      if (tab === 'grants' || tab === 'audit') {
        const ok = await promptStepUpAuth();
        if (!ok) return; // stay on current tab
      }

      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tabpanel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tab).classList.add('active');
      CURRENT = tab;

      // lazy load tabs
      if (CURRENT === 'users') loadUsers();
      if (CURRENT === 'roles') loadRoles();
      if (CURRENT === 'groups') loadGroups();
      if (CURRENT === 'grants') loadGrants();
      if (CURRENT === 'audit') loadAudit();
    });
  });
}

function attachListeners() {
  // delegated actions per table container
  document.getElementById('usersTable').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-op]');
    if (!b) return;
    const u = S.users.find((x) => uid(x) === b.dataset.uid);
    if (!u) return;
    if (b.dataset.op === 'editUser') editUser(u);
    else if (b.dataset.op === 'assignSeat') assignSeat(u);
    else if (b.dataset.op === 'revokeSeat') revokeSeat(u);
    else if (b.dataset.op === 'userGroups') userGroups(u);
    else if (b.dataset.op === 'resetUser') resetUserPassword(u);
    else if (b.dataset.op === 'reset2FA') reset2FA(u);
    else if (b.dataset.op === 'delUser') deleteUser(u);
  });
  document.getElementById('rolesTable').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-op]');
    if (!b) return;
    const name = b.dataset.role;
    if (b.dataset.op === 'editRole') editRole(name);
    else if (b.dataset.op === 'delRole') deleteRole(name);
    else if (b.dataset.op === 'roleMembers') roleMembers(name);
  });
  document.getElementById('groupsTable').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-op]');
    if (!b) return;
    const id = b.dataset.gid;
    if (b.dataset.op === 'editGroup') editGroup(id);
    else if (b.dataset.op === 'delGroup') deleteGroup(id);
    else if (b.dataset.op === 'groupMembers') groupMembers(id);
  });
  document.getElementById('grantsTable').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-op="revoke"]');
    if (!b) return;
    revokeGrant(b.dataset.pt, b.dataset.pid, b.dataset.cap);
  });

  document.getElementById('usersCreateBtn')?.addEventListener('click', createUser);
  document.getElementById('usersBulkImportBtn')?.addEventListener('click', bulkImportUsers);
  document.getElementById('usersDownloadTemplateBtn')?.addEventListener('click', downloadTemplate);
  document.getElementById('rolesCreateBtn').addEventListener('click', createRole);
  document.getElementById('groupsCreateBtn').addEventListener('click', createGroup);
  document.getElementById('grantAssignBtn').addEventListener('click', assignGrant);
  document
    .getElementById('provisionTenantAdminBtn')
    ?.addEventListener('click', provisionTenantAdmin);
  document
    .getElementById('grantPrincipalType')
    ?.addEventListener('change', updateGrantPrincipalInputs);

  /* Page-size selectors and Prev/Next for the two lists that grow with the
   * tenant. Changing page size keeps the current first row visible instead of
   * silently jumping back to the top. */
  const userSize = document.getElementById('usersPageSize');
  if (userSize) {
    userSize.value = String(S.userPage.limit);
    userSize.addEventListener('change', () => {
      const firstRow = S.userPage.offset;
      S.userPage.limit = Number(userSize.value) || 100;
      S.userPage.offset = Math.floor(firstRow / S.userPage.limit) * S.userPage.limit;
      loadUsers();
    });
  }
  document.getElementById('usersPrevBtn')?.addEventListener('click', () => {
    S.userPage.offset = Math.max(0, S.userPage.offset - S.userPage.limit);
    loadUsers();
  });
  document.getElementById('usersNextBtn')?.addEventListener('click', () => {
    S.userPage.offset += S.userPage.limit;
    loadUsers();
  });

  const groupSize = document.getElementById('groupsPageSize');
  if (groupSize) {
    groupSize.value = String(S.groupPage.limit);
    groupSize.addEventListener('change', () => {
      const firstRow = S.groupPage.offset;
      S.groupPage.limit = Number(groupSize.value) || 100;
      S.groupPage.offset = Math.floor(firstRow / S.groupPage.limit) * S.groupPage.limit;
      loadGroups();
    });
  }
  document.getElementById('groupsPrevBtn')?.addEventListener('click', () => {
    S.groupPage.offset = Math.max(0, S.groupPage.offset - S.groupPage.limit);
    loadGroups();
  });
  document.getElementById('groupsNextBtn')?.addEventListener('click', () => {
    S.groupPage.offset += S.groupPage.limit;
    loadGroups();
  });

  // live user search
  const us = document.getElementById('usersSearch');
  let t;
  if (us)
    us.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const q = us.value.trim();
        if (!q) {
          /* Returning to the list starts at the first page again. */
          S.userPage.offset = 0;
          loadUsers();
          return;
        }
        const res = await apiAdmin('/users/search?q=' + encodeURIComponent(q));
        S.users = normalizeList(res).filter((u) => uid(u));
        renderUsers();
        /* The search endpoint clamps to 50 rows. Say so — an unqualified "50
         * match(es)" reads as a complete answer on a 4,000-user tenant. */
        const capped = res.json?.capped === true;
        const c = document.getElementById('usersCount');
        if (c) {
          c.textContent = capped
            ? `first ${S.users.length} match(es) — narrow the search to see the rest`
            : `${S.users.length} match(es)`;
        }
        /* Search results are not a page of the list, so a pager would be wrong. */
        const bar = document.getElementById('usersPagerBar');
        if (bar) bar.hidden = true;
        if (!res.ok) toast(`Search failed (HTTP ${res.status})`, 'err');
      }, 350);
    });

  // User filters: Tenant, Tier, Seat
  document.getElementById('usersTenantFilter')?.addEventListener('change', renderUsers);
  document.getElementById('usersTierFilter')?.addEventListener('change', renderUsers);
  document.getElementById('usersSeatFilter')?.addEventListener('change', renderUsers);

  // Audit log filters & refresh
  let auditDebounce;
  document.getElementById('auditSearch')?.addEventListener('input', () => {
    clearTimeout(auditDebounce);
    auditDebounce = setTimeout(loadAudit, 350);
  });
  document.getElementById('auditTenantFilter')?.addEventListener('change', loadAudit);
  document.getElementById('auditCategoryFilter')?.addEventListener('change', loadAudit);
  document.getElementById('auditRefreshBtn')?.addEventListener('click', () => {
    toast('Refreshing audit log…', 'info');
    loadAudit();
  });
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await API('/api/auth/logout', { method: 'POST' });
  sessionStorage.removeItem('token');
  location.href = './login.html';
});

(async function init() {
  const { ok, json } = await apiAdmin('/verify');
  if (!ok) {
    location.href = './login.html';
    return;
  }
  const info = document.getElementById('userinfo');
  if (info)
    info.textContent = authUserEmail(json)
      ? `Signed in as ${authUserEmail(json)}`
      : 'Operator session active';

  /* The server reports the caller's authority. Inferring it from the role name
   * was both wrong for tenant admins (whose role is also ADMIN) and
   * unenforceable client-side — the per-route capabilities decide. */
  S.isOperator = Boolean(json?.isOperator);
  S.tenantId = json?.tenantId ?? null;
  if (info && S.tenantId) {
    info.textContent += ` — tenant ${S.tenantId}`;
  }

  /* Tenant admins must only manage users and group memberships —
   * Grants and Audit log are Operator-only security surfaces. */
  if (!S.isOperator) {
    const grantsTab = document.querySelector('[data-tab="grants"]');
    if (grantsTab) grantsTab.style.display = 'none';
    const auditTab = document.querySelector('[data-tab="audit"]');
    if (auditTab) auditTab.style.display = 'none';
  }

  setupTabs();
  attachListeners();

  // Ensure default active tab is explicitly set
  const initialTab = document.querySelector('.tab.active')?.dataset?.tab || 'users';
  document.querySelectorAll('.tabpanel').forEach((p) => p.classList.remove('active'));
  document.getElementById(initialTab)?.classList.add('active');

  await Promise.all([loadUsers(), loadRoles(), loadGroups(), loadEffective()]);
})();

function authUserEmail(json) {
  try {
    return json?.user?.email || json?.email || '';
  } catch {
    return '';
  }
}
