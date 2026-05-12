'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { createSupabaseBrowserClient } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Verifica que Supabase tenga una sesión de recuperación activa
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setMessage('El enlace de recuperación no es válido o expiró. Por favor, solicita uno nuevo.');
        }
        setIsReady(true);
      });
    }
  }, [supabase]);

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!password || password.length < 8) {
      setMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      if (!supabase) {
        throw new Error('Falta configurar Supabase Auth');
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setPassword('');
      router.push('/?reset=ok');
    } catch (error) {
      setMessage(error?.message || 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <main className="shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div>Cargando...</div>
      </main>
    );
  }

  return (
    <main className="shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <section className="glass-panel" style={{ width: 'min(560px, 100%)', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '0.75rem', borderRadius: '16px' }}>
            <Lock size={28} className="accent-text" />
          </div>
          <div>
            <h1 className="gradient-text">Nueva contraseña</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Escribe tu nueva contraseña para acceder a tu cuenta.</p>
          </div>
        </div>

        <form className="card-form" onSubmit={onSubmit}>
          <div className="input-group">
            <label>Nueva contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {message && (
            <div className="glass-panel" style={{ padding: '0.9rem 1rem', background: message.includes('no es válido') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.04)' }}>
              {message}
            </div>
          )}

          <button type="submit" disabled={loading || !isReady}>
            <Lock size={18} />
            {loading ? 'Actualizando...' : 'Confirmar nueva contraseña'}
          </button>
        </form>

        <div style={{ marginTop: '1rem' }}>
          <button type="button" className="ghost" onClick={() => router.push('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} />
            Volver al inicio
          </button>
        </div>
      </section>
    </main>
  );
}