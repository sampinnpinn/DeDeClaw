import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import styles from '@/components/LoginPage.module.css';
import { useAuth } from '@/contexts/AuthContext';
import type { LoginForm } from '@/shared/types/auth';

interface LocationState {
  from?: string;
}

export default function LoginPage() {
  const { authState, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginForm>({ username: '', password: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (authState.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const state = location.state as LocationState | null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    const isSuccess = await login(form);

    if (!isSuccess) {
      setErrorMessage('账号或密码错误，请重试');
      setIsSubmitting(false);
      return;
    }

    const target = state?.from ?? '/dashboard';
    navigate(target, { replace: true });
  };

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>登录管理后台</h1>
        <p className={styles.subtitle}>仅可使用环境变量中预置的账号密码登录</p>

        <label className={styles.field}>
          <span className={styles.label}>账号</span>
          <input
            className={styles.input}
            value={form.username}
            onChange={(event) => setForm((previous) => ({ ...previous, username: event.target.value }))}
            autoComplete="username"
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>密码</span>
          <input
            className={styles.input}
            type="password"
            value={form.password}
            onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
            autoComplete="current-password"
            required
          />
        </label>

        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? '登录中...' : '进入后台'}
        </button>
      </form>
    </div>
  );
}
