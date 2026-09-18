import type { AxiosResponse } from "axios";

import { api } from "./client";

type PaginatedResponse<T> = {
  results?: T[];
  next?: string | null;
  count?: number;
};

/** Fetch every page from a paginated list endpoint. */
export async function fetchAllPages<T>(
  url: string,
  params?: Record<string, string>
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;

  for (;;) {
    const { data } = await api.get<PaginatedResponse<T> | T[]>(url, {
      params: { ...params, page: String(page) },
    });

    if (Array.isArray(data)) {
      return data;
    }

    const pageResults = data.results ?? [];
    all.push(...pageResults);
    if (!data.next) break;
    page += 1;
  }

  return all;
}

export function unwrapList<T>(response: AxiosResponse<PaginatedResponse<T> | T[]>): T[] {
  const data = response.data;
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}
