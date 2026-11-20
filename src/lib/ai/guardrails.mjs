// Defense in depth for explicit candidate-directed patterns, not a semantic classifier.
export const GEMINI_SAFETY_SETTINGS = Object.freeze(['HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_HARASSMENT']
  .map(category => Object.freeze({ category, threshold: 'BLOCK_MEDIUM_AND_ABOVE' })));
export function providerContentBlocked(reason) { return ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(reason); }
function folded(value) { return value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/đ/giu, 'd').toLowerCase().replace(/\s+/gu, ' ').trim(); }
export function unsafeGeneratedText(value) {
  if (typeof value !== 'string') return false;
  const text = folded(value);
  return /^(?:(?:you are|you're|why are you|the candidate is)\s+(?:so\s+|an?\s+)?(?:stupid|worthless|idiot|incompetent)\b|ban\s+(?:la\s+|that\s+|qua\s+)?(?:ngu ngoc|vo dung|ngu dot))/u.test(text)
    || /^(?:are you\s+(?:married|pregnant|male|female)|how old are you|when were you born|what is your\s+(?:religion|race|ethnicity|sexual orientation)|do you plan to have children)\b/u.test(text)
    || /^(?:ban\s+(?:da\s+)?ket hon|ban co du dinh sinh con|ban theo ton giao|ton giao cua ban|ban bao nhieu tuoi)\b/u.test(text);
}
export function protectedRequirement(value) {
  return typeof value === 'string' && /^(?:age|gender|sex|religion|marital status|ethnicity|pregnancy|tuoi|gioi tinh|ton giao|tinh trang hon nhan)(?:$|\s*[:><=\d])/u.test(folded(value));
}
