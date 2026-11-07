export function validLanguageBody(body) {
  return !!body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === 1 && ['vi', 'en'].includes(body.preferredLanguage);
}
export function validDeleteBody(body) {
  return !!body && typeof body === 'object' && !Array.isArray(body) &&
    Object.keys(body).length === 1 && body.confirmation === 'DELETE';
}
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return (!origin || origin === new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site';
}
