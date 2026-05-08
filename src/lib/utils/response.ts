import { NextResponse } from 'next/server';
import { ApiResponse, PaginatedResponse } from '@/types/database';

export function ok<T>(data: T, message?: string): NextResponse {
  const body: ApiResponse<T> = { data, error: null, message };
  return NextResponse.json(body, { status: 200 });
}

export function created<T>(data: T, message?: string): NextResponse {
  const body: ApiResponse<T> = { data, error: null, message };
  return NextResponse.json(body, { status: 201 });
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): NextResponse {
  const body: PaginatedResponse<T> = {
    data: items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
  return NextResponse.json(body, { status: 200 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ data: null, error: message }, { status: 400 });
}

export function unauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ data: null, error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ data: null, error: message }, { status: 403 });
}

export function notFound(message = 'Not found'): NextResponse {
  return NextResponse.json({ data: null, error: message }, { status: 404 });
}

export function conflict(message: string): NextResponse {
  return NextResponse.json({ data: null, error: message }, { status: 409 });
}

export function serverError(message = 'Internal server error'): NextResponse {
  return NextResponse.json({ data: null, error: message }, { status: 500 });
}
