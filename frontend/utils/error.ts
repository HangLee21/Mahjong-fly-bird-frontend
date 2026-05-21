export function showError(error: unknown, fallback = '操作失败'): void {
  const message = error instanceof Error ? error.message : fallback;
  wx.showToast({ title: message || fallback, icon: 'none' });
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
