const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const logoutBtn = document.getElementById('logoutBtn');
const welcomeUser = document.getElementById('welcomeUser');

const linkForm = document.getElementById('linkForm');
const linksGrid = document.getElementById('linksGrid');
const searchInput = document.getElementById('searchInput');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const vaultForm = document.getElementById('vaultForm');
const vaultGrid = document.getElementById('vaultGrid');
const vaultSearchInput = document.getElementById('vaultSearchInput');
const vaultCancelEditBtn = document.getElementById('vaultCancelEditBtn');

const keywordChips = document.getElementById('keywordChips');
const statLinks = document.getElementById('statLinks');
const statTags = document.getElementById('statTags');
const statVault = document.getElementById('statVault');
const toast = document.getElementById('toast');

const tabs = Array.from(document.querySelectorAll('.tab'));
const panels = Array.from(document.querySelectorAll('.app-panel-section'));

const STORAGE_USERS = 'linkatlas_users_v2';
const STORAGE_SESSION = 'linkatlas_session_v2';
const SESSION_DAYS = 30;

let activeUser = null;

function now() {
  return Date.now();
}

function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUsers() {
  return readJson(STORAGE_USERS, []);
}

function saveUsers(users) {
  writeJson(STORAGE_USERS, users);
}

function getUserDataKey(username) {
  return `linkatlas_data_${username}`;
}

function getUserData(username) {
  return readJson(getUserDataKey(username), { links: [], vault: [] });
}

function saveUserData(username, data) {
  writeJson(getUserDataKey(username), data);
}

function setSession(username) {
  writeJson(STORAGE_SESSION, {
    username,
    expiresAt: now() + daysToMs(SESSION_DAYS)
  });
}

function clearSession() {
  localStorage.removeItem(STORAGE_SESSION);
}

function getSessionUser() {
  const session = readJson(STORAGE_SESSION, null);
  if (!session || !session.username || !session.expiresAt) return null;
  if (now() > session.expiresAt) {
    clearSession();
    return null;
  }
  return session.username;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2200);
}

function escaped(text) {
  return String(text || '').replace(/[&<>'\"]/g, (ch) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    };
    return map[ch] || ch;
  });
}

function showPanel(panelId) {
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.panel === panelId);
  });

  panels.forEach((panel) => {
    const active = panel.id === panelId;
    panel.classList.toggle('active', active);
    panel.setAttribute('aria-hidden', String(!active));
  });
}

function toggleApp(isLogged) {
  authSection.classList.toggle('hidden', isLogged);
  appSection.classList.toggle('hidden', !isLogged);
  logoutBtn.classList.toggle('hidden', !isLogged);
  if (isLogged && activeUser) {
    welcomeUser.textContent = `Hola, ${activeUser}`;
  }
}

function buildKeywordChips(links) {
  const tagMap = new Map();

  links.forEach((item) => {
    const tags = String(item.keywords || '')
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean);

    tags.forEach((tag) => {
      const key = tag.toLowerCase();
      tagMap.set(key, (tagMap.get(key) || 0) + 1);
    });
  });

  if (tagMap.size === 0) {
    keywordChips.innerHTML = '';
    return;
  }

  const sorted = Array.from(tagMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  keywordChips.innerHTML = sorted
    .map(([tag, count]) => `<span class="pill">${escaped(tag)} (${count})</span>`)
    .join('');
}

function updateStats(data) {
  statLinks.textContent = String(data.links.length);
  statVault.textContent = String(data.vault.length);

  const uniqueTags = new Set();
  data.links.forEach((item) => {
    String(item.keywords || '')
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((tag) => uniqueTags.add(tag.toLowerCase()));
  });

  statTags.textContent = String(uniqueTags.size);
  buildKeywordChips(data.links);
}

function resetLinkForm() {
  linkForm.reset();
  document.getElementById('editingId').value = '';
  document.getElementById('saveBtn').textContent = 'Guardar enlace';
  cancelEditBtn.classList.add('hidden');
}

function resetVaultForm() {
  vaultForm.reset();
  document.getElementById('vaultEditingId').value = '';
  document.getElementById('vaultSaveBtn').textContent = 'Guardar credencial';
  vaultCancelEditBtn.classList.add('hidden');
}

function currentData() {
  return getUserData(activeUser);
}

function persistData(data) {
  saveUserData(activeUser, data);
  renderAll();
}

function renderLinks() {
  const data = currentData();
  const q = searchInput.value.trim().toLowerCase();

  const filtered = data.links.filter((link) => {
    const haystack = `${link.title || ''} ${link.url || ''} ${link.notes || ''} ${link.keywords || ''}`.toLowerCase();
    return haystack.includes(q);
  });

  if (filtered.length === 0) {
    linksGrid.innerHTML = '<div class="empty">No hay enlaces para mostrar.</div>';
    return;
  }

  linksGrid.innerHTML = filtered.map((link) => {
    const tags = String(link.keywords || '')
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((tag) => `<span class="tag">${escaped(tag)}</span>`)
      .join('');

    return `
      <article class="card">
        <div class="card-media">
          ${link.image_data_url ? `<img src="${escaped(link.image_data_url)}" alt="Captura" />` : '<p class="no-image">Sin captura.</p>'}
        </div>
        <div class="card-body">
          <h3>${escaped(link.title || 'Sin titulo')}</h3>
          <a class="link-url" href="${escaped(link.url)}" target="_blank" rel="noopener noreferrer">${escaped(link.url)}</a>
          <p class="notes">${escaped(link.notes || '')}</p>
          <div class="tags">${tags}</div>
          <div class="card-actions">
            <button type="button" data-link-action="edit" data-id="${link.id}">Editar</button>
            <button type="button" class="delete" data-link-action="delete" data-id="${link.id}">Eliminar</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderVault() {
  const data = currentData();
  const q = vaultSearchInput.value.trim().toLowerCase();

  const filtered = data.vault.filter((entry) => {
    const haystack = `${entry.title || ''} ${entry.site_url || ''} ${entry.login_name || ''} ${entry.secret_value || ''} ${entry.notes || ''}`.toLowerCase();
    return haystack.includes(q);
  });

  if (filtered.length === 0) {
    vaultGrid.innerHTML = '<div class="empty">No hay credenciales para mostrar.</div>';
    return;
  }

  vaultGrid.innerHTML = filtered.map((entry) => `
    <article class="card">
      <div class="card-media vault-media">
        <div>
          <p class="vault-title">${escaped(entry.title)}</p>
          <p class="vault-meta">${escaped(entry.login_name || 'Sin usuario')}</p>
        </div>
      </div>
      <div class="card-body">
        ${entry.site_url ? `<a class="link-url" href="${escaped(entry.site_url)}" target="_blank" rel="noopener noreferrer">${escaped(entry.site_url)}</a>` : ''}
        <p class="notes"><strong>Contraseña:</strong> ${escaped(entry.secret_value || '')}</p>
        <p class="notes">${escaped(entry.notes || '')}</p>
        <div class="card-actions">
          <button type="button" data-vault-action="edit" data-id="${entry.id}">Editar</button>
          <button type="button" class="delete" data-vault-action="delete" data-id="${entry.id}">Eliminar</button>
        </div>
      </div>
    </article>
  `).join('');
}

function renderAll() {
  const data = currentData();
  updateStats(data);
  renderLinks();
  renderVault();
}

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;

  if (!username || !password) {
    showToast('Completa usuario y contraseña');
    return;
  }

  if (password.length < 6) {
    showToast('La contraseña debe tener al menos 6 caracteres');
    return;
  }

  const users = getUsers();
  const exists = users.some((u) => u.username === username);

  if (exists) {
    showToast('Ese usuario exacto ya existe');
    return;
  }

  users.push({ username, password });
  saveUsers(users);

  activeUser = username;
  setSession(username);
  toggleApp(true);
  showPanel('linksPanel');
  renderAll();
  registerForm.reset();
  showToast('Cuenta creada y sesión iniciada');
});

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  const users = getUsers();
  const found = users.find((u) => u.username === username);

  if (!found || found.password !== password) {
    showToast('Credenciales inválidas');
    return;
  }

  activeUser = found.username;
  setSession(found.username);
  toggleApp(true);
  showPanel('linksPanel');
  renderAll();
  loginForm.reset();
  showToast('Sesión iniciada');
});

logoutBtn.addEventListener('click', () => {
  activeUser = null;
  clearSession();
  linksGrid.innerHTML = '';
  vaultGrid.innerHTML = '';
  keywordChips.innerHTML = '';
  statLinks.textContent = '0';
  statTags.textContent = '0';
  statVault.textContent = '0';
  resetLinkForm();
  resetVaultForm();
  toggleApp(false);
  showToast('Sesión cerrada');
});

linkForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const editingId = document.getElementById('editingId').value;
  const title = document.getElementById('title').value.trim();
  const url = document.getElementById('url').value.trim();
  const notes = document.getElementById('notes').value.trim();
  const keywords = document.getElementById('keywords').value.trim();
  const imageInput = document.getElementById('image');

  if (!url) {
    showToast('La URL es obligatoria');
    return;
  }

  let imageDataUrl = null;
  if (imageInput.files && imageInput.files[0]) {
    try {
      imageDataUrl = await fileToDataUrl(imageInput.files[0]);
    } catch (error) {
      showToast(error.message);
      return;
    }
  }

  const data = currentData();

  if (editingId) {
    const idx = data.links.findIndex((x) => x.id === editingId);
    if (idx >= 0) {
      data.links[idx] = {
        ...data.links[idx],
        title,
        url,
        notes,
        keywords,
        image_data_url: imageDataUrl || data.links[idx].image_data_url || null,
        updated_at: now()
      };
      showToast('Enlace actualizado');
    }
  } else {
    data.links.unshift({
      id: createId(),
      title,
      url,
      notes,
      keywords,
      image_data_url: imageDataUrl,
      created_at: now(),
      updated_at: now()
    });
    showToast('Enlace guardado');
  }

  resetLinkForm();
  persistData(data);
});

linksGrid.addEventListener('click', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.linkAction;
  const id = target.dataset.id;
  if (!action || !id) return;

  const data = currentData();
  const entry = data.links.find((x) => x.id === id);
  if (!entry) return;

  if (action === 'edit') {
    document.getElementById('editingId').value = entry.id;
    document.getElementById('title').value = entry.title || '';
    document.getElementById('url').value = entry.url || '';
    document.getElementById('notes').value = entry.notes || '';
    document.getElementById('keywords').value = entry.keywords || '';
    cancelEditBtn.classList.remove('hidden');
    document.getElementById('saveBtn').textContent = 'Actualizar enlace';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (action === 'delete') {
    const sure = window.confirm('Quieres eliminar este enlace?');
    if (!sure) return;
    data.links = data.links.filter((x) => x.id !== id);
    persistData(data);
    showToast('Enlace eliminado');
  }
});

cancelEditBtn.addEventListener('click', () => {
  resetLinkForm();
});

vaultForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const editingId = document.getElementById('vaultEditingId').value;
  const title = document.getElementById('vaultTitle').value.trim();
  const siteUrl = document.getElementById('vaultUrl').value.trim();
  const loginName = document.getElementById('vaultLogin').value.trim();
  const secretValue = document.getElementById('vaultSecret').value.trim();
  const notes = document.getElementById('vaultNotes').value.trim();

  if (!title) {
    showToast('El título es obligatorio');
    return;
  }

  const data = currentData();

  if (editingId) {
    const idx = data.vault.findIndex((x) => x.id === editingId);
    if (idx >= 0) {
      data.vault[idx] = {
        ...data.vault[idx],
        title,
        site_url: siteUrl,
        login_name: loginName,
        secret_value: secretValue,
        notes,
        updated_at: now()
      };
      showToast('Credencial actualizada');
    }
  } else {
    data.vault.unshift({
      id: createId(),
      title,
      site_url: siteUrl,
      login_name: loginName,
      secret_value: secretValue,
      notes,
      created_at: now(),
      updated_at: now()
    });
    showToast('Credencial guardada');
  }

  resetVaultForm();
  persistData(data);
});

vaultGrid.addEventListener('click', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.vaultAction;
  const id = target.dataset.id;
  if (!action || !id) return;

  const data = currentData();
  const entry = data.vault.find((x) => x.id === id);
  if (!entry) return;

  if (action === 'edit') {
    document.getElementById('vaultEditingId').value = entry.id;
    document.getElementById('vaultTitle').value = entry.title || '';
    document.getElementById('vaultUrl').value = entry.site_url || '';
    document.getElementById('vaultLogin').value = entry.login_name || '';
    document.getElementById('vaultSecret').value = entry.secret_value || '';
    document.getElementById('vaultNotes').value = entry.notes || '';
    vaultCancelEditBtn.classList.remove('hidden');
    document.getElementById('vaultSaveBtn').textContent = 'Actualizar credencial';
    showPanel('vaultPanel');
    return;
  }

  if (action === 'copy') {
    navigator.clipboard.writeText(entry.secret_value)
    showToast('Contraseña copiada')
    return;
  }
  if (action === 'delete') {
    const sure = window.confirm('Quieres eliminar esta credencial?');
    if (!sure) return;
    data.vault = data.vault.filter((x) => x.id !== id);
    persistData(data);
    showToast('Credencial eliminada');
  }
}
);

vaultCancelEditBtn.addEventListener('click', () => {
  resetVaultForm();
});

searchInput.addEventListener('input', renderLinks);
vaultSearchInput.addEventListener('input', renderVault);

tabs.forEach((tab) => {
  tab.addEventListener('click', () => showPanel(tab.dataset.panel));
});

(function init() {
  // Reinicio global solicitado anteriormente: limpia cuentas guardadas una vez.
  if (!localStorage.getItem('linkatlas_reset_done_v1')) {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('linkatlas_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('linkatlas_reset_done_v1', '1');

  }

  const username = getSessionUser();
  if (!username) {
    activeUser = null;
    toggleApp(false);
    showPanel('linksPanel');
    return;
  }

  const users = getUsers();
  const exists = users.some((u) => u.username === username);
  if (!exists) {
    clearSession();
    activeUser = null;
    toggleApp(false);
    showPanel('linksPanel');
    return;
  }

  activeUser = username;
  toggleApp(true);
  showPanel('linksPanel');
  renderAll();
})();


