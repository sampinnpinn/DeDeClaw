export interface User {
  id: string;
  userId: string;
  email: string;
  username: string;
  avatar?: string;
  signature?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  workspaceId: string;
  name: string;
  type: 'creator' | 'member';
  ownerId: string;
  invitationCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  joinedAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  workspaceType: 'creator' | 'member';
  invitationCode?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    workspace: Workspace;
    token: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    workspace: Workspace;
    token: string;
  };
}

export interface VerifyTokenResponse {
  success: boolean;
  data?: {
    user: User;
    workspace: Workspace;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  workspace: Workspace | null;
  token: string | null;
}

export interface UpdateProfileRequest {
  username?: string;
  signature?: string;
  avatar?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
  };
}
