// Minimal PDF writer for the demo handover export: renders the subset of Markdown the export uses (headings,
// paragraphs, bullets, numbered items, quotes, **bold**, `code`) with the built-in Helvetica fonts, A4 pages.
const WIDTHS = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]
const PAGE = { width: 595, height: 842, left: 56, right: 56, top: 64, bottom: 60 }
const FONTS = { regular: 'F1', bold: 'F2', italic: 'F3' }
const REPLACE = { '→': '->', '←': '<-', '“': '"', '”': '"', '‘': "'", '’': "'", '…': '...', '•': '\x95', '—': '\x97', '–': '\x96', '≥': '>=', '≤': '<=', '✓': '', '✕': 'x', '\u00a0': ' ' }

const toWinAnsi = text => [...String(text)].map(ch => REPLACE[ch] ?? (ch.charCodeAt(0) < 256 ? ch : '?')).join('')
const charWidth = code => (code >= 32 && code <= 126 ? WIDTHS[code - 32] : code === 0x95 ? 350 : code === 0x97 ? 1000 : 556)
const measure = (text, size, font) => [...text].reduce((sum, ch) => sum + charWidth(ch.charCodeAt(0)), 0) * size / 1000 * (font === 'bold' ? 1.1 : 1)
const escape = text => [...text].map(ch => {
  const code = ch.charCodeAt(0)
  if (ch === '\\' || ch === '(' || ch === ')') return `\\${ch}`
  return code > 126 || code < 32 ? `\\${code.toString(8).padStart(3, '0')}` : ch
}).join('')

// "**Label:** rest `code`" -> styled runs.
function runsOf(text, base = 'regular') {
  const runs = []
  String(text).split(/(\*\*[^*]+\*\*)/).forEach(part => {
    if (!part) return
    if (/^\*\*[^*]+\*\*$/.test(part)) runs.push({ text: part.slice(2, -2), font: 'bold' })
    else runs.push({ text: part.replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1 ($2)'), font: base })
  })
  return runs
}

const STYLES = {
  h1: { size: 19, lead: 25, font: 'bold', color: '0.06 0.09 0.11', before: 0, after: 6 },
  h2: { size: 13.5, lead: 19, font: 'bold', color: '0.02 0.45 0.33', before: 12, after: 6, rule: true },
  h3: { size: 10.5, lead: 14.5, font: 'bold', color: '0.1 0.12 0.15', before: 7, after: 2 },
  p: { size: 9.8, lead: 14, font: 'regular', color: '0.16 0.18 0.21', before: 0, after: 4 },
  quote: { size: 9.2, lead: 13, font: 'italic', color: '0.38 0.4 0.45', before: 0, after: 6 },
  item: { size: 9.8, lead: 14, font: 'regular', color: '0.16 0.18 0.21', before: 0, after: 2 }
}

function blocksOf(markdown) {
  const blocks = []
  for (const raw of String(markdown).split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) { blocks.push({ type: 'gap' }); continue }
    let match
    if ((match = /^(#{1,3})\s+(.*)$/.exec(line))) blocks.push({ type: `h${match[1].length}`, text: match[2] })
    else if ((match = /^>\s?(.*)$/.exec(line))) blocks.push({ type: 'quote', text: match[1] })
    else if ((match = /^(\s*)[-*]\s+(.*)$/.exec(line))) blocks.push({ type: 'item', marker: '\x95', indent: match[1].length >= 2 ? 1 : 0, text: match[2] })
    else if ((match = /^(\s*)(\d+)\.\s+(.*)$/.exec(line))) blocks.push({ type: 'item', marker: `${match[2]}.`, indent: match[1].length >= 2 ? 1 : 0, text: match[3] })
    else if ((match = /^\*([^*].*)\*$/.exec(line))) blocks.push({ type: 'quote', text: match[1] })
    else blocks.push({ type: 'p', text: line })
  }
  return blocks
}

// Word-wraps styled runs into lines of [{ text, font, x }].
function wrap(runs, size, width) {
  const words = runs.flatMap(run => toWinAnsi(run.text).split(/(\s+)/).filter(Boolean).map(text => ({ text, font: run.font })))
  const lines = []
  let line = []
  let x = 0
  for (const word of words) {
    const space = /^\s+$/.test(word.text)
    if (space) { if (line.length) { line.push({ ...word, text: ' ', x }); x += measure(' ', size, word.font) } continue }
    let w = measure(word.text, size, word.font)
    if (x + w > width && line.length) {
      while (line.length && line[line.length - 1].text === ' ') line.pop()
      lines.push(line); line = []; x = 0
    }
    // Break words that are longer than a whole line, such as URLs.
    let text = word.text
    while (w > width) {
      let cut = text.length
      while (cut > 1 && measure(text.slice(0, cut), size, word.font) > width) cut--
      lines.push([{ text: text.slice(0, cut), font: word.font, x: 0 }])
      text = text.slice(cut)
      w = measure(text, size, word.font)
    }
    line.push({ text, font: word.font, x }); x += w
  }
  if (line.length) lines.push(line)
  // One text run per font change, so the viewer's own glyph widths space the words inside it.
  return lines.map(parts => parts.reduce((merged, part) => {
    const last = merged[merged.length - 1]
    if (last && last.font === part.font) last.text += part.text
    else merged.push({ ...part })
    return merged
  }, []))
}

export function markdownToPdf(markdown, { footer = 'Baton handover' } = {}) {
  const pages = [[]]
  let y = PAGE.height - PAGE.top
  const contentWidth = PAGE.width - PAGE.left - PAGE.right
  const page = () => pages[pages.length - 1]
  const newPage = () => { pages.push([]); y = PAGE.height - PAGE.top }

  for (const block of blocksOf(markdown)) {
    if (block.type === 'gap') { y -= 3; continue }
    const style = STYLES[block.type]
    const indent = block.type === 'item' ? 14 + block.indent * 14 : 0
    const lines = wrap(runsOf(block.text, style.font), style.size, contentWidth - indent)
    const needed = style.before + Math.min(lines.length, block.type === 'h2' || block.type === 'h3' ? 1 : lines.length) * style.lead + (block.type.startsWith('h') ? 2 * STYLES.p.lead : 0)
    if (y - needed < PAGE.bottom) newPage()
    else y -= style.before
    lines.forEach((line, index) => {
      if (y - style.lead < PAGE.bottom) newPage()
      y -= style.lead
      if (index === 0 && block.type === 'item') page().push(`BT /${FONTS.regular} ${style.size} Tf ${style.color} rg 1 0 0 1 ${PAGE.left + indent - 12} ${y.toFixed(1)} Tm (${escape(block.marker)}) Tj ET`)
      for (const run of line) page().push(`BT /${FONTS[run.font]} ${style.size} Tf ${style.color} rg 1 0 0 1 ${(PAGE.left + indent + run.x).toFixed(1)} ${y.toFixed(1)} Tm (${escape(run.text)}) Tj ET`)
    })
    if (style.rule) page().push(`0.82 0.86 0.88 RG 0.6 w ${PAGE.left} ${(y - 5).toFixed(1)} m ${PAGE.width - PAGE.right} ${(y - 5).toFixed(1)} l S`)
    y -= style.after
  }

  const objects = []
  const add = body => { objects.push(body); return objects.length }
  const catalog = add('')
  const pagesId = add('')
  const fonts = [add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'), add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>')]
  const kids = pages.map((ops, index) => {
    const chrome = [
      `0.2 0.83 0.6 rg 0 ${PAGE.height - 6} ${PAGE.width} 6 re f`,
      `BT /F1 7.5 Tf 0.5 0.53 0.58 rg 1 0 0 1 ${PAGE.left} 32 Tm (${escape(toWinAnsi(footer))}) Tj ET`,
      `BT /F1 7.5 Tf 0.5 0.53 0.58 rg 1 0 0 1 ${PAGE.width - PAGE.right - 52} 32 Tm (Page ${index + 1} of ${pages.length}) Tj ET`
    ]
    const stream = [...chrome, ...ops].join('\n')
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${fonts[0]} 0 R /F2 ${fonts[1]} 0 R /F3 ${fonts[2]} 0 R >> >> /Contents ${content} 0 R >>`)
  })
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(id => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((body, index) => {
    const offset = pdf.length
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
    return offset
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Uint8Array.from(pdf, ch => ch.charCodeAt(0))
}
