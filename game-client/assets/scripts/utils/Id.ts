export function createRequestId(): string {
  return `req_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}
