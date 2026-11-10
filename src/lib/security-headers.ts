export function applicationCsp(nonce: string, pathname = "/") {
 if (!/^[A-Za-z0-9_-]{24,}$/.test(nonce)) throw new Error("CSP_NONCE_INVALID");
 return ["default-src 'self'", `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com https://cdn.paddle.com https://static.cloudflareinsights.com`,
  "object-src 'none'", "base-uri 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' https: data: blob:",
  "font-src 'self' https: data:", "connect-src 'self' https: wss:",
  "frame-src 'self' https://portal.globetrotr.nl https://challenges.cloudflare.com https://*.paddle.com blob:",
  "worker-src 'self' blob:", "media-src 'self' https: blob:", "form-action 'self' https:", (pathname === "/session-bridge" ? "frame-ancestors https://globetrotr.nl https://www.globetrotr.nl" : "frame-ancestors 'self'")].join('; ');
}
export function withSecurityHeaders(response: Response, nonce: string, pathname = "/") {
 if (!response.headers.get('content-type')?.includes('text/html')) return response;
 const headers = new Headers(response.headers);
 headers.set('Content-Security-Policy', applicationCsp(nonce, pathname));
 headers.set('X-Content-Type-Options','nosniff');
 return new Response(response.body,{ status: response.status,statusText:response.statusText,headers });
}
