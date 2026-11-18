'use strict';

const { Minimatch } = require('minimatch');

// Scoped to the function and scan() calls used by our pinned build tools.
// No Picomatch parser or generated regex is used. Reject unsupported extglobs
// rather than silently changing a pattern that might be a filesystem deny rule.
function patternBody(input, { nonegate = false } = {}) {
  if (typeof input !== 'string' || !input.length || input.length > 4096) {
    throw new TypeError('Build glob must be a nonempty path pattern of at most 4096 characters');
  }
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '\\') { i++; continue; }
    if ('?*+@!'.includes(input[i]) && input[i + 1] === '(') {
      throw new TypeError('Extended globs are not supported by the AfriGate build matcher');
    }
  }
  let start = 0;
  while (!nonegate && input[start] === '!') start++;
  const negated = start % 2 === 1;
  if (input.startsWith('./', start)) start += 2;
  return { body: input.slice(start), prefix: input.slice(0, start), negated };
}

function compile(pattern, options) {
  return new Minimatch(pattern, {
    nocomment: true,
    nonegate: true,
    noext: true,
    dot: options.dot,
    nocase: options.nocase,
    nobrace: options.nobrace,
    noglobstar: options.noglobstar,
    matchBase: options.basename || options.matchBase,
    platform: options.windows === true ? 'win32' : options.windows === false ? 'linux' : process.platform,
    magicalBraces: true,
  });
}

function match(patterns, options = {}) {
  const matchers = (Array.isArray(patterns) ? patterns : [patterns]).map(pattern => {
    const { body, negated } = patternBody(pattern, options);
    return { matcher: compile(body, options), negated, includeBase: !options.noglobstar && body.endsWith('/**') };
  });
  return (input) => {
    if (typeof input !== 'string') throw new TypeError('Build glob can only match paths');
    if (!input) return false;
    const path = input.startsWith('./') ? input.slice(2) : input;
    // tinyglobby expands folders with /**; the final globstar also admits
    // the base path, without requiring a trailing slash on the request.
    return matchers.some(({ matcher, negated, includeBase }) =>
      (matcher.match(path) || (includeBase && !path.endsWith('/') && matcher.match(`${path}/`))) !== negated);
  };
}

// A brace such as {types/internal,types} can contain a slash. Keep it whole
// for tinyglobby's partial directory matcher, which treats a slash as unknown.
function splitPath(body) {
  const parts = [];
  let start = 0;
  let braces = 0;
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === '\\') { i++; continue; }
    if (char === '{') braces++;
    if (char === '}' && braces) braces--;
    if (char === '/' && !braces) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

match.scan = (pattern, options = {}) => {
  const { body, prefix, negated } = patternBody(pattern, options);
  const parts = splitPath(body);
  const firstMagic = parts.findIndex(part => compile(part, options).hasMagic());
  const isGlob = firstMagic !== -1;
  const base = isGlob ? parts.slice(0, firstMagic).join('/') || (body.startsWith('/') ? '/' : '') : body;
  return { input: pattern, prefix, negated, isGlob, base, glob: isGlob ? parts.slice(firstMagic).join('/') : '',
    ...(options.parts ? { parts } : {}),
  };
};

module.exports = match;
