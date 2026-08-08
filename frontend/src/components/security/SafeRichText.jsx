import DOMPurify from 'dompurify';

const config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'pre', 'code', 'a',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['style', 'svg', 'math', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['style'],
};

export default function SafeRichText({ html, className }) {
  const clean = DOMPurify.sanitize(html || '', config);
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
