'use client';

import { useEffect, useMemo, useState } from 'react';
import { getUser, registerUser, getUserData, saveLinkAction, deleteLinkAction, removeLinkImageAction, saveVaultAction, deleteVaultAction } from './actions';
import { LogOut, Plus, Search, Trash2, Edit3, ExternalLink, Lock, Link as LinkIcon, Image as ImageIcon, User, ShieldCheck, Zap, LayoutGrid, Info, Key, Sparkles, Activity, ShieldAlert, BadgeCheck, Fingerprint, ServerCog, ArrowRight } from 'lucide-react';

const STORAGE_SESSION = 'linkatlas_session_v3';
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

const heroMetrics = [
  { value: '24/7', label: 'Control visual y acceso' },
  { value: '3 capas', label: 'Enlaces, vault e imágenes' },
  { value: 'BD', label: 'Persistencia centralizada' }
];

const heroHighlights = [
  'Sesión privada con control local',
  'Acceso rápido con diseño de consola',
  'Vista clara para enlaces, vault y galería'
];

const securityChecklist = [
  'Verificación de sesión persistente',
  'Organización por paneles separada',
  'Carga y edición sin salir del dashboard'
];

function now() {
  return Date.now();
}

function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
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

  const loadUserData = async (userId) => {
    try {
      const dbData = await getUserData(userId);
      setData({ links: dbData.links || [], vault: dbData.vault || [] });
    } catch (e) {
      showToast('Error cargando datos de la DB');
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

  const totalItems = data.links.length + data.vault.length;
  const dashboardStats = [
    { value: data.links.length, label: 'Enlaces activos' },
    { value: data.vault.length, label: 'Credenciales guardadas' },
    { value: imageLibrary.length, label: 'Imágenes vinculadas' }
  ];

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
      setActiveUser(user);
      setSession(user);
      setData({ links: [], vault: [] });
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
      if (!user) {
        showToast('Credenciales inválidas');
        return;
      }
      setActiveUser(user);
      setSession(user);
      await loadUserData(user.id);
      setActivePanel('linksPanel');
      setLoginForm({ username: '', password: '' });
      showToast('Sesión iniciada correctamente');
    } catch (error) {
      showToast('Error al iniciar sesión');
    }
  };

  const onLogout = () => {
    clearSession();
    setActiveUser(null);
    setData({ links: [], vault: [] });
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
      await saveLinkAction({
        id: linkForm.editingId || null,
        title,
        url,
        notes,
        keywords,
        imageUrl: imageUrl || (linkForm.editingId ? data.links.find(l => l.id === linkForm.editingId)?.imageUrl : null)
      }, activeUser.id);
      
      await loadUserData(activeUser.id);
      setLinkForm(initialLinkForm);
      showToast(linkForm.editingId ? 'Enlace actualizado' : 'Enlace guardado en BD');
    } catch (error) {
      showToast('Error al guardar enlace');
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
      await deleteLinkAction(id, activeUser.id);
      await loadUserData(activeUser.id);
      showToast('Enlace eliminado');
    } catch (error) {
      showToast('Error al eliminar');
    }
  };

  const onRemoveLinkImage = async (id) => {
    if (!activeUser) return;

    const sure = window.confirm('Quieres quitar esta imagen de la biblioteca?');
    if (!sure) return;

    try {
      await removeLinkImageAction(id, activeUser.id);
      await loadUserData(activeUser.id);
      showToast('Imagen eliminada de la biblioteca');
    } catch (_error) {
      showToast('Error al eliminar imagen');
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
      await saveVaultAction({
        id: vaultForm.editingId || null,
        title,
        siteUrl,
        loginName,
        secretValue,
        notes
      }, activeUser.id);
      
      await loadUserData(activeUser.id);
      setVaultForm(initialVaultForm);
      showToast(vaultForm.editingId ? 'Credencial actualizada' : 'Credencial guardada en BD');
    } catch (error) {
      showToast('Error al guardar credencial');
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
      await deleteVaultAction(id, activeUser.id);
      await loadUserData(activeUser.id);
      showToast('Credencial eliminada');
    } catch (error) {
      showToast('Error al eliminar');
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
        <div className="topbar-status">
          <span className="status-dot" />
          <span>{isLogged ? `Sesión activa · ${totalItems} elementos` : 'Acceso protegido'}</span>
          {isLogged && (
            <button className="ghost" onClick={onLogout}>
              <LogOut size={18} />
              Cerrar sesión
            </button>
          )}
        </div>
      </header>

      <main className="shell">
        {/* HERO SECTION */}
        {!isLogged && (
          <section className="hero-enterprise">
            <div className="hero-container glass-panel">
              <div className="hero-header">
                <div className="security-badge">
                  <ShieldCheck size={24} className="accent-text" />
                  <span className="badge-text">CERTIFICADO SEGURO</span>
                </div>
                <h1 className="gradient-text">Gestión Corporativa de Accesos</h1>
                <p className="hero-subtitle">Plataforma integral de seguridad para control centralizado de enlaces, credenciales e imágenes con estándares empresariales.</p>
              </div>

              <div className="hero-row">
                <div className="hero-value-props">
                  <div className="value-prop">
                    <div className="prop-icon">
                      <Lock size={20} />
                    </div>
                    <h3>Encriptación de Datos</h3>
                    <p>Todos los datos se almacenan con estándares de seguridad empresarial en bases de datos certificadas.</p>
                  </div>
                  <div className="value-prop">
                    <div className="prop-icon">
                      <Fingerprint size={20} />
                    </div>
                    <h3>Verificación Biométrica</h3>
                    <p>Sesiones privadas con validación de usuario y control de acceso centralizado.</p>
                  </div>
                  <div className="value-prop">
                    <div className="prop-icon">
                      <BadgeCheck size={20} />
                    </div>
                    <h3>Cumplimiento Normativo</h3>
                    <p>Interface diseñada para auditoría interna y compliance con políticas corporativas.</p>
                  </div>
                </div>

                <div className="hero-metrics-panel">
                  <div className="metrics-title">Protección Activa</div>
                  <div className="metrics-grid">
                    {heroMetrics.map((metric) => (
                      <div className="metric-box" key={metric.label}>
                        <div className="metric-value">{metric.value}</div>
                        <div className="metric-label">{metric.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="system-status">
                    <span className="status-indicator online" />
                    <span className="status-text">Sistema operativo · Todas las capas activas</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* AUTH PANEL */}
        {!isLogged && (
          <div className="auth-container">
            <div className="auth-card card-form glass-panel">
              <div className="panel-kicker"><User size={16} /> NUEVO USUARIO</div>
              <h2 className="gradient-text">Registrar Cuenta</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Obtén acceso inmediato a tu panel de control centralizado. Registro rápido y seguro en menos de un minuto.</p>
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

            <div className="auth-card card-form glass-panel auth-login-sep">
              <div className="panel-kicker"><ShieldCheck size={16} /> ACCESO SEGURO</div>
              <h2 className="gradient-text">Iniciar Sesión</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Acceso verificado a tu panel corporativo. Entrada rápida con autenticación segura.</p>
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
            <div className="dashboard-hero">
              <div>
                <div className="panel-kicker"><LayoutGrid size={16} /> Control center</div>
                <h2 className="gradient-text">Panel de Control</h2>
                <p className="dashboard-lead">Gestión centralizada de enlaces, vault e imágenes con una lectura más clara de todo lo que tienes guardado.</p>
                <div className="pill-row">
                  {keywordChips.map(([tag, count]) => (
                    <span className="pill" key={tag}>#{tag} ({count})</span>
                  ))}
                </div>
              </div>
              <div className="stats-strip">
                {dashboardStats.map((stat) => (
                  <div className="stats-card" key={stat.label}>
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-banner">
              <div className="banner-icon"><ShieldCheck size={18} /></div>
              <div>
                <strong>Sesión privada activa</strong>
                <p>El acceso sigue centralizado en tu cuenta y el contenido se presenta por paneles separados para no mezclar navegación con datos sensibles.</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
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
