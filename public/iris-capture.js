(function () {
  // ── Set this to your Iris domain (the one in your browser when the app is open).
  var API = 'https://iris-jet-eight.vercel.app';

  function getMeta(prop) {
    var el = document.querySelector('meta[property="' + prop + '"]') || document.querySelector('meta[name="' + prop + '"]');
    return el ? el.content : '';
  }
  function _absoluteUrl(src) {
    if (!src) return '';
    if (src.indexOf('//') === 0) return window.location.protocol + src;
    if (src.indexOf('/') === 0) return window.location.protocol + '//' + window.location.host + src;
    if (src.indexOf('http') !== 0) return window.location.protocol + '//' + window.location.host + '/' + src;
    return src;
  }
  function _extractImageSrc(el) {
    if (!el) return '';
    var src = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('data-lazy-src') ||
              el.getAttribute('data-original') || el.getAttribute('data-image') || el.getAttribute('data-zoom-image') || el.currentSrc || '';
    if (!src || src.length < 10 || src.indexOf('data:') !== -1) {
      var srcset = el.getAttribute('srcset') || el.getAttribute('data-srcset') || '';
      if (srcset) { var parts = srcset.split(',').map(function (p) { return p.trim().split(/\s+/)[0]; }); src = parts[parts.length - 1] || ''; }
    }
    if (!src || src.length < 10 || src.indexOf('data:') === 0) return '';
    return _absoluteUrl(src);
  }
  // Pinterest serves small thumbs (/236x/); bump to a larger size for a clean read.
  function upgradePin(u) {
    if (!u || u.indexOf('pinimg.com') === -1) return u;
    return u.replace(/\/\d+x\d*\//, '/736x/');
  }
  function getAllImages() {
    var seen = {}, out = [];
    function _push(u) { if (!u) return; var abs = _absoluteUrl(u); if (!abs || abs.length < 10 || abs.indexOf('data:') === 0) return; if (seen[abs]) return; seen[abs] = true; out.push(abs); }
    _push(getMeta('og:image')); _push(getMeta('og:image:secure_url')); _push(getMeta('twitter:image')); _push(getMeta('twitter:image:src'));
    try {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var si = 0; si < scripts.length; si++) {
        var d; try { d = JSON.parse(scripts[si].textContent); } catch (e) { continue; }
        var items = Array.isArray(d) ? d : [d];
        for (var j = 0; j < items.length; j++) {
          var it = items[j]; if (!it) continue;
          var nodes = it['@graph'] ? it['@graph'] : [it];
          for (var k = 0; k < nodes.length; k++) {
            var img = nodes[k] && nodes[k].image; if (!img) continue;
            if (typeof img === 'string') _push(img);
            else if (Array.isArray(img)) { for (var ai = 0; ai < img.length; ai++) _push(typeof img[ai] === 'string' ? img[ai] : (img[ai] && img[ai].url)); }
            else if (img.url) _push(img.url);
          }
        }
      }
    } catch (e) {}
    var imgs = document.querySelectorAll('img'), alt = [];
    for (var ii = 0; ii < imgs.length && alt.length < 12; ii++) {
      var im = imgs[ii], s = _extractImageSrc(im); if (!s) continue;
      var w = im.naturalWidth || im.offsetWidth || 0, h = im.naturalHeight || im.offsetHeight || 0;
      if (w && w < 200) continue; if (h && h < 200) continue;
      if (/logo|icon|sprite|placeholder|loading|spinner|avatar|chat|badge|trustpilot|payment|paypal|visa|mastercard|swatch/i.test(s)) continue;
      alt.push(s);
    }
    for (var aj = 0; aj < alt.length; aj++) _push(alt[aj]);
    return out;
  }
  function getPrice() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        var d = JSON.parse(scripts[i].textContent), items = Array.isArray(d) ? d : [d];
        for (var j = 0; j < items.length; j++) {
          var it = items[j]; if (!it) continue;
          var nodes = it['@graph'] ? it['@graph'] : [it];
          for (var k = 0; k < nodes.length; k++) {
            var offers = nodes[k] && nodes[k].offers; if (!offers) continue;
            var ol = Array.isArray(offers) ? offers : [offers];
            for (var m = 0; m < ol.length; m++) { var p = ol[m].price || ol[m].lowPrice; if (p && parseFloat(p) > 0) return parseFloat(p); }
          }
        }
      } catch (e) {}
    }
    var ms = ['meta[property="og:price:amount"]', 'meta[property="product:price:amount"]', 'meta[itemprop="price"]'];
    for (var mi = 0; mi < ms.length; mi++) { var mel = document.querySelector(ms[mi]); if (mel) { var mv = mel.getAttribute('content'); if (mv && parseFloat(mv) > 0) return parseFloat(mv); } }
    var sel = ['[data-price]', '[data-testid="price"]', '.product__price', '.pdp-price', '.price-current', '.current-price', '[class*="ProductPrice"]', '[itemprop="price"]', '.price', '#price', '.product-price'];
    for (var s = 0; s < sel.length; s++) {
      var el = document.querySelector(sel[s]); if (!el) continue;
      var txt = el.getAttribute('data-price') || el.getAttribute('content') || el.textContent; if (!txt) continue;
      var matches = txt.match(/\d{1,5}(?:,\d{3})*\.\d{2}/g);
      if (matches && matches.length) { var val = parseFloat(matches[matches.length - 1].replace(/,/g, '')); if (val > 0 && val < 100000) return val; }
    }
    return 0;
  }
  function getSource() {
    var s = getMeta('og:site_name');
    if (s) return s;
    try { var h = new URL(window.location.href).hostname.replace(/^(www|shop|store|us|en|m)\./, '').split('.'); var b = h[h.length - 2] || ''; return b ? b.charAt(0).toUpperCase() + b.slice(1) : ''; } catch (e) { return ''; }
  }

  function isFeedSite() { return /pinterest\.|instagram\.com/i.test(window.location.hostname); }

  // From a clicked element, find the nearest real image.
  function findImage(el) {
    if (!el) return null;
    if (el.tagName === 'IMG' && _extractImageSrc(el)) return el;
    var inner = el.querySelector && el.querySelector('img');
    if (inner && _extractImageSrc(inner)) return inner;
    var c = el;
    for (var i = 0; i < 6 && c; i++) {
      if (c.tagName === 'IMG' && _extractImageSrc(c)) return c;
      var found = c.querySelector && c.querySelector('img');
      if (found && _extractImageSrc(found)) {
        // pick the largest img in this container
        var imgs = c.querySelectorAll('img'), best = null, bestA = 0;
        for (var k = 0; k < imgs.length; k++) {
          var a = (imgs[k].naturalWidth || imgs[k].offsetWidth || 0) * (imgs[k].naturalHeight || imgs[k].offsetHeight || 0);
          if (a > bestA && _extractImageSrc(imgs[k])) { bestA = a; best = imgs[k]; }
        }
        return best || found;
      }
      c = c.parentElement;
    }
    return null;
  }
  // Best-effort: find the pin's outbound (off-platform) link near the clicked element.
  function findSourceLink(el) {
    var c = el;
    for (var i = 0; i < 9 && c && c.parentElement; i++) c = c.parentElement;
    if (!c) c = document;
    var as = c.querySelectorAll('a[href]');
    for (var j = 0; j < as.length; j++) {
      var h = as[j].getAttribute('href') || '';
      if (/^https?:\/\//.test(h) && h.indexOf('pinterest.') === -1 && h.indexOf('instagram.com') === -1 && h.indexOf('/pin/') === -1) return h;
    }
    return '';
  }

  function post(overlay, path, body, okMsg) {
    var status = overlay.querySelector('#iris-status');
    status.style.color = '#888'; status.textContent = 'Saving…';
    fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) { if (!r.ok) throw new Error(r.j.error || 'Error'); status.style.color = '#2F7A4F'; status.textContent = okMsg; setTimeout(function () { overlay.remove(); }, 1500); })
      .catch(function (e) { status.style.color = '#C0392B'; status.textContent = e.message; });
  }

  // allImages: array (1+), name/price prefilled, considerUrl: where Consider should look for price.
  function renderCard(allImages, name, price, source, considerUrl) {
    var existing = document.getElementById('iris-bm-overlay'); if (existing) existing.remove();
    var imageUrl = allImages.length ? allImages[0] : '';
    var hasMultiple = allImages.length > 1;
    var arrows = hasMultiple
      ? '<button id="iris-prev" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.5);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;">&lsaquo;</button>' +
        '<button id="iris-next" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.5);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;">&rsaquo;</button>'
      : '';
    var imgHtml = imageUrl
      ? '<div style="position:relative;margin-bottom:6px;"><img id="iris-img" src="' + imageUrl + '" style="width:100%;height:170px;object-fit:cover;border-radius:8px;border:1px solid #E4DCCF;background:#F7F3EC;display:block;">' + arrows + '</div>'
      : '<div style="height:170px;border:1px dashed #cbb;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;margin-bottom:6px;">No image — paste one below<img id="iris-img" style="display:none;"></div>';
    var html =
      '<div id="iris-bd" style="position:fixed;inset:0;background:rgba(40,36,32,.55);z-index:2147483646;"></div>' +
      '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#FBF8F2;border:1px solid #E4DCCF;border-radius:14px;padding:18px 20px;width:340px;max-width:92vw;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#2E2A26;box-shadow:0 18px 50px rgba(0,0,0,.4);">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;"><span style="font-family:Georgia,serif;font-size:17px;">Iris</span><button id="iris-close" style="margin-left:auto;background:none;border:none;color:#999;font-size:20px;cursor:pointer;">&times;</button></div>' +
        imgHtml +
        '<div style="text-align:right;margin-bottom:10px;"><a href="#" id="iris-paste-t" style="color:#B08D57;font-size:11px;text-decoration:none;">' + (imageUrl ? 'Wrong image? Paste URL' : 'Paste image URL') + '</a>' +
          '<div id="iris-paste-r" style="display:none;margin-top:6px;text-align:left;"><input id="iris-paste-i" placeholder="Right-click image, Copy image address, paste" style="width:100%;border:1px solid #B08D57;border-radius:6px;padding:7px 9px;font-size:12px;box-sizing:border-box;"></div></div>' +
        '<input id="iris-name" value="' + (name || '').replace(/"/g, '&quot;') + '" style="width:100%;border:1px solid #E4DCCF;border-radius:6px;padding:8px 10px;font-size:13px;box-sizing:border-box;margin-bottom:8px;" placeholder="Name">' +
        '<input id="iris-price" type="number" value="' + (price || '') + '" placeholder="Price" style="width:100%;border:1px solid #E4DCCF;border-radius:6px;padding:8px 10px;font-size:13px;box-sizing:border-box;margin-bottom:14px;">' +
        '<div style="display:flex;gap:10px;">' +
          '<button id="iris-love" style="flex:1;background:#fff;border:1px solid #B08D57;color:#B08D57;border-radius:8px;padding:10px;font-weight:600;font-size:14px;cursor:pointer;">&#9825; Love this</button>' +
          '<button id="iris-consider" style="flex:1;background:#2E2A26;border:none;color:#fff;border-radius:8px;padding:10px;font-weight:600;font-size:14px;cursor:pointer;">Consider this</button>' +
        '</div>' +
        '<div style="font-size:11px;color:#9A8;margin-top:8px;">Love saves the image to your taste board. Consider saves it to weigh later.</div>' +
        '<div id="iris-status" style="margin-top:8px;font-size:12px;text-align:center;min-height:16px;color:#888;"></div>' +
      '</div>';
    var overlay = document.createElement('div');
    overlay.id = 'iris-bm-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    overlay.querySelector('#iris-close').onclick = function () { overlay.remove(); };
    overlay.querySelector('#iris-bd').onclick = function () { overlay.remove(); };

    var idx = 0, imgEl = overlay.querySelector('#iris-img');
    if (hasMultiple) {
      var show = function (i) { idx = (i + allImages.length) % allImages.length; imageUrl = allImages[idx]; imgEl.src = imageUrl; imgEl.style.display = 'block'; };
      overlay.querySelector('#iris-prev').onclick = function (e) { e.preventDefault(); show(idx - 1); };
      overlay.querySelector('#iris-next').onclick = function (e) { e.preventDefault(); show(idx + 1); };
    }
    var pt = overlay.querySelector('#iris-paste-t'), pr = overlay.querySelector('#iris-paste-r'), pi = overlay.querySelector('#iris-paste-i');
    pt.onclick = function (e) { e.preventDefault(); var v = pr.style.display === 'block'; pr.style.display = v ? 'none' : 'block'; if (!v) setTimeout(function () { pi.focus(); }, 50); };
    var applyPaste = function () { var v = (pi.value || '').trim(); if (!/^https?:\/\/|^\/\//.test(v)) return; imageUrl = v.indexOf('//') === 0 ? window.location.protocol + v : v; if (imgEl) { imgEl.src = imageUrl; imgEl.style.display = 'block'; } pt.textContent = 'Image updated'; };
    pi.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyPaste(); } });
    pi.addEventListener('paste', function () { setTimeout(applyPaste, 50); });

    overlay.querySelector('#iris-love').onclick = function () {
      post(overlay, '/api/taste/capture', { imageUrl: imageUrl, url: window.location.href }, 'Loved — added to your taste board');
    };
    overlay.querySelector('#iris-consider').onclick = function () {
      post(overlay, '/api/considering/capture', {
        url: considerUrl || '',
        imageUrl: imageUrl,
        name: overlay.querySelector('#iris-name').value.trim(),
        price: parseFloat(overlay.querySelector('#iris-price').value) || 0,
        source: source
      }, 'Added to Considering');
    };
  }

  // ── Feed sites: let the user point at the exact pin/photo ──────────────────
  function pickMode() {
    var banner = document.createElement('div');
    banner.id = 'iris-pick-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#2E2A26;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;padding:12px 16px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.4);';
    banner.innerHTML = 'Click the image you want · <span style="opacity:.7;">Esc to cancel</span>';
    document.body.appendChild(banner);

    function cleanup() {
      banner.remove();
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    }
    function onKey(e) { if (e.key === 'Escape') cleanup(); }
    function onClick(e) {
      var img = findImage(e.target);
      if (!img) return; // not an image — let it be, keep waiting
      e.preventDefault(); e.stopPropagation();
      var src = upgradePin(_extractImageSrc(img));
      var sourceUrl = findSourceLink(e.target);
      cleanup();
      renderCard([src], getMeta('og:title') || '', 0, getSource() || (/pinterest/i.test(location.hostname) ? 'Pinterest' : 'Instagram'), sourceUrl);
    }
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
  }

  // ── Entry ──────────────────────────────────────────────────────────────────
  if (isFeedSite()) {
    pickMode();
  } else {
    var allImages = getAllImages();
    var name = (getMeta('og:title') || document.title || '').replace(/\s*[|\-\u2013\u2014]\s*.+$/, '').trim();
    renderCard(allImages, name, getPrice(), getSource(), window.location.href);
  }
})();
