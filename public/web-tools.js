// ============ 共享工具库 - Web 端 ============
// 从 PC 端 note.js 移植的所有文本工具、RSA、哈希、编码等功能

// ============ 文本处理函数 ============
const TEXT_TOOLS = {
  trimSpaces: (t) => t.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).join('\n'),
  removeBlankLines: (t) => t.split('\n').filter(line => line.trim() !== '').join('\n'),
  removeAllSpaces: (t) => t.replace(/[ \t]+/g, ''),
  newlineToComma: (t) => t.split('\n').map(l => l.trim()).filter(l => l !== '').join(','),
  newlineToQuotedComma: (t) => t.split('\n').map(l => l.trim()).filter(l => l !== '').map(l => `'${l}'`).join(','),
  upperCase: (t) => t.toUpperCase(),
  lowerCase: (t) => t.toLowerCase(),
  titleCase: (t) => t.replace(/\b\w/g, c => c.toUpperCase()),
  dedupeLines: (t) => {
    const seen = new Set();
    return t.split('\n').filter(line => { if (seen.has(line)) return false; seen.add(line); return true; }).join('\n');
  },
  sortAsc: (t) => t.split('\n').sort((a, b) => a.localeCompare(b, 'zh')).join('\n'),
  sortDesc: (t) => t.split('\n').sort((a, b) => b.localeCompare(a, 'zh')).join('\n'),
  reverseLines: (t) => t.split('\n').reverse().join('\n'),
  urlEncode: (t) => encodeURIComponent(t),
  urlDecode: (t) => { try { return decodeURIComponent(t); } catch { return t; } },
  base64Encode: (t) => btoa(unescape(encodeURIComponent(t))),
  base64Decode: (t) => { try { return decodeURIComponent(escape(atob(t.trim()))); } catch { return t; } },
  unicodeEncode: (t) => Array.from(t).map(c => {
    const code = c.codePointAt(0);
    return code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : c;
  }).join(''),
  unicodeDecode: (t) => t.replace(/\\u([0-9a-fA-F]{4,6})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16))),
  jsonFormat: (t) => { try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return t; } },
  jsonMinify: (t) => { try { return JSON.stringify(JSON.parse(t)); } catch { return t; } },
  yamlToProps: (t) => {
    const lines = t.split('\n');
    const result = [];
    const stack = [];
    for (const line of lines) {
      const trimmed = line.replace(/\r$/, '');
      const indentMatch = trimmed.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      const kvMatch = trimmed.match(/^\s*([^:#][^:]*?):\s*(.*)$/);
      if (!kvMatch) continue;
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
      const fullKey = [...stack.map(s => s.key), key].join('.');
      if (value === '' || value === '|' || value === '>' || value === '[]') {
        stack.push({ indent, key });
      } else {
        let val = value;
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        result.push(`${fullKey}=${val}`);
      }
    }
    return result.join('\n');
  },
  propsToYaml: (t) => {
    const lines = t.split('\n').filter(l => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('!'));
    const root = {};
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      const parts = key.split('.');
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }
    function toYaml(obj, indent = 0) {
      const prefix = '  '.repeat(indent);
      let result = '';
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          result += `${prefix}${k}:\n${toYaml(v, indent + 1)}`;
        } else {
          const val = String(v);
          const needQuote = /[:{}\[\],&*?|<>=!%@`#'"\n]/.test(val) || val.trim() !== val || val === '';
          result += `${prefix}${k}: ${needQuote ? `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : val}\n`;
        }
      }
      return result;
    }
    return toYaml(root).trimEnd();
  },
  toFullWidth: (t) => t.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0xFEE0)).replace(/ /g, '　'),
  toHalfWidth: (t) => t.replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' '),
  sqlFormat: (t) => {
    if (!t.trim()) return t;
    const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'ON', 'AS', 'DISTINCT', 'UNION', 'UNION ALL', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'NOT NULL', 'DEFAULT', 'AUTO_INCREMENT', 'VARCHAR', 'INT', 'INTEGER', 'TEXT', 'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP', 'DECIMAL', 'FLOAT', 'DOUBLE', 'BLOB', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'ASC', 'DESC', 'FETCH', 'NEXT', 'ROWS', 'ONLY', 'WITH', 'RECURSIVE', 'OVER', 'PARTITION', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE'];
    let result = t.replace(/\s+/g, ' ').trim();
    const topKeywords = ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'WITH'];
    topKeywords.forEach(kw => {
      const regex = new RegExp('\\b(' + kw + ')\\b', 'gi');
      result = result.replace(regex, '\n$1');
    });
    const midKeywords = ['AND', 'OR', 'ON', 'SET', 'VALUES', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'UNION', 'UNION ALL', 'FETCH', 'PARTITION'];
    midKeywords.forEach(kw => {
      const regex = new RegExp('\\b(' + kw + ')\\b', 'gi');
      result = result.replace(regex, '\n  $1');
    });
    result = result.split('\n').map(line => {
      let trimmed = line.trim();
      if (!trimmed) return '';
      keywords.forEach(kw => {
        const regex = new RegExp('\\b' + kw + '\\b', 'gi');
        trimmed = trimmed.replace(regex, kw);
      });
      return trimmed;
    }).filter(l => l).join('\n');
    return result;
  },
  sqlMinify: (t) => t.replace(/\s+/g, ' ').trim(),
  timestampToDate: (t) => {
    const n = Number(t.trim());
    if (isNaN(n)) return t;
    const ms = String(Math.floor(n)).length <= 10 ? n * 1000 : n;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return t;
    const pad = (v) => String(v).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  },
  dateToTimestamp: (t) => {
    const d = new Date(t.trim());
    if (isNaN(d.getTime())) return t;
    return String(d.getTime());
  },
  md5: async (t) => {
    function md5hash(str) {
      function safeAdd(x, y) { const l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); }
      function bitRotateLeft(n, c) { return (n << c) | (n >>> (32 - c)); }
      function md5cmn(q, a, b, x, s, t) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
      function md5ff(a,b,c,d,x,s,t){ return md5cmn((b&c)|((~b)&d),a,b,x,s,t); }
      function md5gg(a,b,c,d,x,s,t){ return md5cmn((b&d)|(c&(~d)),a,b,x,s,t); }
      function md5hh(a,b,c,d,x,s,t){ return md5cmn(b^c^d,a,b,x,s,t); }
      function md5ii(a,b,c,d,x,s,t){ return md5cmn(c^(b|(~d)),a,b,x,s,t); }
      function binlMD5(x, len) {
        x[len >> 5] |= 0x80 << (len % 32);
        x[((len + 64) >>> 9 << 4) + 14] = len;
        let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
        for (let i = 0; i < x.length; i += 16) {
          const oa = a, ob = b, oc = c, od = d;
          a=md5ff(a,b,c,d,x[i],7,-680876936);d=md5ff(d,a,b,c,x[i+1],12,-389564586);c=md5ff(c,d,a,b,x[i+2],17,606105819);b=md5ff(b,c,d,a,x[i+3],22,-1044525330);
          a=md5ff(a,b,c,d,x[i+4],7,-176418897);d=md5ff(d,a,b,c,x[i+5],12,1200080426);c=md5ff(c,d,a,b,x[i+6],17,-1473231341);b=md5ff(b,c,d,a,x[i+7],22,-45705983);
          a=md5ff(a,b,c,d,x[i+8],7,1770035416);d=md5ff(d,a,b,c,x[i+9],12,-1958414417);c=md5ff(c,d,a,b,x[i+10],17,-42063);b=md5ff(b,c,d,a,x[i+11],22,-1990404162);
          a=md5ff(a,b,c,d,x[i+12],7,1804603682);d=md5ff(d,a,b,c,x[i+13],12,-40341101);c=md5ff(c,d,a,b,x[i+14],17,-1502002290);b=md5ff(b,c,d,a,x[i+15],22,1236535329);
          a=md5gg(a,b,c,d,x[i+1],5,-165796510);d=md5gg(d,a,b,c,x[i+6],9,-1069501632);c=md5gg(c,d,a,b,x[i+11],14,643717713);b=md5gg(b,c,d,a,x[i],20,-373897302);
          a=md5gg(a,b,c,d,x[i+5],5,-701558691);d=md5gg(d,a,b,c,x[i+10],9,38016083);c=md5gg(c,d,a,b,x[i+15],14,-660478335);b=md5gg(b,c,d,a,x[i+4],20,-405537848);
          a=md5gg(a,b,c,d,x[i+9],5,568446438);d=md5gg(d,a,b,c,x[i+14],9,-1019803690);c=md5gg(c,d,a,b,x[i+3],14,-187363961);b=md5gg(b,c,d,a,x[i+8],20,1163531501);
          a=md5gg(a,b,c,d,x[i+13],5,-1444681467);d=md5gg(d,a,b,c,x[i+2],9,-51403784);c=md5gg(c,d,a,b,x[i+7],14,1735328473);b=md5gg(b,c,d,a,x[i+12],20,-1926607734);
          a=md5hh(a,b,c,d,x[i+5],4,-378558);d=md5hh(d,a,b,c,x[i+8],11,-2022574463);c=md5hh(c,d,a,b,x[i+11],16,1839030562);b=md5hh(b,c,d,a,x[i+14],23,-35309556);
          a=md5hh(a,b,c,d,x[i+1],4,-1530992060);d=md5hh(d,a,b,c,x[i+4],11,1272893353);c=md5hh(c,d,a,b,x[i+6],16,-155497632);b=md5hh(b,c,d,a,x[i+9],23,-1094730640);
          a=md5hh(a,b,c,d,x[i+12],4,681279174);d=md5hh(d,a,b,c,x[i+15],11,-358537222);c=md5hh(c,d,a,b,x[i+2],16,-722521979);b=md5hh(b,c,d,a,x[i+3],23,76029189);
          a=md5hh(a,b,c,d,x[i+6],4,-640364487);d=md5hh(d,a,b,c,x[i+9],11,-421815835);c=md5hh(c,d,a,b,x[i+12],16,530742520);b=md5hh(b,c,d,a,x[i+15],23,-995338651);
          a=md5ii(a,b,c,d,x[i],6,-198630844);d=md5ii(d,a,b,c,x[i+7],10,1126891415);c=md5ii(c,d,a,b,x[i+14],15,-1416354905);b=md5ii(b,c,d,a,x[i+5],21,-57434055);
          a=md5ii(a,b,c,d,x[i+12],6,1700485571);d=md5ii(d,a,b,c,x[i+3],10,-1894986606);c=md5ii(c,d,a,b,x[i+10],15,-1051523);b=md5ii(b,c,d,a,x[i+1],21,-2054922799);
          a=md5ii(a,b,c,d,x[i+8],6,1873313359);d=md5ii(d,a,b,c,x[i+15],10,-30611744);c=md5ii(c,d,a,b,x[i+6],15,-1560198380);b=md5ii(b,c,d,a,x[i+13],21,1309151649);
          a=md5ii(a,b,c,d,x[i+4],6,-145523070);d=md5ii(d,a,b,c,x[i+11],10,-1120210379);c=md5ii(c,d,a,b,x[i+2],15,718787259);b=md5ii(b,c,d,a,x[i+9],21,-343485551);
          a=safeAdd(a,oa);b=safeAdd(b,ob);c=safeAdd(c,oc);d=safeAdd(d,od);
        }
        return [a, b, c, d];
      }
      function str2binl(str) {
        const bin = [];
        const mask = (1 << 8) - 1;
        for (let i = 0; i < str.length * 8; i += 8)
          bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << (i % 32);
        return bin;
      }
      function binl2hex(binarray) {
        const hexTab = '0123456789abcdef';
        let str = '';
        for (let i = 0; i < binarray.length * 4; i++)
          str += hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0xF) + hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0xF);
        return str;
      }
      const utf8 = unescape(encodeURIComponent(str));
      return binl2hex(binlMD5(str2binl(utf8), utf8.length * 8));
    }
    return md5hash(t);
  },
  sha1: async (t) => {
    const buf = new TextEncoder().encode(t);
    const hash = await crypto.subtle.digest('SHA-1', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  sha256: async (t) => {
    const buf = new TextEncoder().encode(t);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  sha512: async (t) => {
    const buf = new TextEncoder().encode(t);
    const hash = await crypto.subtle.digest('SHA-512', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  generateQR: async (t) => {
    if (!t.trim()) return t;
    try {
      const dataURL = await QRCode.toDataURL(t, { width: 300, margin: 1 });
      return `__QR_CODE_DATA_URL__${dataURL}`;
    } catch (err) {
      console.error('QR生成失败:', err);
      return t;
    }
  },
};

// ============ 工具分组配置 ============
const TOOL_GROUPS = [
  { title: '文本清理', items: [
    { key: 'trimSpaces', label: '去多余空格' },
    { key: 'removeBlankLines', label: '去空行' },
    { key: 'removeAllSpaces', label: '去所有空格' },
  ]},
  { title: '格式转换', items: [
    { key: 'newlineToComma', label: '换行→逗号' },
    { key: 'newlineToQuotedComma', label: '换行→引号逗号' },
  ]},
  { title: '大小写', items: [
    { key: 'upperCase', label: '大写' },
    { key: 'lowerCase', label: '小写' },
    { key: 'titleCase', label: '首字母大写' },
  ]},
  { title: '全角半角', items: [
    { key: 'toFullWidth', label: '转全角' },
    { key: 'toHalfWidth', label: '转半角' },
  ]},
  { title: '行操作', items: [
    { key: 'dedupeLines', label: '去重行' },
    { key: 'sortAsc', label: '升序排序' },
    { key: 'sortDesc', label: '降序排序' },
    { key: 'reverseLines', label: '反转行序' },
  ]},
  { title: '编码/解码', items: [
    { key: 'urlEncode', label: 'URL编码' },
    { key: 'urlDecode', label: 'URL解码' },
    { key: 'base64Encode', label: 'Base64编码' },
    { key: 'base64Decode', label: 'Base64解码' },
    { key: 'unicodeEncode', label: 'Unicode编码' },
    { key: 'unicodeDecode', label: 'Unicode解码' },
  ]},
  { title: 'JSON', items: [
    { key: 'jsonFormat', label: 'JSON格式化' },
    { key: 'jsonMinify', label: 'JSON压缩' },
  ]},
  { title: 'SQL', items: [
    { key: 'sqlFormat', label: 'SQL格式化' },
    { key: 'sqlMinify', label: 'SQL压缩' },
  ]},
  { title: '配置转换', items: [
    { key: 'yamlToProps', label: 'YAML→Props' },
    { key: 'propsToYaml', label: 'Props→YAML' },
  ]},
  { title: '时间戳', items: [
    { key: 'timestampToDate', label: '时间戳→日期' },
    { key: 'dateToTimestamp', label: '日期→时间戳' },
  ]},
  { title: '哈希计算', items: [
    { key: 'md5', label: 'MD5' },
    { key: 'sha1', label: 'SHA-1' },
    { key: 'sha256', label: 'SHA-256' },
    { key: 'sha512', label: 'SHA-512' },
  ]},
  { title: '实用工具', items: [
    { key: 'generateQR', label: '生成二维码' },
  ]},
  { title: '密码工具', items: [
    { key: 'pwdGen', label: '密码生成', action: 'panel' },
  ]},
  { title: '校验码', items: [
    { key: 'totp', label: '谷歌校验码', action: 'panel' },
  ]},
];

// ============ 文本统计 ============
function textStats(t) {
  const chars = t.length;
  const charsNoSpace = t.replace(/\s/g, '').length;
  const lines = t === '' ? 0 : t.split('\n').length;
  const words = (t.match(/[一-鿿]|[a-zA-Z]+/g) || []).length;
  const chinese = (t.match(/[一-鿿]/g) || []).length;
  const punctuation = (t.match(/[，。！？、；：""''【】《》（）…—·\.\,\!\?\;\:\"\'\(\)\[\]\{\}\-\/\\@#\$%\^&\*\+\=\~\`<>]/g) || []).length;
  const spaces = (t.match(/ /g) || []).length;
  const lineBreaks = t === '' ? 0 : (t.match(/\n/g) || []).length;
  const digits = (t.match(/[0-9]/g) || []).length;
  return { chars, charsNoSpace, lines, words, chinese, punctuation, spaces, lineBreaks, digits };
}

// ============ 工具函数 ============
function isLight(h) {
  const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
  return (r*299+g*587+b*114)/1000 > 150;
}
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============ RSA 加解密（原生 BigInt）============
function utf8ToBytes(text) { return new Uint8Array(new TextEncoder().encode(text)); }
function bytesToBigInt(bytes) {
  if (bytes.length === 0) return 0n;
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return BigInt('0x' + hex);
}
function bigIntToFixedBytes(value, length) {
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const rawLength = hex.length / 2;
  if (rawLength > length) throw new Error('结果长度超出密钥块大小');
  hex = hex.padStart(length * 2, '0');
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function base64ToBytes(base64Text) {
  const binary = atob(base64Text.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function modPow(base, exponent, modulus) {
  if (modulus === 1n) return 0n;
  let result = 1n;
  let currentBase = base % modulus;
  let currentExponent = exponent;
  while (currentExponent > 0n) {
    if ((currentExponent & 1n) === 1n) result = (result * currentBase) % modulus;
    currentExponent >>= 1n;
    currentBase = (currentBase * currentBase) % modulus;
  }
  return result;
}
function readDerLength(bytes, offset) {
  const first = bytes[offset];
  if (first < 0x80) return { length: first, nextOffset: offset + 1 };
  const count = first & 0x7f;
  if (count === 0 || count > 4) throw new Error('不支持的 DER 长度格式');
  let length = 0;
  for (let i = 0; i < count; i++) length = (length << 8) | bytes[offset + 1 + i];
  return { length, nextOffset: offset + 1 + count };
}
function readDerElement(bytes, offset) {
  if (offset >= bytes.length) throw new Error('DER 读取越界');
  const tag = bytes[offset];
  const lengthInfo = readDerLength(bytes, offset + 1);
  const valueStart = lengthInfo.nextOffset;
  const valueEnd = valueStart + lengthInfo.length;
  if (valueEnd > bytes.length) throw new Error('DER 长度超出范围');
  return { tag, value: bytes.slice(valueStart, valueEnd), nextOffset: valueEnd };
}
function stripIntegerLeadingZero(bytes) { return bytes.length > 1 && bytes[0] === 0 ? bytes.slice(1) : bytes; }
function parsePublicKey(derBytes) {
  const top = readDerElement(derBytes, 0);
  if (top.tag !== 0x30) throw new Error('公钥格式错误');
  let offset = 0;
  const algorithm = readDerElement(top.value, offset); offset = algorithm.nextOffset;
  const bitString = readDerElement(top.value, offset);
  if (bitString.tag !== 0x03 || bitString.value[0] !== 0x00) throw new Error('公钥 BIT STRING 格式错误');
  const inner = bitString.value.slice(1);
  const innerSeq = readDerElement(inner, 0);
  let innerOffset = 0;
  const modulusEl = readDerElement(innerSeq.value, innerOffset); innerOffset = modulusEl.nextOffset;
  const exponentEl = readDerElement(innerSeq.value, innerOffset);
  const modulusBytes = stripIntegerLeadingZero(modulusEl.value);
  return { modulus: bytesToBigInt(modulusBytes), exponent: bytesToBigInt(exponentEl.value), byteLength: modulusBytes.length };
}
function parsePrivateKey(derBytes) {
  const top = readDerElement(derBytes, 0);
  if (top.tag !== 0x30) throw new Error('私钥格式错误');
  let offset = 0;
  const version = readDerElement(top.value, offset); offset = version.nextOffset;
  const algorithm = readDerElement(top.value, offset); offset = algorithm.nextOffset;
  const privateKeyOctet = readDerElement(top.value, offset);
  const innerSeq = readDerElement(privateKeyOctet.value, 0);
  let innerOffset = 0;
  const rsaVersion = readDerElement(innerSeq.value, innerOffset); innerOffset = rsaVersion.nextOffset;
  const modulusEl = readDerElement(innerSeq.value, innerOffset); innerOffset = modulusEl.nextOffset;
  const publicExponentEl = readDerElement(innerSeq.value, innerOffset); innerOffset = publicExponentEl.nextOffset;
  const privateExponentEl = readDerElement(innerSeq.value, innerOffset);
  const modulusBytes = stripIntegerLeadingZero(modulusEl.value);
  return { modulus: bytesToBigInt(modulusBytes), exponent: bytesToBigInt(privateExponentEl.value), byteLength: modulusBytes.length };
}
function decodeKeyText(keyText) {
  const normalized = keyText.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
  if (!normalized) throw new Error('密钥内容为空');
  return base64ToBytes(normalized);
}
async function rsaGenerateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['encrypt', 'decrypt']
  );
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const pubB64 = bytesToBase64(new Uint8Array(spki));
  const privB64 = bytesToBase64(new Uint8Array(pkcs8));
  return {
    publicKey: `-----BEGIN PUBLIC KEY-----\n${pubB64.match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----`,
    privateKey: `-----BEGIN PRIVATE KEY-----\n${privB64.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----`
  };
}
function rsaEncrypt(text, publicKeyPem) {
  const derBytes = decodeKeyText(publicKeyPem);
  const keyInfo = parsePublicKey(derBytes);
  const source = utf8ToBytes(text);
  if (source.length > keyInfo.byteLength) throw new Error(`明文过长：${source.length} 字节，最大 ${keyInfo.byteLength} 字节`);
  const message = bytesToBigInt(source);
  if (message >= keyInfo.modulus) throw new Error('明文数值超出模数范围');
  const encrypted = modPow(message, keyInfo.exponent, keyInfo.modulus);
  const encryptedBytes = bigIntToFixedBytes(encrypted, keyInfo.byteLength);
  return bytesToBase64(encryptedBytes);
}
function rsaDecrypt(cipherB64, privateKeyPem) {
  const derBytes = decodeKeyText(privateKeyPem);
  const keyInfo = parsePrivateKey(derBytes);
  const cipherBytes = base64ToBytes(cipherB64);
  if (cipherBytes.length > keyInfo.byteLength) throw new Error('密文长度超过密钥块大小');
  const cipherInt = bytesToBigInt(cipherBytes);
  const decrypted = modPow(cipherInt, keyInfo.exponent, keyInfo.modulus);
  const plainBytes = bigIntToFixedBytes(decrypted, keyInfo.byteLength);
  let start = 0, end = plainBytes.length;
  while (start < end && plainBytes[start] === 0) start++;
  while (end > start && plainBytes[end - 1] === 0) end--;
  return new TextDecoder('utf-8', { fatal: false }).decode(plainBytes.slice(start, end)).trim();
}
