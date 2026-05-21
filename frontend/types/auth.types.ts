export interface User {
  id: string;
  nickname: string;
  avatarUrl?: string;
}

export interface LoginResult {
  token: string;
  user: User;
}
