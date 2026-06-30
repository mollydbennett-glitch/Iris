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
    var h1 = document.querySelector('h1');
    if (h1) {
      var c = h1.parentElement;
      for (var depth = 0; depth < 4 && c && c.parentElement; depth++) c = c.parentElement;
      if (c) {
        var bt = (c.innerText || c.textContent || '').slice(0, 3000)
          .replace(/\d+\s*(?:payments?|installments?)\s*of\s*\$?\d[\d,.]*/gi, '')
          .replace(/(?:as low as|or)\s*\$?\d[\d,.]*\s*\/?\s*(?:mo|month|wk|week|payment)/gi, '')
          .replace(/(?:klarna|afterpay|affirm|sezzle|shop\s*pay)\s*[^.\n]{0,40}\$\d[\d,.]*/gi, '')
          .replace(/(?:free\s*shipping|shipping)\s*(?:on\s*)?(?:over|orders?\s*over)\s*\$?\d[\d,.]*/gi, '');
        var pm = bt.match(/\$\s?\d{1,5}(?:,\d{3})*\.\d{2}/g);
        if (pm && pm.length) {
          var cand = pm.map(function (p) { return parseFloat(p.replace(/[^\d.]/g, '')); }).filter(function (v) { return v >= 1 && v < 50000; });
          if (cand.length) { cand.sort(function (a, b) { return a - b; }); return cand.length >= 3 ? cand[Math.floor(cand.length / 2)] : cand[0]; }
        }
      }
    }
    return 0;
  }
  function getSource() {
    var s = getMeta('og:site_name');
    if (s) return s;
    try { var h = new URL(window.location.href).hostname.replace(/^(www|shop|store|us|en|m)\./, '').split('.'); var b = h[h.length - 2] || ''; return b ? b.charAt(0).toUpperCase() + b.slice(1) : ''; } catch (e) { return ''; }
  }

  var url = window.location.href;
  var allImages = getAllImages();
  var imageUrl = allImages.length ? allImages[0] : '';
  var name = (getMeta('og:title') || document.title || '').replace(/\s*[|\-\u2013\u2014]\s*.+$/, '').trim();
  var price = getPrice();
  var source = getSource();

  var existing = document.getElementById('iris-bm-overlay'); if (existing) existing.remove();

  var hasMultiple = allImages.length > 1;
  var arrows = hasMultiple
    ? '<button id="iris-prev" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.5);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;">&lsaquo;</button>' +
      '<button id="iris-next" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.5);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer;">&rsaquo;</button>'
    : '';
  var imgHtml = imageUrl
    ? '<div style="position:relative;margin-bottom:6px;"><img id="iris-img" src="' + imageUrl + '" style="width:100%;height:170px;object-fit:cover;border-radius:8px;border:1px solid #E4DCCF;background:#F7F3EC;display:block;">' + arrows + '</div>'
    : '<div style="height:170px;border:1px dashed #cbb;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;margin-bottom:6px;">No image found — paste one below<img id="iris-img" style="display:none;"></div>';

  var html =
    '<div id="iris-bd" style="position:fixed;inset:0;background:rgba(40,36,32,.55);z-index:2147483646;"></div>' +
    '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#FBF8F2;border:1px solid #E4DCCF;border-radius:14px;padding:18px 20px;width:340px;max-width:92vw;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#2E2A26;box-shadow:0 18px 50px rgba(0,0,0,.4);">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">' +
        '<span style="font-family:Georgia,serif;font-size:17px;">Iris</span>' +
        '<button id="iris-close" style="margin-left:auto;background:none;border:none;color:#999;font-size:20px;cursor:pointer;">&times;</button>' +
      '</div>' +
      imgHtml +
      '<div style="text-align:right;margin-bottom:10px;"><a href="#" id="iris-paste-t" style="color:#B08D57;font-size:11px;text-decoration:none;">' + (imageUrl ? 'Wrong image? Paste URL' : 'Paste image URL') + '</a>' +
        '<div id="iris-paste-r" style="display:none;margin-top:6px;text-align:left;"><input id="iris-paste-i" placeholder="Right-click image, Copy image address, paste" style="width:100%;border:1px solid #B08D57;border-radius:6px;padding:7px 9px;font-size:12px;box-sizing:border-box;"></div>' +
      '</div>' +
      '<input id="iris-name" value="' + name.replace(/"/g, '&quot;') + '" style="width:100%;border:1px solid #E4DCCF;border-radius:6px;padding:8px 10px;font-size:13px;box-sizing:border-box;margin-bottom:8px;" placeholder="Name">' +
      '<input id="iris-price" type="number" value="' + (price || '') + '" placeholder="Price" style="width:100%;border:1px solid #E4DCCF;border-radius:6px;padding:8px 10px;font-size:13px;box-sizing:border-box;margin-bottom:14px;">' +
      '<div style="display:flex;gap:10px;">' +
        '<button id="iris-love" style="flex:1;background:#fff;border:1px solid #B08D57;color:#B08D57;border-radius:8px;padding:10px;font-weight:600;font-size:14px;cursor:pointer;">&#9825; Love this</button>' +
        '<button id="iris-consider" style="flex:1;background:#2E2A26;border:none;color:#fff;border-radius:8px;padding:10px;font-weight:600;font-size:14px;cursor:pointer;">Consider this</button>' +
      '</div>' +
      '<div style="font-size:11px;color:#9A8;margin-top:8px;">Love saves the image to your taste board. Consider saves the link, image and price to weigh later.</div>' +
      '<div id="iris-status" style="margin-top:8px;font-size:12px;text-align:center;min-height:16px;color:#888;"></div>' +
    '</div>';

  var overlay = document.createElement('div');
  overlay.id = 'iris-bm-overlay';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  document.getElementById('iris-close').onclick = function () { overlay.remove(); };
  document.getElementById('iris-bd').onclick = function () { overlay.remove(); };

  var idx = 0, imgEl = document.getElementById('iris-img');
  if (hasMultiple) {
    function show(i) { idx = (i + allImages.length) % allImages.length; imageUrl = allImages[idx]; imgEl.src = imageUrl; imgEl.style.display = 'block'; }
    document.getElementById('iris-prev').onclick = function (e) { e.preventDefault(); show(idx - 1); };
    document.getElementById('iris-next').onclick = function (e) { e.preventDefault(); show(idx + 1); };
  }
  var pt = document.getElementById('iris-paste-t'), pr = document.getElementById('iris-paste-r'), pi = document.getElementById('iris-paste-i');
  pt.onclick = function (e) { e.preventDefault(); var v = pr.style.display === 'block'; pr.style.display = v ? 'none' : 'block'; if (!v) setTimeout(function () { pi.focus(); }, 50); };
  function applyPaste() { var v = (pi.value || '').trim(); if (!/^https?:\/\/|^\/\//.test(v)) return; imageUrl = v.indexOf('//') === 0 ? window.location.protocol + v : v; if (imgEl) { imgEl.src = imageUrl; imgEl.style.display = 'block'; } pt.textContent = 'Image updated'; }
  pi.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyPaste(); } });
  pi.addEventListener('paste', function () { setTimeout(applyPaste, 50); });

  function post(path, body, okMsg) {
    var status = document.getElementById('iris-status');
    status.style.color = '#888'; status.textContent = 'Saving…';
    fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (r) { if (!r.ok) throw new Error(r.j.error || 'Error'); status.style.color = '#2F7A4F'; status.textContent = okMsg; setTimeout(function () { overlay.remove(); }, 1500); })
      .catch(function (e) { status.style.color = '#C0392B'; status.textContent = e.message; });
  }
  document.getElementById('iris-love').onclick = function () {
    post('/api/taste/capture', { imageUrl: imageUrl, url: url }, 'Loved — added to your taste board');
  };
  document.getElementById('iris-consider').onclick = function () {
    post('/api/considering/capture', {
      url: url, imageUrl: imageUrl,
      name: document.getElementById('iris-name').value.trim(),
      price: parseFloat(document.getElementById('iris-price').value) || 0,
      source: source
    }, 'Added to Considering');
  };
})();
