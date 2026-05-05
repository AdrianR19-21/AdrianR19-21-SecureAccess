'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getUser,
  registerUser,
  getUserData,
  saveLinkAction,
  deleteLinkAction,
  removeLinkImageAction,
  saveVaultAction,
  deleteVaultAction
} from './actions';
import { 
  LogOut, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  Lock, 
  Link as LinkIcon, 
  Image as ImageIcon,
  User,
  ShieldCheck,
  Zap,
  LayoutGrid,
  Info,
  Key
} from 'lucide-react';

const STORAGE_SESSION = 'linkatlas_session_v3';
const LOCAL_APP_STORAGE = 'linkatlas_local_app_v1';
const SESSION_DAYS = 30;

const initialLinkForm = {
  editingId: '',
  title: '',
  url: '',
  notes: '',
  keywords: '',
  imageFile: null
};

const initialVaultForm = {
  editingId: '',
  title: '',
  siteUrl: '',
  loginName: '',
  secretValue: '',
  notes: ''
};

function now() {
  return Date.now();
}

function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

function emptyData() {
  return { links: [], vault: [] };
}

function cloneData(data) {
  return {
    links: Array.isArray(data?.links) ? data.links : [],
    vault: Array.isArray(data?.vault) ? data.vault : []
  };
}

function hasData(data) {
  return (data?.links?.length || 0) > 0 || (data?.vault?.length || 0) > 0;
}

function readLocalAppState() {
  try {
    const raw = localStorage.getItem(LOCAL_APP_STORAGE);
    if (!raw) return { users: [], dataByUsername: {} };

    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      dataByUsername: parsed?.dataByUsername && typeof parsed.dataByUsername === 'object'
        ? parsed.dataByUsername
        : {}
    };
  } catch {
    return { users: [], dataByUsername: {} };
  }
}

function writeLocalAppState(state) {
  localStorage.setItem(LOCAL_APP_STORAGE, JSON.stringify(state));
}

function updateLocalAppState(updater) {
  const current = readLocalAppState();
  const next = updater(current) || current;
  writeLocalAppState(next);
  return next;
}

function createLocalUserId(username) {
  return `local:${username}`;
}

function normalizeUserForView(user) {
  if (!user) return null;
  return {
    id: user.id ?? createLocalUserId(user.username),
    username: user.username
  };
}

function isLocalUser(user) {
  return String(user?.id || '').startsWith('local:');
}

function getLocalUser(username, password) {
  const state = readLocalAppState();
  return state.users.find((user) => user.username === username && user.password === password) || null;
}

function saveLocalUser(user) {
  updateLocalAppState((state) => {
    const users = state.users.filter((item) => item.username !== user.username);
    return {
      ...state,
      users: [...users, user],
    };
  });
}

function getLocalData(username) {
  const state = readLocalAppState();
  return cloneData(state.dataByUsername?.[username]);
}

function saveLocalData(username, data) {
  updateLocalAppState((state) => ({
    ...state,
    dataByUsername: {
      ...state.dataByUsername,
      [username]: cloneData(data),
    },
  }));
}

function upsertLinkInData(baseData, link) {
  const data = cloneData(baseData);
  const index = data.links.findIndex((item) => item.id === link.id);
  if (index >= 0) {
    data.links[index] = { ...data.links[index], ...link };
  } else {
    data.links.unshift(link);
  }
  return data;
}

function removeLinkFromData(baseData, id) {
  const data = cloneData(baseData);
  data.links = data.links.filter((item) => item.id !== id);
  return data;
}

function clearLinkImageFromData(baseData, id) {
  const data = cloneData(baseData);
  data.links = data.links.map((item) => (
    item.id === id
      ? { ...item, imageDataUrl: null, imageUrl: null, updatedAt: new Date().toISOString() }
      : item
  ));
  return data;
}

function upsertVaultInData(baseData, vaultEntry) {
  const data = cloneData(baseData);
  const index = data.vault.findIndex((item) => item.id === vaultEntry.id);
  if (index >= 0) {
    data.vault[index] = { ...data.vault[index], ...vaultEntry };
  } else {
    data.vault.unshift(vaultEntry);
  }
  return data;
}

function removeVaultFromData(baseData, id) {
  const data = cloneData(baseData);
  data.vault = data.vault.filter((item) => item.id !== id);
  return data;
}

function setSession(user) {
  localStorage.setItem(STORAGE_SESSION, JSON.stringify({
    user,
    expiresAt: now() + daysToMs(SESSION_DAYS)
  }));
}

function clearSession() {
  localStorage.removeItem(STORAGE_SESSION);
}

function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session.user; // { id, username }
  } catch {
    return null;
  }
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

export default function HomePage() {
  const [activeUser, setActiveUser] = useState(null);
  const [activePanel, setActivePanel] = useState('linksPanel');
  const [registerForm, setRegisterForm] = useState({ username: '', password: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [linkForm, setLinkForm] = useState(initialLinkForm);
  const [vaultForm, setVaultForm] = useState(initialVaultForm);
  const [searchInput, setSearchInput] = useState('');
  const [vaultSearchInput, setVaultSearchInput] = useState('');
  const [data, setData] = useState({ links: [], vault: [] });
  const [toast, setToast] = useState({ visible: false, message: '' });

  const isLogged = Boolean(activeUser);

  const showToast = (message) => {
    setToast({ visible: true, message });
  };

  useEffect(() => {
    if (!toast.visible) return undefined;
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2200);
    return () => clearTimeout(timer);
  }, [toast.visible]);

  const loadUserData = async (user) => {
    const resolvedUser = normalizeUserForView(user || activeUser);

    if (!resolvedUser?.username) {
      setData(emptyData());
      return;
    }

    const localData = getLocalData(resolvedUser.username);

    if (isLocalUser(resolvedUser)) {
      setData(localData);
      return;
    }

    try {
      const dbData = await getUserData(resolvedUser.id);
      const nextData = cloneData(dbData);

      if (hasData(nextData)) {
        setData(nextData);
        saveLocalData(resolvedUser.username, nextData);
        return;
      }

      if (hasData(localData)) {
        setData(localData);
        return;
      }

      setData(nextData);
    } catch (_e) {
      if (hasData(localData)) {
        setData(localData);
        return;
      }

      setData(emptyData());
    }
  };

  useEffect(() => {
    const user = getSession();
    if (user) {
      setActiveUser(user);
      loadUserData(user.id);
    }
  }, []);

  const filteredLinks = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return data.links.filter((link) => {
      const haystack = `${link.title || ''} ${link.url || ''} ${link.notes || ''} ${link.keywords || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [data.links, searchInput]);

  const filteredVault = useMemo(() => {
    const q = vaultSearchInput.trim().toLowerCase();
    return data.vault.filter((entry) => {
      const haystack = `${entry.title || ''} ${entry.siteUrl || ''} ${entry.loginName || ''} ${entry.secretValue || ''} ${entry.notes || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [data.vault, vaultSearchInput]);

  const statTags = useMemo(() => {
    const tags = new Set();
    data.links.forEach((item) => {
      String(item.keywords || '')
        .split(/\s+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((tag) => tags.add(tag.toLowerCase()));
    });
    return tags.size;
  }, [data.links]);

  const keywordChips = useMemo(() => {
    const tagMap = new Map();
    data.links.forEach((item) => {
      const tags = String(item.keywords || '')
        .split(/\s+/)
        .map((value) => value.trim())
        .filter(Boolean);

      tags.forEach((tag) => {
        const key = tag.toLowerCase();
        tagMap.set(key, (tagMap.get(key) || 0) + 1);
      });
    });

    return Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [data.links]);

  const imageLibrary = useMemo(() => {
    return data.links
      .filter((item) => Boolean(item.imageUrl || item.imageDataUrl))
      .map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        imageUrl: item.imageUrl || item.imageDataUrl,
        createdAt: item.createdAt,
      }));
  }, [data.links]);

  const onRegister = async (event) => {
    event.preventDefault();
    const username = registerForm.username.trim();
    const password = registerForm.password;

    if (!username || !password) {
      showToast('Completa usuario y contraseña');
      return;
    }

    try {
      const user = await registerUser(username, password);
      const normalized = normalizeUserForView(user);
      setActiveUser(normalized);
      setSession(user);
      saveLocalUser({ id: createLocalUserId(username), username, password });
      saveLocalData(username, emptyData());
      setData(emptyData());
      setActivePanel('linksPanel');
      setRegisterForm({ username: '', password: '' });
      showToast('Cuenta creada en BD y sesión iniciada');
    } catch (error) {
      showToast(error.message || 'Error al registrar');
    }
  };

  const onLogin = async (event) => {
    event.preventDefault();
    const username = loginForm.username.trim();
    const password = loginForm.password;

    try {
      const user = await getUser(username, password);
      if (user) {
        const normalized = normalizeUserForView(user);
        setActiveUser(normalized);
        setSession(normalized);
        saveLocalUser({ id: createLocalUserId(username), username, password });
        await loadUserData(normalized);
      } else {
        const localUser = getLocalUser(username, password);
        if (!localUser) {
          showToast('Credenciales inválidas');
          return;
        }

        const normalized = normalizeUserForView(localUser);
        setActiveUser(normalized);
        setSession(normalized);
        await loadUserData(normalized);
      }
      setActivePanel('linksPanel');
      setLoginForm({ username: '', password: '' });
      showToast('Sesión iniciada correctamente');
    } catch (error) {
      showToast(error.message || 'Error al iniciar sesión');
    }
  };

  const onLogout = () => {
    clearSession();
    setActiveUser(null);
    setData(emptyData());
    setRegisterForm({ username: '', password: '' });
    setLoginForm({ username: '', password: '' });
    setLinkForm(initialLinkForm);
    setVaultForm(initialVaultForm);
    setSearchInput('');
    setVaultSearchInput('');
    setActivePanel('linksPanel');
    showToast('Sesión cerrada');
  };

  const onSubmitLink = async (event) => {
    event.preventDefault();
    if (!activeUser) return;

    const title = linkForm.title.trim();
    const url = linkForm.url.trim();
    const notes = linkForm.notes.trim();
    const keywords = linkForm.keywords.trim();

    if (!url) {
      showToast('La URL es obligatoria');
      return;
    }

    let imageUrl = null;
    if (linkForm.imageFile) {
      try {
        const formData = new FormData();
        formData.append('file', linkForm.imageFile);
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const { imageUrl: uploadedUrl } = await uploadResponse.json();
        imageUrl = uploadedUrl;
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'No se pudo subir la imagen');
        return;
      }
    }

    try {
      const existingLink = data.links.find((item) => item.id === linkForm.editingId);
      const localLink = {
        id: linkForm.editingId || existingLink?.id || globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
        title,
        url,
        notes,
        keywords,
        imageUrl: imageUrl || existingLink?.imageUrl || null,
        createdAt: existingLink?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!isLocalUser(activeUser)) {
        try {
          await saveLinkAction({
            id: linkForm.editingId || null,
            title,
            url,
            notes,
            keywords,
            imageUrl: localLink.imageUrl
          }, activeUser.id);
        } catch (_serverError) {
          // Mantengo la copia local aunque la DB temporal falle.
        }
      }

      const nextData = upsertLinkInData(data, localLink);
      setData(nextData);
      saveLocalData(activeUser.username, nextData);
      await loadUserData(activeUser);
      setLinkForm(initialLinkForm);
      showToast(linkForm.editingId ? 'Enlace actualizado' : 'Enlace guardado');
    } catch (error) {
      showToast(error?.message || 'Error al guardar enlace');
    }
  };

  const onEditLink = (id) => {
    const entry = data.links.find((item) => item.id === id);
    if (!entry) return;

    setLinkForm({
      editingId: entry.id,
      title: entry.title || '',
      url: entry.url || '',
      notes: entry.notes || '',
      keywords: entry.keywords || '',
      imageFile: null
    });
    setActivePanel('linksPanel');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDeleteLink = async (id) => {
    if (!activeUser) return;
    const sure = window.confirm('Quieres eliminar este enlace de la BD?');
    if (!sure) return;

    try {
      if (!isLocalUser(activeUser)) {
        try {
          await deleteLinkAction(id, activeUser.id);
        } catch (_serverError) {
          // La copia local sigue siendo la fuente de verdad si la DB no responde.
        }
      }

      const nextData = removeLinkFromData(data, id);
      setData(nextData);
      saveLocalData(activeUser.username, nextData);
      showToast('Enlace eliminado');
    } catch (error) {
      showToast(error?.message || 'Error al eliminar');
    }
  };

  const onRemoveLinkImage = async (id) => {
    if (!activeUser) return;

    const sure = window.confirm('Quieres quitar esta imagen de la biblioteca?');
    if (!sure) return;

    try {
      if (!isLocalUser(activeUser)) {
        try {
          await removeLinkImageAction(id, activeUser.id);
        } catch (_serverError) {
          // La copia local sigue siendo la fuente de verdad si la DB no responde.
        }
      }

      const nextData = clearLinkImageFromData(data, id);
      setData(nextData);
      saveLocalData(activeUser.username, nextData);
      showToast('Imagen eliminada de la biblioteca');
    } catch (_error) {
      showToast(_error?.message || 'Error al eliminar imagen');
    }
  };

  const onSubmitVault = async (event) => {
    event.preventDefault();
    if (!activeUser) return;

    const title = vaultForm.title.trim();
    const siteUrl = vaultForm.siteUrl.trim();
    const loginName = vaultForm.loginName.trim();
    const secretValue = vaultForm.secretValue.trim();
    const notes = vaultForm.notes.trim();

    if (!title) {
      showToast('El título es obligatorio');
      return;
    }

    try {
      const existingVault = data.vault.find((item) => item.id === vaultForm.editingId);
      const localVaultEntry = {
        id: vaultForm.editingId || existingVault?.id || globalThis.crypto?.randomUUID?.() || `${Date.now()}`,
        title,
        siteUrl,
        loginName,
        secretValue,
        notes,
        createdAt: existingVault?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!isLocalUser(activeUser)) {
        try {
          await saveVaultAction({
            id: vaultForm.editingId || null,
            title,
            siteUrl,
            loginName,
            secretValue,
            notes
          }, activeUser.id);
        } catch (_serverError) {
          // Mantengo la copia local aunque la DB temporal falle.
        }
      }

      const nextData = upsertVaultInData(data, localVaultEntry);
      setData(nextData);
      saveLocalData(activeUser.username, nextData);
      await loadUserData(activeUser);
      setVaultForm(initialVaultForm);
      showToast(vaultForm.editingId ? 'Credencial actualizada' : 'Credencial guardada');
    } catch (error) {
      showToast(error?.message || 'Error al guardar credencial');
    }
  };

  const onEditVault = (id) => {
    const entry = data.vault.find((item) => item.id === id);
    if (!entry) return;

    setVaultForm({
      editingId: entry.id,
      title: entry.title || '',
      siteUrl: entry.siteUrl || '',
      loginName: entry.loginName || '',
      secretValue: entry.secretValue || '',
      notes: entry.notes || ''
    });
    setActivePanel('vaultPanel');
  };

  const onDeleteVault = async (id) => {
    if (!activeUser) return;
    const sure = window.confirm('Quieres eliminar esta credencial de la BD?');
    if (!sure) return;

    try {
      if (!isLocalUser(activeUser)) {
        try {
          await deleteVaultAction(id, activeUser.id);
        } catch (_serverError) {
          // La copia local sigue siendo la fuente de verdad si la DB no responde.
        }
      }

      const nextData = removeVaultFromData(data, id);
      setData(nextData);
      saveLocalData(activeUser.username, nextData);
      showToast('Credencial eliminada');
    } catch (error) {
      showToast(error?.message || 'Error al eliminar');
    }
  };

  return (
    <>
      <div className="bg-nebula">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="glass-panel" style={{ padding: '0.5rem', borderRadius: '12px' }}>
            <ShieldCheck size={32} className="accent-text" />
          </div>
          <div>
            <h1 className="gradient-text">Antigravity Vault</h1>
            <p className="accent-text" style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {activeUser ? `@${activeUser.username}` : 'SECURE ACCESS'}
            </p>
          </div>
        </div>
        {isLogged && (
          <button className="ghost" onClick={onLogout}>
            <LogOut size={18} />
            Cerrar sesión
          </button>
        )}
      </header>

      <main className="shell">
        {/* HERO SECTION */}
        {!isLogged && (
          <section className="hero">
            <h1 className="gradient-text">Tus datos, bajo tu control.</h1>
            <p>Una caja fuerte digital elegante y segura para tus enlaces, contraseñas e imágenes. Todo guardado localmente en tu propia base de datos SQLite.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Zap className="accent-text" />
                <span style={{ fontWeight: 600 }}>Rápido</span>
              </div>
              <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Lock className="accent-text" />
                <span style={{ fontWeight: 600 }}>Privado</span>
              </div>
            </div>
          </section>
        )}

        {/* AUTH PANEL */}
        {!isLogged && (
          <div className="glass-panel auth-grid">
            <div className="card-form">
              <h2 className="gradient-text">Crear Cuenta</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Empieza a organizar tu vida digital hoy mismo.</p>
              <form className="card-form" onSubmit={onRegister}>
                <div className="input-group">
                  <label>Usuario</label>
                  <input
                    type="text"
                    placeholder="Tu nombre de usuario"
                    required
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Contraseña</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  />
                </div>
                <button type="submit">
                  <User size={18} />
                  Registrarse
                </button>
              </form>
            </div>

            <div className="card-form auth-login-sep">
              <h2 className="gradient-text">Acceder</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Bienvenido de nuevo. Introduce tus credenciales.</p>
              <form className="card-form" onSubmit={onLogin}>
                <div className="input-group">
                  <label>Usuario</label>
                  <input
                    type="text"
                    placeholder="Tu usuario"
                    required
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label>Contraseña</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  />
                </div>
                <button type="submit">
                  <ShieldCheck size={18} />
                  Entrar
                </button>
              </form>
            </div>
          </div>
        )}

        {/* APP PANEL */}
        {isLogged && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 className="gradient-text">Panel de Control</h2>
                <div className="pill-row">
                  {keywordChips.map(([tag, count]) => (
                    <span className="pill" key={tag}>#{tag} ({count})</span>
                  ))}
                </div>
              </div>
              <div className="tabs">
                <div className={`tab ${activePanel === 'linksPanel' ? 'active' : ''}`} onClick={() => setActivePanel('linksPanel')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LinkIcon size={16} /> Enlaces
                  </div>
                </div>
                <div className={`tab ${activePanel === 'vaultPanel' ? 'active' : ''}`} onClick={() => setActivePanel('vaultPanel')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Key size={16} /> Vault
                  </div>
                </div>
                <div className={`tab ${activePanel === 'imagesPanel' ? 'active' : ''}`} onClick={() => setActivePanel('imagesPanel')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ImageIcon size={16} /> Galería
                  </div>
                </div>
              </div>
            </div>

            {/* LINKS TAB */}
            {activePanel === 'linksPanel' && (
              <div className="animate-in">
                <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', marginBottom: '2rem' }}>
                  <form className="link-form" onSubmit={onSubmitLink}>
                    <div className="input-group">
                      <label>Título</label>
                      <input type="text" placeholder="Mi Sitio Web" value={linkForm.title} onChange={(e) => setLinkForm({...linkForm, title: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label>URL</label>
                      <input type="url" placeholder="https://..." required value={linkForm.url} onChange={(e) => setLinkForm({...linkForm, url: e.target.value})} />
                    </div>
                    <div className="input-group full">
                      <label>Notas</label>
                      <textarea rows={2} placeholder="Descripción rápida..." value={linkForm.notes} onChange={(e) => setLinkForm({...linkForm, notes: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label>Keywords</label>
                      <input type="text" placeholder="dev design tech" value={linkForm.keywords} onChange={(e) => setLinkForm({...linkForm, keywords: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label>Imagen</label>
                      <input type="file" accept="image/*" onChange={(e) => setLinkForm({...linkForm, imageFile: e.target.files?.[0] || null})} />
                    </div>
                    <div className="full" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                      <button type="submit">
                        <Plus size={18} /> {linkForm.editingId ? 'Actualizar Enlace' : 'Guardar Enlace'}
                      </button>
                      {linkForm.editingId && <button type="button" className="ghost" onClick={() => setLinkForm(initialLinkForm)}>Cancelar</button>}
                    </div>
                  </form>
                </div>

                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <Search size={20} className="accent-text" />
                  <input type="text" placeholder="Buscar en tus enlaces..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} style={{ background: 'transparent', border: 'none', padding: 0, width: '100%' }} />
                </div>

                <div className="items-grid">
                  {filteredLinks.length === 0 ? (
                    <div className="glass-panel" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem' }}>
                      <Info size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p>No se encontraron enlaces.</p>
                    </div>
                  ) : (
                    filteredLinks.map(link => (
                      <article className="card" key={link.id}>
                        <div className="card-media">
                          {link.imageUrl || link.imageDataUrl ? (
                            <img src={link.imageUrl || link.imageDataUrl} alt="" />
                          ) : (
                            <div style={{ opacity: 0.3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <ImageIcon size={48} />
                              <span style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>SIN PREVIA</span>
                            </div>
                          )}
                        </div>
                        <div className="card-content">
                          <h3 className="card-title">{link.title || 'Sin título'}</h3>
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="card-url">
                            <ExternalLink size={14} /> {link.url}
                          </a>
                          {link.notes && <p className="card-notes">{link.notes}</p>}
                          <div className="card-tags">
                            {link.keywords?.split(/\s+/).filter(Boolean).map(tag => (
                              <span className="tag" key={tag}>{tag}</span>
                            ))}
                          </div>
                          <div className="card-footer">
                            <button className="ghost" style={{ padding: '0.5rem' }} onClick={() => onEditLink(link.id)}><Edit3 size={16} /></button>
                            <button className="delete" style={{ padding: '0.5rem' }} onClick={() => onDeleteLink(link.id)}><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* VAULT TAB */}
            {activePanel === 'vaultPanel' && (
              <div className="animate-in">
                <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', marginBottom: '2rem' }}>
                  <form className="link-form" onSubmit={onSubmitVault}>
                    <div className="input-group">
                      <label>Sitio / Título</label>
                      <input type="text" placeholder="Gmail, Netflix..." required value={vaultForm.title} onChange={(e) => setVaultForm({...vaultForm, title: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label>URL del Sitio</label>
                      <input type="url" placeholder="https://..." value={vaultForm.siteUrl} onChange={(e) => setVaultForm({...vaultForm, siteUrl: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label>Usuario / Login</label>
                      <input type="text" placeholder="adrian@email.com" value={vaultForm.loginName} onChange={(e) => setVaultForm({...vaultForm, loginName: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label>Contraseña / Secreto</label>
                      <input type="text" placeholder="••••••••" value={vaultForm.secretValue} onChange={(e) => setVaultForm({...vaultForm, secretValue: e.target.value})} />
                    </div>
                    <div className="input-group full">
                      <label>Notas Privadas</label>
                      <textarea rows={2} placeholder="Solo tú verás esto..." value={vaultForm.notes} onChange={(e) => setVaultForm({...vaultForm, notes: e.target.value})} />
                    </div>
                    <div className="full" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                      <button type="submit" style={{ background: 'var(--accent-secondary)', color: '#fff' }}>
                        <Lock size={18} /> {vaultForm.editingId ? 'Actualizar Credencial' : 'Guardar en Vault'}
                      </button>
                      {vaultForm.editingId && <button type="button" className="ghost" onClick={() => setVaultForm(initialVaultForm)}>Cancelar</button>}
                    </div>
                  </form>
                </div>

                <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <Search size={20} style={{ color: 'var(--accent-secondary)' }} />
                  <input type="text" placeholder="Buscar en el vault..." value={vaultSearchInput} onChange={(e) => setVaultSearchInput(e.target.value)} style={{ background: 'transparent', border: 'none', padding: 0, width: '100%' }} />
                </div>

                <div className="items-grid">
                  {filteredVault.length === 0 ? (
                    <div className="glass-panel" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem' }}>
                      <ShieldCheck size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p>El vault está vacío.</p>
                    </div>
                  ) : (
                    filteredVault.map(entry => (
                      <article className="card vault-card" key={entry.id}>
                        <div className="card-content">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h3 className="card-title">{entry.title}</h3>
                            <Lock size={16} style={{ color: 'var(--accent-secondary)', opacity: 0.5 }} />
                          </div>
                          {entry.siteUrl && (
                            <a href={entry.siteUrl} target="_blank" rel="noopener noreferrer" className="card-url" style={{ color: 'var(--accent-secondary)' }}>
                              <ExternalLink size={14} /> {entry.siteUrl}
                            </a>
                          )}
                          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', marginTop: '0.5rem' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                              <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '0.2rem' }}>USUARIO</label>
                              <code style={{ fontSize: '0.9rem', color: '#fff' }}>{entry.loginName || '---'}</code>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.7rem', display: 'block', marginBottom: '0.2rem' }}>CONTRASEÑA</label>
                              <code style={{ fontSize: '1rem', color: 'var(--accent-secondary)', fontWeight: 700 }}>{entry.secretValue || '••••••••'}</code>
                            </div>
                          </div>
                          {entry.notes && <p className="card-notes" style={{ marginTop: '0.5rem' }}>{entry.notes}</p>}
                          <div className="card-footer">
                            <button className="ghost" style={{ padding: '0.5rem' }} onClick={() => onEditVault(entry.id)}><Edit3 size={16} /></button>
                            <button className="delete" style={{ padding: '0.5rem' }} onClick={() => onDeleteVault(entry.id)}><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* GALLERY TAB */}
            {activePanel === 'imagesPanel' && (
              <div className="animate-in">
                {imageLibrary.length === 0 ? (
                  <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
                    <ImageIcon size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>No hay imágenes en la galería.</p>
                  </div>
                ) : (
                  <div className="items-grid">
                    {imageLibrary.map(item => (
                      <article className="card" key={item.id}>
                        <div className="card-media" style={{ height: '260px' }}>
                          <img src={item.imageUrl} alt={item.title} />
                        </div>
                        <div className="card-content">
                          <h3 className="card-title">{item.title || 'Sin título'}</h3>
                          <div className="card-footer">
                            <button className="ghost" onClick={() => { onEditLink(item.id); setActivePanel('linksPanel'); }}>
                              <Search size={16} /> Ver Detalles
                            </button>
                            <button className="delete" style={{ padding: '0.5rem' }} onClick={() => onRemoveLinkImage(item.id)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {toast.visible && (
          <div className="toast">
            {toast.message}
          </div>
        )}
      </main>
    </>
  );
}
