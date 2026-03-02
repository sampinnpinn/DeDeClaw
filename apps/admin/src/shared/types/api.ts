export interface ApiResponse<TData> {
  code: number;
  message: string;
  data: TData;
  requestId: string;
}

export interface PagedPayload<TItem> {
  list: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RequestError {
  message: string;
  detail?: string;
  statusCode?: number;
}

export type RequestResult<TData> =
  | {
      isSuccess: true;
      data: TData;
      error: null;
    }
  | {
      isSuccess: false;
      data: null;
      error: RequestError;
    };
