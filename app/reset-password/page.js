'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck } from 'lucide-react';
import { createSupabaseBrowserClient } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!form.password || form.password.length < 8) {
      setMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      if (!supabase) {
        throw new Error('Falta configurar Supabase Auth');
      }

      const { error } = await supabase.auth.updateUser({ password: form.password });

      if (error) {
        throw error;
      }

      router.push('/?reset=ok');
    } catch (error) {
      setMessage(error?.message || 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <section className="glass-panel" style={{ width: 'min(560px, 100%)', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '0.75rem', borderRadius: '16px' }}>
            <ShieldCheck size={28} className="accent-text" />
          </div>
          <div>
            <h1 className="gradient-text">Cambiar contraseña</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Crea una nueva contraseña para tu cuenta.</p>
          </div>
        </div>

        <form className="card-form" onSubmit={onSubmit}>
          <div className="input-group">
            <label>Nueva contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              value={form.password}
              onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
            />
          </div>

          <div className="input-group">
            <label>Confirmar contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              value={form.confirmPassword}
              onChange={(e) => setForm((current) => ({ ...current, confirmPassword: e.target.value }))}
            />
          </div>

          {message && (
            <div className="glass-panel" style={{ padding: '0.9rem 1rem', background: 'rgba(255,255,255,0.04)' }}>
              {message}
            </div>
          )}

          <button type="submit" disabled={loading}>
            <Lock size={18} />
            {loading ? 'Actualizando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>
    </main>
  );
}