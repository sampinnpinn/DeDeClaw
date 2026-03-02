export interface LoginForm {
  username: string;
  password: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  username: string;
}

export type AuthAction =
  | {
      type: 'LOGIN';
      payload: AuthState;
    }
  | {
      type: 'LOGOUT';
    };

export type AuthHandler = (form: LoginForm) => Promise<boolean>;
