// Shared Web API framing; contains no server configuration or credentials.
export class StreamProtocolError extends Error {}

export async function* readSseEvents(body, { signal, maxBytes = 262144 } = {}) {
  if (!body) throw new StreamProtocolError('Missing stream body.');
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = ''; let size = 0; let ended = false;
  let event = ''; let data = [];
  const abort = () => { reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    while (!ended) {
      if (signal?.aborted) throw new StreamProtocolError('Stream cancelled.');
      const next = await reader.read();
      if (signal?.aborted) throw new StreamProtocolError('Stream cancelled.');
      ended = next.done;
      size += next.value?.byteLength ?? 0;
      if (size > maxBytes) throw new StreamProtocolError('Stream is too large.');
      try { buffer += ended ? decoder.decode() : decoder.decode(next.value, { stream: true }); }
      catch { throw new StreamProtocolError('Invalid UTF-8 stream data.'); }
      while (true) {
        const index = buffer.search(/[\r\n]/u);
        if (index < 0 || (!ended && buffer[index] === '\r' && index === buffer.length - 1)) break;
        const line = buffer.slice(0, index);
        const width = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1;
        buffer = buffer.slice(index + width);
        if (!line) {
          if (data.length) yield { event: event || 'message', data: data.join('\n') };
          event = ''; data = [];
        } else if (!line.startsWith(':')) {
          const colon = line.indexOf(':');
          const field = colon < 0 ? line : line.slice(0, colon);
          const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /u, '');
          if (field === 'event') event = value;
          if (field === 'data') data.push(value);
        }
      }
    }
    if (buffer.trim() || data.length) throw new StreamProtocolError('Incomplete stream frame.');
  } finally {
    signal?.removeEventListener('abort', abort);
    if (!ended) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function stringAt(source, start) {
  let index = start + 1;
  while (index < source.length) {
    const character = source[index];
    if (character === '"') return { value: JSON.parse(source.slice(start, index + 1)), end: index + 1 };
    if (character === '\\') {
      if (index + 1 >= source.length) break;
      if (source[index + 1] === 'u') {
        if (index + 6 > source.length) break;
        if (!/^[a-fA-F0-9]{4}$/u.test(source.slice(index + 2, index + 6))) throw new SyntaxError('Invalid Unicode escape.');
        index += 6;
      } else {
        if (!'"\\/bfnrt'.includes(source[index + 1])) throw new SyntaxError('Invalid string escape.');
        index += 2;
      }
    } else {
      if (character.charCodeAt(0) < 32) throw new SyntaxError('Invalid string character.');
      index++;
    }
  }
  const value = JSON.parse(source.slice(start, index) + '"').replace(/[\uD800-\uDBFF]$/u, '');
  return { value, end: null };
}

// Rescan the bounded JSON prefix, matching only a top-level question field.
// A regex could confuse a quoted/nested "question" inside reason with the field.
export function questionTextPrefix(source) {
  let index = 0;
  const whitespace = () => { while (/\s/u.test(source[index] ?? '') && index < source.length) index++; };
  whitespace();
  if (source[index++] !== '{') return '';
  while (index < source.length) {
    whitespace();
    if (source[index] !== '"') return '';
    const key = stringAt(source, index);
    if (key.end === null) return '';
    index = key.end; whitespace();
    if (source[index++] !== ':') return '';
    whitespace();
    if (key.value === 'question') return source[index] === '"' ? stringAt(source, index).value : '';
    if (source[index] === '"') {
      const value = stringAt(source, index);
      if (value.end === null) return '';
      index = value.end;
    } else {
      let depth = 0;
      for (; index < source.length; index++) {
        const character = source[index];
        if (character === '"') {
          const value = stringAt(source, index);
          if (value.end === null) return '';
          index = value.end - 1;
        } else if (character === '{' || character === '[') depth++;
        else if (character === '}' || character === ']') { if (!depth) break; depth--; }
        else if (character === ',' && !depth) break;
      }
    }
    whitespace();
    if (source[index++] !== ',') return '';
  }
  return '';
}

export function encodeSseEvent(event, data) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
