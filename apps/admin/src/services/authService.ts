import { appEnv } from '@/config';
import type { LoginForm } from '@/shared/types/auth';

export const validateAdminLogin = async (form: LoginForm): Promise<boolean> => {
  const isValid = form.username === appEnv.loginUsername && form.password === appEnv.loginPassword;
  return Promise.resolve(isValid);
};
