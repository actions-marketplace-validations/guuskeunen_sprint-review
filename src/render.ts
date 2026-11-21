import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Review } from './types.ts';
import { fill, labelsFor, localeOf, type Labels } from './i18n.ts';
import { readableOn } from './colors.ts';
import { hoodIcon, themeIcon, valueIcon, VALUE_KEYS } from './icons.ts';

const CSS = readFileSync(fileURLToPath(new URL('../assets/deck.css', import.meta.url)), 'utf8');
const DARK_CSS = readFileSync(fileURLToPath(new URL('../assets/deck-dark.css', import.meta.url)), 'utf8');

export interface RenderOptions {
  /** #rrggbb */
  color?: string | null;
  /** A data URI. */
  logo?: string | null;
  labels?: Record<string, string>;
  goal?: string | null;
  /** light (default) or dark. */
  theme?: 'dark' | 'light';
  /** Font families as CSS would take them. Fonts must be installed where the deck is shown. */
  fonts?: { heading?: string | null; body?: string | null };
}

/** A font name from a config or a .pptx, quoted, with the theme's own fonts behind it. Anything odd is dropped. */
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function fontStack(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  // A fixed fallback: --font-body set to a stack that names var(--font-body) points at itself, and
  // the browser then drops it and shows its default serif.
  return clean ? `"${clean}", ${SANS}` : 'inherit';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * The deck: one self-contained HTML page. No outside fonts, scripts or images, so it opens
 * anywhere, works offline and keeps working. Pictures are data URIs. The model wrote none of this.
 */
export function renderDeck(review: Review, options: RenderOptions = {}): string {
  const t = labelsFor(review.language, options.labels);
  const org = review.organization;
  const color = options.color && /^#[0-9a-fA-F]{6}$/.test(options.color) ? options.color : null;
  const logo = options.logo && /^data:image\/(png|jpeg|svg\+xml|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(options.logo) ? options.logo : null;
  const goal = options.goal ?? null;
  const slides: string[] = [];
  const rise = (i: number) => (i ? ` style="--i: ${i}"` : '');

  slides.push(`<section class="slide cover active">
  <div class="rings" aria-hidden="true"></div>
  ${logo ? `<img class="brand-logo plate" src="${logo}" alt="${esc(org)}">` : ''}
  <p class="label rise">${esc(t.sprintReview)}${org ? ` ${esc(org)}` : ''}</p>
  <h1 class="rise"${rise(1)}>${esc(review.title)}</h1>
  <p class="rise"${rise(2)}>${esc(review.period)}</p>
  ${goal ? `<p class="goal rise"${rise(3)}><b>${esc(t.goalLabel)}</b><span>${esc(goal)}</span></p>` : ''}
</section>`);

  const values = VALUE_KEYS.map((key) => ({ key, themes: review.themes.filter((th) => th.value === key).map((th) => th.title) })).filter((v) => v.themes.length);
  if (values.length) {
    slides.push(`<section class="slide">
  <p class="label rise">${esc(t.valuesLabel)}</p>
  <h2 class="rise"${rise(1)}>${esc(org ? fill(t.valuesTitle, { org }) : t.valuesTitleNoOrg)}</h2>
  <div class="values">${values
    .map(
      (v, i) => `
    <div class="value rise"${rise(i + 2)}>
      ${valueIcon(v.key)}
      <h3>${esc(t[`value_${v.key}` as keyof Labels])}</h3>
      <ul>${v.themes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>`,
    )
    .join('')}
  </div>
</section>`);
  }

  const tiles = review.usage.filter((u) => u.value > 0);
  if (tiles.length) {
    const nf = new Intl.NumberFormat(localeOf(review.language));
    slides.push(`<section class="slide">
  <p class="label rise">${esc(t.usageLabel)}</p>
  <h2 class="rise"${rise(1)}>${esc(fill(t.usageTitle, { product: review.product }))}</h2>
  <div class="tiles">${tiles
    .map(
      (u, i) => `
    <div class="tile-number rise"${rise(i + 2)}>
      <b data-count="${u.value}">${nf.format(u.value)}</b>
      <p>${esc(u.label)}</p>
      ${u.previous !== undefined && u.previous > 0 ? `<small class="${u.value > u.previous ? 'up' : ''}">${esc(t.previous)}: ${nf.format(u.previous)}</small>` : ''}
    </div>`,
    )
    .join('')}
  </div>
</section>`);
  }

  if (review.summary.length) {
    slides.push(`<section class="slide">
  <p class="label rise">${esc(t.summaryLabel)}</p>
  <h2 class="rise"${rise(1)}>${esc(t.summaryTitle)}</h2>
  <div class="cards">${review.summary
    .map(
      (p, i) => `
    <div class="card rise"${rise(i + 2)}>
      <span class="card-icon">${themeIcon(p.icon)}</span>
      <p>${esc(p.text)}</p>
    </div>`,
    )
    .join('')}
  </div>
  ${review.summaryNotes ? `<aside class="notes">${esc(review.summaryNotes)}</aside>` : ''}
</section>`);
  }

  review.themes.forEach((th, i) => {
    const onPhone = th.screen?.device === 'phone';
    slides.push(`<section class="slide">
  <div class="theme ${th.screen ? 'with-screen' : ''} ${onPhone ? 'on-phone' : ''}">
    ${th.screen ? '' : `<div class="tile rise">${themeIcon(th.icon)}</div>`}
    <div class="theme-text">
      <p class="label rise"${rise(1)}>${esc(fill(t.themeCount, { n: i + 1, total: review.themes.length }))}</p>
      <h2 class="rise"${rise(2)}>${esc(th.title)}</h2>
      ${th.value ? `<span class="pill rise"${rise(2)}>${valueIcon(th.value)}${esc(t[`value_${th.value}` as keyof Labels] ?? th.value)}</span>` : ''}
      ${th.effect ? `<p class="effect rise"${rise(3)}>${esc(th.effect)}</p>` : ''}
      <ul class="points">${th.points.map((p, j) => `\n        <li class="rise"${rise(j + 4)}>${esc(p)}</li>`).join('')}
      </ul>
    </div>
    ${th.screen ? `<figure class="screen ${onPhone ? 'phone ' : ''}rise"${rise(3)}><img src="${th.screen.image}" alt="${esc(onPhone ? fill(t.onPhone, { name: th.screen.name }) : th.screen.name)}"></figure>` : ''}
  </div>
  ${th.notes ? `<aside class="notes">${esc(th.notes)}</aside>` : ''}
</section>`);
  });

  for (const s of review.screens) {
    slides.push(`<section class="slide">
  <p class="label rise">${esc(t.screensLabel)}</p>
  <h2 class="rise"${rise(1)}>${esc(s.name)}</h2>
  ${s.caption ? `<p class="effect rise"${rise(2)}>${esc(s.caption)}</p>` : ''}
  <div class="compare ${s.device === 'phone' ? 'phone' : ''}">
    <figure class="rise"${rise(2)}>
      <figcaption>${esc(t.before)}</figcaption>
      <img src="${s.before}" alt="${esc(fill(t.beforeAlt, { name: s.name }))}">
    </figure>
    <figure class="after rise"${rise(3)}>
      <figcaption>${esc(t.after)}</figcaption>
      <img src="${s.after}" alt="${esc(fill(t.afterAlt, { name: s.name }))}">
    </figure>
  </div>
</section>`);
  }

  if (review.milestones.length) {
    const reached = review.milestones.filter((m) => m.done).length;
    slides.push(`<section class="slide">
  <p class="label rise">${esc(t.roadmapLabel)}</p>
  <h2 class="rise"${rise(1)}>${esc(t.roadmapTitle)}</h2>
  <p class="rise"${rise(2)}>${esc(fill(t.roadmapReached, { n: reached, total: review.milestones.length }))}</p>
  <div class="meter rise"${rise(2)}><i style="width: ${Math.round((reached / review.milestones.length) * 100)}%"></i></div>
  <ul class="milestones">${review.milestones.map((m, i) => `\n    <li class="rise ${m.done ? 'done' : ''}"${rise(Math.min(i + 3, 12))}>${esc(m.text)}</li>`).join('')}
  </ul>
</section>`);
  }

  if (review.underTheHood.length) {
    slides.push(`<section class="slide hood">
  <div class="theme">
    <div class="tile rise">${hoodIcon()}</div>
    <div class="theme-text">
      <p class="label rise"${rise(1)}>${esc(t.hoodLabel)}</p>
      <h2 class="rise"${rise(2)}>${esc(t.hoodTitle)}</h2>
      <ul class="points">${review.underTheHood.map((p, i) => `\n        <li class="rise"${rise(i + 3)}>${esc(p)}</li>`).join('')}
      </ul>
    </div>
  </div>
</section>`);
  }

  slides.push(`<section class="slide cover">
  <div class="rings" aria-hidden="true"></div>
  <h1 class="rise">${esc(t.questions)}</h1>
  <p class="rise"${rise(1)}>${esc(review.title)}</p>
</section>`);

  const hasNotes = !!review.summaryNotes || review.themes.some((th) => th.notes);
  const theme = options.theme === 'dark' ? 'dark' : 'light';
  // The brand color as text and icons must read on the theme's background; readableOn shifts it only when it doesn't.
  const accent = color ? readableOn(color, theme === 'dark' ? '#0a0a0d' : '#ffffff') : null;
  const brandCss = !color
    ? ''
    : theme === 'dark'
      ? `html[data-theme="dark"] { --accent: ${accent}; --accent-deep: color-mix(in srgb, ${accent} 65%, #000); --accent-soft: color-mix(in srgb, ${accent} 12%, transparent); --accent-glow: color-mix(in srgb, ${accent} 24%, transparent); }`
      : `:root { --accent: ${accent}; --accent-deep: color-mix(in srgb, ${accent} 70%, #0f172a); --accent-soft: color-mix(in srgb, ${accent} 9%, #fff); }`;
  const fontCss = [
    options.fonts?.heading ? `--font-heading: ${fontStack(options.fonts.heading)};` : '',
    options.fonts?.body ? `--font-body: ${fontStack(options.fonts.body)};` : '',
  ].join(' ').trim();
  const lang = localeOf(review.language);

  return `<!doctype html>
<html lang="${esc(lang)}" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="sprint-review">
<title>${esc(review.title)}</title>
<meta name="description" content="${esc(review.period)}${org ? `, ${esc(org)}` : ''}">
<meta property="og:title" content="${esc(review.title)}">
<meta property="og:description" content="${esc(review.period)}">
<script>document.documentElement.classList.add('js')</script>
<style>
${CSS}
${theme === 'dark' ? DARK_CSS : ''}
  ${brandCss}
  ${fontCss ? `html[data-theme] { ${fontCss} }` : ''}
  :root { --notes-label: "${t.notesLabel.replace(/["\\]/g, '')}"; }
</style>
</head>
<body>

${slides.join('\n\n')}

<div class="progress" aria-hidden="true"></div>
<div class="counter" aria-live="polite"></div>
<button class="edit-button" type="button" hidden>${esc(t.edit)}</button>
<div class="edit-panel" role="dialog" hidden><p>${esc(t.editStart)}</p><code></code><button type="button">${esc(t.copy)}</button></div>
<div class="hint" aria-hidden="true"><kbd>←</kbd> <kbd>→</kbd> ${esc(t.hintBrowse)} · <kbd>F</kbd> ${esc(t.hintFullscreen)} · <kbd>P</kbd> ${esc(t.hintPresenter)}${hasNotes ? ` · <kbd>N</kbd> ${esc(t.hintNotes)}` : ''}</div>

<script>
${script(t, lang)}
</script>
</body>
</html>
`;
}

/** Navigation, the count-up of numbers, the self-drawing icons and the presenter window. */
function script(t: Labels, lang: string): string {
  const L = JSON.stringify({
    presenter: t.presenter,
    prev: t.previousSlide,
    next: t.nextSlide,
    slideOf: t.slideOf,
    noNotes: t.noNotes,
    upNext: t.upNext,
    last: t.lastSlide,
    copy: t.copy,
    copied: t.copied,
    lang,
  }).replace(/</g, '\\u003c');
  return `(function () {
  var L = ${L};
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var progress = document.querySelector('.progress');
  var counter = document.querySelector('.counter');
  var current = 0;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf = new Intl.NumberFormat(L.lang);

  // A number counts up from zero when its slide opens.
  function countUp(slide) {
    if (reducedMotion) return;
    Array.prototype.forEach.call(slide.querySelectorAll('[data-count]'), function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      var startAt = null;
      function step(now) {
        if (startAt === null) startAt = now;
        var k = Math.min(1, (now - startAt) / 900);
        el.textContent = nf.format(Math.round(target * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(step);
      }
      el.textContent = '0';
      requestAnimationFrame(step);
    });
  }

  function show(n) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    slides[current].classList.remove('active');
    current = n;
    slides[current].classList.add('active');
    progress.style.width = ((current + 1) / slides.length * 100) + '%';
    counter.textContent = (current + 1) + ' / ' + slides.length;
    try { if (history.replaceState) history.replaceState(null, '', '#' + (current + 1)); } catch (e) { /* not allowed in an embedded preview */ }
    countUp(slides[current]);
    tellPresenter();
    // Embedded (the editor's preview, a landing page): tell the page around it where we are.
    if (window.parent !== window) window.parent.postMessage({ type: 'sprint-review:slide', n: current + 1, total: slides.length }, '*');
  }
  // ...and let it move the deck: { type: 'sprint-review:go', to: 3 | 'next' | 'prev' }.
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (window.parent === window || e.source !== window.parent || !d || d.type !== 'sprint-review:go') return;
    if (d.to === 'next') show(current + 1);
    else if (d.to === 'prev') show(current - 1);
    else if (typeof d.to === 'number') show(d.to - 1);
  });
  // Edit: only on the deck opened from your own disk, never in a published deck or a preview.
  // A file can't start the editor, so the button opens it when it runs and else shows how to start it.
  var editButton = document.querySelector('.edit-button');
  var editPanel = document.querySelector('.edit-panel');
  var EDITOR = 'http://127.0.0.1:4321/';
  if (location.protocol === 'file:' && window.parent === window && editButton && editPanel) {
    var path = decodeURIComponent(location.pathname).replace(/^\\/([A-Za-z]:)/, '$1').replace(/[^\\/]*$/, 'review.json');
    var command = 'npx @guuskeunen/sprint-review edit "' + path + '"';
    editPanel.querySelector('code').textContent = command;
    editButton.hidden = false;
    editButton.addEventListener('click', function () {
      fetch(EDITOR, { mode: 'no-cors', signal: AbortSignal.timeout ? AbortSignal.timeout(1500) : undefined })
        .then(function () { editPanel.hidden = true; window.open(EDITOR, 'sprint-review-editor'); })
        .catch(function () { editPanel.hidden = !editPanel.hidden; });
    });
    var copyButton = editPanel.querySelector('button');
    copyButton.addEventListener('click', function () {
      navigator.clipboard.writeText(command).then(function () { copyButton.textContent = L.copied; setTimeout(function () { copyButton.textContent = L.copy; }, 1500); });
    });
  }

  window.addEventListener('hashchange', function () {
    var n = parseInt((location.hash || '').slice(1), 10);
    if (n > 0 && n - 1 !== current) show(n - 1);
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.closest && e.target.closest('.edit-button, .edit-panel')) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].indexOf(e.key) !== -1) { e.preventDefault(); show(current + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].indexOf(e.key) !== -1) { e.preventDefault(); show(current - 1); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
    else if (e.key === 'n' || e.key === 'N') document.body.classList.toggle('show-notes');
    else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    else if (e.key === 'p' || e.key === 'P') openPresenter();
  });

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(function () {});
    } catch (e) {}
  }

  var hint = document.querySelector('.hint');
  var hintTimer = null;
  function wakeHint() {
    hint.classList.remove('quiet');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hint.classList.add('quiet'); }, 4000);
  }
  document.addEventListener('mousemove', wakeHint);

  // The presenter window: notes, the next slide and a timer, for the presenter's own screen.
  var presenter = null;
  var startedAt = null;
  function slideTitle(slide) {
    var h = slide && slide.querySelector('h1, h2');
    return h ? h.textContent.trim() : '';
  }
  function fmt(s, v) { return s.replace(/\\{(\\w+)\\}/g, function (m, k) { return k in v ? v[k] : m; }); }
  function tellPresenter() {
    if (!presenter || presenter.closed) return;
    var notes = slides[current].querySelector('.notes');
    presenter.postMessage({
      type: 'state',
      place: fmt(L.slideOf, { n: current + 1, total: slides.length }),
      title: slideTitle(slides[current]),
      next: current + 1 < slides.length ? fmt(L.upNext, { title: slideTitle(slides[current + 1]) }) : L.last,
      notes: notes ? notes.textContent.trim() : '',
      startedAt: startedAt
    }, '*');
  }
  function openPresenter() {
    if (presenter && !presenter.closed) { presenter.focus(); return; }
    var page = '<!doctype html><html><head><meta charset="utf-8"><title>' + L.presenter + '</title><style>'
      + 'body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:grid;grid-template-rows:auto 1fr auto;height:100vh}'
      + 'header,footer{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;font-size:14px;color:#94a3b8}'
      + 'main{padding:8px 24px;overflow:auto}h1{font-size:28px;margin:0 0 16px;color:#fff}#notes{font-size:22px;line-height:1.5;white-space:pre-line}'
      + '.empty{color:#64748b}#time{font-variant-numeric:tabular-nums;font-size:22px;color:#fff}'
      + 'button{font:inherit;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:8px 16px;cursor:pointer}button:hover{background:#334155}'
      + '</style></head><body><header><span id="place"></span><span id="time">0:00</span></header>'
      + '<main><h1 id="title"></h1><p id="notes"></p></main>'
      + '<footer><button id="prev">' + L.prev + '</button><span id="next"></span><button id="forward">' + L.next + '</button></footer>'
      + '<script>var since=null,empty=' + JSON.stringify(L.noNotes) + ';'
      + 'function go(to){opener&&opener.postMessage({type:"go",to:to},"*")}'
      + 'document.getElementById("prev").onclick=function(){go("prev")};document.getElementById("forward").onclick=function(){go("next")};'
      + 'addEventListener("keydown",function(e){if(["ArrowRight","ArrowDown","PageDown"," ","Enter"].indexOf(e.key)>-1){e.preventDefault();go("next")}else if(["ArrowLeft","ArrowUp","PageUp","Backspace"].indexOf(e.key)>-1){e.preventDefault();go("prev")}});'
      + 'addEventListener("message",function(e){var s=e.data;if(!s||s.type!=="state")return;since=s.startedAt;'
      + 'document.getElementById("place").textContent=s.place;document.getElementById("title").textContent=s.title;'
      + 'var n=document.getElementById("notes");n.textContent=s.notes||empty;n.className=s.notes?"":"empty";'
      + 'document.getElementById("next").textContent=s.next});'
      + 'setInterval(function(){if(!since)return;var t=Math.floor((Date.now()-since)/1000);document.getElementById("time").textContent=Math.floor(t/60)+":"+String(t%60).padStart(2,"0")},1000);'
      + 'opener&&opener.postMessage({type:"ready"},"*");<\\/script></body></html>';
    var url = URL.createObjectURL(new Blob([page], { type: 'text/html' }));
    presenter = window.open(url, 'sprint-review-presenter', 'popup,width=900,height=560');
    if (!presenter) document.body.classList.add('show-notes');
  }
  window.addEventListener('message', function (e) {
    if (!presenter || e.source !== presenter || !e.data) return;
    if (e.data.type === 'ready') { if (startedAt === null) startedAt = Date.now(); tellPresenter(); }
    else if (e.data.type === 'go') show(current + (e.data.to === 'prev' ? -1 : 1));
  });
  function onEdit(e) { return e.target && e.target.closest && e.target.closest('.edit-button, .edit-panel'); }
  document.addEventListener('click', function (e) {
    if (onEdit(e)) return;
    show(e.clientX < window.innerWidth / 3 ? current - 1 : current + 1);
  });
  var touchX = null;
  document.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) show(dx < 0 ? current + 1 : current - 1);
    touchX = null;
  });

  // The icons draw themselves: every shape gets a length of 1.
  Array.prototype.forEach.call(document.querySelectorAll('.tile .icon, .card-icon .icon, .value .icon'), function (icon) {
    Array.prototype.forEach.call(icon.querySelectorAll('path, circle, rect, line, polyline, polygon, ellipse'), function (shape) {
      shape.setAttribute('pathLength', '1');
    });
    icon.classList.add('draw');
  });

  var start = parseInt((location.hash || '').slice(1), 10);
  show(start > 0 ? start - 1 : 0);
  wakeHint();
})();`;
}
