interface WechatLoginResult {
  code?: string;
  errMsg?: string;
}

interface WechatAccountInfo {
  miniProgram?: {
    appId?: string;
    envVersion?: 'develop' | 'trial' | 'release';
  };
}

interface WechatUserInfo {
  nickName?: string;
  avatarUrl?: string;
}

interface WechatUserProfileResult {
  userInfo?: WechatUserInfo;
  errMsg?: string;
}

interface WechatModalResult {
  confirm?: boolean;
  cancel?: boolean;
  errMsg?: string;
}

interface WechatApi {
  login(options: {
    timeout?: number;
    success?: (result: WechatLoginResult) => void;
    fail?: (error: WechatLoginResult) => void;
  }): void;
  getAccountInfoSync?(): WechatAccountInfo;
  getUserProfile?(options: {
    desc: string;
    success?: (result: WechatUserProfileResult) => void;
    fail?: (error: WechatUserProfileResult) => void;
  }): void;
  showModal?(options: {
    title: string;
    content: string;
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
    success?: (result: WechatModalResult) => void;
    fail?: (error: WechatModalResult) => void;
  }): void;
}

function getWechatApi(): WechatApi | null {
  return (globalThis as { wx?: WechatApi }).wx ?? null;
}

export function isWechatMiniGame(): boolean {
  return getWechatApi() !== null;
}

export function getWechatAppId(): string | null {
  return getWechatApi()?.getAccountInfoSync?.().miniProgram?.appId ?? null;
}

export function getWechatEnvironmentVersion(): 'develop' | 'trial' | 'release' | null {
  return getWechatApi()?.getAccountInfoSync?.().miniProgram?.envVersion ?? null;
}

export function requestWechatLoginCode(timeoutMs = 10000): Promise<string> {
  const wxApi = getWechatApi();
  if (!wxApi?.login) {
    return Promise.reject(new Error('当前环境不支持 wx.login'));
  }

  return new Promise<string>((resolve, reject) => {
    wxApi.login({
      timeout: timeoutMs,
      success: (result) => {
        if (result.code) {
          resolve(result.code);
          return;
        }
        reject(new Error(result.errMsg || 'wx.login 未返回登录凭证'));
      },
      fail: (error) => reject(new Error(error.errMsg || 'wx.login 调用失败')),
    });
  });
}

/**
 * Reads the player's WeChat avatar and nickname. Must be invoked from a user
 * gesture; the caller falls back to defaults when the player declines.
 */
export function requestWechatUserProfile(timeoutMs = 8000): Promise<{ nickname: string; avatarUrl: string }> {
  const wxApi = getWechatApi();
  if (!wxApi?.getUserProfile) {
    return Promise.reject(new Error('当前环境不支持 wx.getUserProfile'));
  }

  return new Promise<{ nickname: string; avatarUrl: string }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('wx.getUserProfile 超时')), timeoutMs);
    wxApi.getUserProfile!({
      desc: '用于展示玩家头像与昵称',
      success: (result) => {
        clearTimeout(timer);
        const userInfo = result.userInfo;
        resolve({
          nickname: userInfo?.nickName || '微信玩家',
          avatarUrl: userInfo?.avatarUrl || '',
        });
      },
      fail: (error) => {
        clearTimeout(timer);
        reject(new Error(error.errMsg || 'wx.getUserProfile 调用失败'));
      },
    });
  });
}

export function showWechatBlockingError(title: string, error: unknown): void {
  const content = error instanceof Error ? error.message : String(error);
  const wxApi = getWechatApi();
  if (wxApi?.showModal) {
    wxApi.showModal({ title, content, showCancel: false });
    return;
  }
  console.error(`[${title}] ${content}`);
}

/** 弹出确认框，返回用户是否点了确认。非微信环境直接视为确认。 */
export function showWechatConfirm(title: string, content: string, confirmText = '确定', cancelText = '取消'): Promise<boolean> {
  const wxApi = getWechatApi();
  if (!wxApi?.showModal) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    wxApi.showModal!({
      title,
      content,
      showCancel: true,
      confirmText,
      cancelText,
      success: (result) => resolve(Boolean(result.confirm)),
      fail: () => resolve(false),
    });
  });
}
