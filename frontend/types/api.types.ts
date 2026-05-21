export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  header?: Record<string, string>;
  loading?: boolean;
  timeout?: number;
}

export class ApiError extends Error {
  code: string | number;
  statusCode?: number;

  constructor(code: string | number, message: string, statusCode?: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}
