/**
 * html-to-image often misses SVG stroke/fill. Mutate presentation attributes on the
 * live DOM right before capture, then restore (see RackPlanner export).
 */
export function applyRackPngMonochromeSvg(root: HTMLElement): () => void {
  const undo: Array<() => void> = [];

  const setAttr = (el: Element, attr: string, value: string | null) => {
    const prev = el.getAttribute(attr);
    undo.push(() => {
      if (prev === null) el.removeAttribute(attr);
      else el.setAttribute(attr, prev);
    });
    if (value === null) el.removeAttribute(attr);
    else el.setAttribute(attr, value);
  };

  const patchStyle = (el: Element, map: (css: string) => string) => {
    const prev = el.getAttribute('style') ?? '';
    const next = map(prev).replace(/;\s*;/g, ';').trim();
    undo.push(() => {
      if (prev === '') el.removeAttribute('style');
      else el.setAttribute('style', prev);
    });
    if (next === '') el.removeAttribute('style');
    else el.setAttribute('style', next);
  };

  const stripFiltersFromStyle = (el: Element) => {
    const style = el.getAttribute('style');
    if (style && /filter\s*:/i.test(style)) {
      patchStyle(el, (s) => s.replace(/filter\s*:\s*[^;]+;?/gi, ''));
    }
  };

  const visibleSvgStroke = (el: Element): boolean => {
    const attr = el.getAttribute('stroke');
    if (attr === 'transparent') return false;
    const cs = getComputedStyle(el);
    const sw = parseFloat(cs.strokeWidth || '0');
    if (sw <= 0) return false;
    const s = cs.stroke;
    if (!s || s === 'none' || s === 'transparent') return false;
    if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/.test(s.trim())) return false;
    return true;
  };

  for (const svg of root.querySelectorAll('svg')) {
    stripFiltersFromStyle(svg);
    for (const el of svg.querySelectorAll('path,line,polyline,polygon,circle,ellipse,rect,text,tspan')) {
      stripFiltersFromStyle(el);
    }

    for (const el of svg.querySelectorAll('path,line,polyline,polygon,circle,ellipse,rect')) {
      if (el.getAttribute('stroke') === 'transparent') continue;

      if (visibleSvgStroke(el) || (el.hasAttribute('stroke') && el.getAttribute('stroke') !== 'none')) {
        setAttr(el, 'stroke', '#000000');
      }

      const tag = el.tagName.toLowerCase();
      if (tag === 'circle' || tag === 'ellipse') {
        setAttr(el, 'fill', '#ffffff');
      }
    }

    for (const el of svg.querySelectorAll('text,tspan')) {
      setAttr(el, 'fill', '#000000');
      setAttr(el, 'stroke', 'none');
      setAttr(el, 'stroke-width', '0');
      const style = el.getAttribute('style');
      if (style && (/paint-order|paintOrder/i.test(style) || /stroke/i.test(style))) {
        patchStyle(el, (s) => {
          let out = s.replace(/paint-order\s*:\s*[^;]+;?/gi, '');
          out = out.replace(/stroke-width\s*:\s*[^;]+;?/gi, '');
          out = out.replace(/stroke\s*:\s*[^;]+;?/gi, '');
          return out;
        });
      }
    }

    for (const path of svg.querySelectorAll('path')) {
      const style = path.getAttribute('style');
      if (style && /stroke\s*:/i.test(style)) {
        patchStyle(path, (s) => {
          let out = s.replace(/stroke\s*:\s*[^;]+;?/gi, 'stroke: #000000;');
          out = out.replace(/filter\s*:\s*[^;]+;?/gi, '');
          return out;
        });
      }
    }
  }

  return () => {
    for (let i = undo.length - 1; i >= 0; i--) undo[i]();
  };
}
