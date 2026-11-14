export function downloadText(filename, text, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function slugify(value, fallback = 'handover') {
  const slug = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || fallback;
}
