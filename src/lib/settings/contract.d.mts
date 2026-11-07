export function validLanguageBody(body: unknown): body is { preferredLanguage: "vi" | "en" };
export function validDeleteBody(body: unknown): body is { confirmation: "DELETE" };
export function sameOrigin(request: Request): boolean;
