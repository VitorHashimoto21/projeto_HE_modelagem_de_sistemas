import { useState } from 'react'

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate() {
    const next: typeof errors = {}
    if (!email.trim()) next.email = 'Informe seu e-mail'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'E-mail inválido'
    if (!password) next.password = 'Informe sua senha'
    return next
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    setTimeout(() => setLoading(false), 1800)
  }

  return (
    <div className="size-full flex min-h-screen" style={{ fontFamily: 'var(--font-body)', backgroundColor: 'var(--color-surface)' }}>

      {/* ── Brand panel ─────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col justify-between w-[46%] min-h-full px-14 py-12 relative overflow-hidden"
        style={{ backgroundColor: 'var(--color-brand-deep)' }}
      >
        {/* Subtle radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 60% 30%, rgba(217,119,6,0.12) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(16,82,57,0.4) 0%, transparent 60%)',
          }}
        />

        {/* Geometric accent lines */}
        <div className="absolute top-0 right-0 w-px h-full opacity-10" style={{ backgroundColor: 'var(--color-brand-accent)' }} />
        <div className="absolute bottom-24 left-0 right-0 h-px opacity-10" style={{ backgroundColor: 'var(--color-brand-accent)' }} />

        {/* Logo */}
        <header className="relative z-10 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-brand-accent)' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="1" width="7" height="7" rx="1.5" fill="white" />
              <rect x="10" y="1" width="7" height="7" rx="1.5" fill="white" fillOpacity=".5" />
              <rect x="1" y="10" width="7" height="7" rx="1.5" fill="white" fillOpacity=".5" />
              <rect x="10" y="10" width="7" height="7" rx="1.5" fill="white" />
            </svg>
          </div>
          <span className="text-white font-semibold tracking-wide text-sm uppercase">HE Solutions</span>
        </header>

        {/* Hero copy */}
        <div className="relative z-10">
          <p
            className="text-xs font-medium uppercase tracking-widest mb-5"
            style={{ color: 'var(--color-brand-accent)' }}
          >
            Plataforma ERP para microempreendedores e autônomos
          </p>
          <h1
            className="text-5xl leading-[1.1] text-white mb-6"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
          >
            Seu negócio,<br />
            organizado<br />
            de verdade.
          </h1>
          <p className="text-base leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Controle estoque, precifique produtos e serviços com precisão, e acompanhe cada centavo do seu caixa — tudo em um só lugar.
          </p>
        </div>

        {/* Feature pills */}
        <footer className="relative z-10">
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Recursos incluídos</p>
          <div className="flex flex-wrap gap-2">
            {['Calculadora de preços', 'Controle de estoque', 'Fluxo de caixa', 'Gestão de equipes'].map(feat => (
              <span
                key={feat}
                className="text-xs px-3 py-1.5 rounded-full border"
                style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}
              >
                {feat}
              </span>
            ))}
          </div>
        </footer>
      </aside>

      {/* ── Login form panel ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16 xl:px-24">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-10">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-brand-accent)' }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="1" width="7" height="7" rx="1.5" fill="white" />
              <rect x="10" y="1" width="7" height="7" rx="1.5" fill="white" fillOpacity=".5" />
              <rect x="1" y="10" width="7" height="7" rx="1.5" fill="white" fillOpacity=".5" />
              <rect x="10" y="10" width="7" height="7" rx="1.5" fill="white" />
            </svg>
          </div>
          <span className="font-semibold tracking-wide text-sm uppercase" style={{ color: 'var(--color-brand-deep)' }}>GestorPRO</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-9">
            <h2
              className="text-3xl mb-1.5"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--color-brand-deep)' }}
            >
              Bem-vindo de volta
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-muted-text)' }}>
              Acesse sua conta para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--color-brand-deep)' }}
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
                placeholder="voce@empresa.com"
                className="w-full px-4 py-3 rounded-xl text-sm border transition-all duration-150"
                style={{
                  borderColor: errors.email ? '#ef4444' : 'var(--color-input-border)',
                  backgroundColor: 'var(--color-surface-card)',
                  color: '#111827',
                  outline: 'none',
                  boxShadow: errors.email ? '0 0 0 3px rgba(239,68,68,0.1)' : 'none',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--color-input-focus)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(217,119,6,0.12)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = errors.email ? '#ef4444' : 'var(--color-input-border)'
                  e.target.style.boxShadow = errors.email ? '0 0 0 3px rgba(239,68,68,0.1)' : 'none'
                }}
              />
              {errors.email && (
                <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#ef4444' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1" fill="none" />
                    <rect x="5.5" y="3" width="1" height="4" rx=".5" />
                    <rect x="5.5" y="8.5" width="1" height="1" rx=".5" />
                  </svg>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-sm font-medium" style={{ color: 'var(--color-brand-deep)' }}>
                  Senha
                </label>
                <button
                  type="button"
                  className="text-xs font-medium transition-colors"
                  style={{ color: 'var(--color-brand-accent)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand-accent-light)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-brand-accent)')}
                >
                  Esqueci a senha
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
                  placeholder="Sua senha"
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm border transition-all duration-150"
                  style={{
                    borderColor: errors.password ? '#ef4444' : 'var(--color-input-border)',
                    backgroundColor: 'var(--color-surface-card)',
                    color: '#111827',
                    outline: 'none',
                    boxShadow: errors.password ? '0 0 0 3px rgba(239,68,68,0.1)' : 'none',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--color-input-focus)'
                    e.target.style.boxShadow = '0 0 0 3px rgba(217,119,6,0.12)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = errors.password ? '#ef4444' : 'var(--color-input-border)'
                    e.target.style.boxShadow = errors.password ? '0 0 0 3px rgba(239,68,68,0.1)' : 'none'
                  }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-opacity"
                  style={{ color: 'var(--color-muted-text)' }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#ef4444' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1" fill="none" />
                    <rect x="5.5" y="3" width="1" height="4" rx=".5" />
                    <rect x="5.5" y="8.5" width="1" height="1" rx=".5" />
                  </svg>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-200 mt-2 flex items-center justify-center gap-2"
              style={{
                backgroundColor: loading ? 'rgba(217,119,6,0.7)' : 'var(--color-brand-accent)',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = '#b45309' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--color-brand-accent)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                  </svg>
                  Entrando…
                </>
              ) : 'Entrar'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-input-border)' }} />
            <span className="text-xs" style={{ color: 'var(--color-muted-text)' }}>ou</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-input-border)' }} />
          </div>

          {/* SSO / alternative */}
          <button
            type="button"
            className="w-full py-3 rounded-xl text-sm font-medium border transition-all duration-150 flex items-center justify-center gap-2.5"
            style={{
              borderColor: 'var(--color-input-border)',
              backgroundColor: 'var(--color-surface-card)',
              color: '#374151',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.backgroundColor = '#f9fafb' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-input-border)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-card)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </button>

          {/* Sign up nudge */}
          <p className="text-center text-sm mt-8" style={{ color: 'var(--color-muted-text)' }}>
            Não tem uma conta?{' '}
            <button
              type="button"
              className="font-semibold transition-colors"
              style={{ color: 'var(--color-brand-accent)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-brand-accent-light)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-brand-accent)')}
            >
              Crie gratuitamente
            </button>
          </p>
        </div>

        {/* Footer */}
        <p className="absolute bottom-6 text-xs" style={{ color: 'rgba(107,114,128,0.6)' }}>
          © 2025 GestorPRO · Termos · Privacidade
        </p>
      </main>
    </div>
  )
}
