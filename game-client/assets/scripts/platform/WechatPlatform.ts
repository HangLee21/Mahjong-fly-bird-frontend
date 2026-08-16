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

export interface WechatUserInfoButton {
  onTap(callback: (result: WechatUserProfileResult) => void): void;
  destroy(): void;
}

export interface WechatUserInfoButtonStyle {
  left: number;
  top: number;
  width: number;
  height: number;
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
  getSystemInfoSync?(): { windowWidth?: number; windowHeight?: number };
  createUserInfoButton?(options: {
    type: 'text';
    text: string;
    style: Record<string, string | number>;
    withCredentials?: boolean;
    lang?: string;
  }): WechatUserInfoButton;
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

export function createWechatProfileButton(
  bounds: { centerX: number; centerY: number; width: number; height: number } | null,
  onProfile: (profile: { nickname: string; avatarUrl: string }) => void,
  onError: (error: Error) => void,
): WechatUserInfoButton | null {
  const wxApi = getWechatApi();
  const systemInfo = wxApi?.getSystemInfoSync?.();
  const windowWidth = systemInfo?.windowWidth;
  const windowHeight = systemInfo?.windowHeight;
  console.log('[WechatProfile] createWechatProfileButton attempt', {
    hasWx: Boolean(wxApi),
    hasCreateUserInfoButton: Boolean(wxApi?.createUserInfoButton),
    windowWidth,
    windowHeight,
  });
  if (!wxApi?.createUserInfoButton || !windowWidth || !windowHeight) return null;

  // A full-screen overlay is the most reliable way to guarantee the native
  // button receives the first tap on the login page, regardless of device
  // orientation timing or Cocos letterboxing. When bounds are supplied we keep
  // the design-space conversion for tests and future use.
  const coverSize = Math.max(windowWidth, windowHeight);
  let left = 0;
  let top = 0;
  let buttonWidth = coverSize;
  let buttonHeight = coverSize;
  let scale = 1;

  if (bounds) {
    const designWidth = 1334;
    const designHeight = 750;
    scale = Math.min(windowWidth / designWidth, windowHeight / designHeight);
    const contentWidth = designWidth * scale;
    const contentHeight = designHeight * scale;
    const offsetX = (windowWidth - contentWidth) / 2;
    const offsetY = (windowHeight - contentHeight) / 2;
    const centerScreenX = offsetX + (designWidth / 2 + bounds.centerX) * scale;
    const centerScreenY = offsetY + (designHeight / 2 - bounds.centerY) * scale;
    buttonWidth = bounds.width * scale;
    buttonHeight = bounds.height * scale;
    left = centerScreenX - buttonWidth / 2;
    top = centerScreenY - buttonHeight / 2;
  }

  const button = wxApi.createUserInfoButton({
    type: 'text',
    text: ' ',
    style: {
      left,
      top,
      width: buttonWidth,
      height: buttonHeight,
      backgroundColor: 'rgba(0,0,0,0)',
      color: '#ffffff',
      borderColor: '#ffffff',
      borderWidth: 0,
      borderRadius: 0,
      fontSize: 1,
      lineHeight: 1,
      textAlign: 'center',
    },
    withCredentials: false,
    lang: 'zh_CN',
  });
  console.log('[WechatProfile] createUserInfoButton bounds', {
    left,
    top,
    width: buttonWidth,
    height: buttonHeight,
    scale,
    windowWidth,
    windowHeight,
    fullScreen: bounds === null,
  });
  button.onTap((result) => {
    console.log('[WechatProfile] user info button onTap', {
      hasUserInfo: Boolean(result.userInfo),
      errMsg: result.errMsg ?? '',
    });
    const userInfo = result.userInfo;
    if (!userInfo) {
      onError(new Error(result.errMsg || '未获得微信头像和昵称授权'));
      return;
    }
    onProfile({
      nickname: userInfo.nickName || '微信玩家',
      avatarUrl: userInfo.avatarUrl || '',
    });
  });
  return button;
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
