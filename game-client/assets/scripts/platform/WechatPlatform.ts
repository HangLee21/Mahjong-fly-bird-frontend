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

interface WechatApi {
  login(options: {
    timeout?: number;
    success?: (result: WechatLoginResult) => void;
    fail?: (error: WechatLoginResult) => void;
  }): void;
  getAccountInfoSync?(): WechatAccountInfo;
  showModal?(options: {
    title: string;
    content: string;
    showCancel?: boolean;
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

export function showWechatBlockingError(title: string, error: unknown): void {
  const content = error instanceof Error ? error.message : String(error);
  const wxApi = getWechatApi();
  if (wxApi?.showModal) {
    wxApi.showModal({ title, content, showCancel: false });
    return;
  }
  console.error(`[${title}] ${content}`);
}
