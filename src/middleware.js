import { NextResponse } from 'next/server';

export function middleware(req) {
  // Allow requests to pass through without fighting client session storage
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
