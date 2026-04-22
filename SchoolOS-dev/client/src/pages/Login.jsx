import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { Eye, EyeOff, LogIn, Phone, Sun, Moon } from 'lucide-react';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark, toggleTheme, lang } = useAppSettings();
  const navigate = useNavigate();
  const isAr = lang === 'ar';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await login(phone, password);
      if (user?.role_key === 'super_admin') navigate('/schools');
      else navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--bg)', position: 'relative',
    }}>
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="icon-btn"
        style={{ position: 'absolute', top: 24, insetInlineEnd: 24 }}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 8, margin: '0 auto 16px',
            background: 'var(--ink)', color: 'var(--bg)',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--f-display)', fontWeight: 500, fontSize: 22,
          }}>s</div>
          <h1 className="display" style={{ fontSize: 32, margin: 0 }}>schola</h1>
          <p style={{ color: 'var(--ink-3)', marginTop: 6, fontSize: 13.5 }}>
            {isAr ? 'نظام إدارة المدارس' : 'School Management Platform'}
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 32 }}>
          <h2 className="display" style={{ fontSize: 22, marginBottom: 4 }}>
            {isAr ? 'مرحباً بعودتك' : 'Welcome back'}
          </h2>
          <p style={{ color: 'var(--ink-3)', fontSize: 13.5, marginBottom: 24 }}>
            {isAr ? 'سجّل الدخول برقم الهاتف' : 'Sign in with your phone number'}
          </p>

          {error && (
            <div style={{
              marginBottom: 16, padding: 12, borderRadius: 'var(--radius)',
              background: 'color-mix(in oklab, var(--bad) 10%, var(--bg))',
              border: '1px solid color-mix(in oklab, var(--bad) 25%, var(--line))',
              color: 'var(--bad)', fontSize: 13,
            }}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label" style={{ marginBottom: 6 }}>{isAr ? 'رقم الهاتف' : 'Phone Number'}</label>
              <div style={{ position: 'relative' }}>
                <Phone size={14} style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)' }} />
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="962790000000"
                  className="input"
                  style={{ paddingInlineStart: 36 }}
                />
              </div>
              <p style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                {isAr ? 'أدخل بدون + في البداية' : 'Enter without the + at the start'}
              </p>
            </div>

            <div>
              <label className="label" style={{ marginBottom: 6 }}>{isAr ? 'كلمة المرور' : 'Password'}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={isAr ? 'أدخل كلمة المرور' : 'Enter your password'}
                  className="input"
                  style={{ paddingInlineEnd: 36 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', insetInlineEnd: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)', background: 'none', border: 0, cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn accent"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 20px', marginTop: 4 }}
            >
              {loading ? (
                <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              ) : (
                <><LogIn size={14} />{isAr ? 'تسجيل الدخول' : 'Sign In'}</>
              )}
            </button>
          </form>

          <p style={{ fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', marginTop: 20 }}>
            {isAr ? 'يدعم العربية والإنجليزية' : 'Supports Arabic and English interfaces'}
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
