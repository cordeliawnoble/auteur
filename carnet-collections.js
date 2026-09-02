/* ----------------------------------------------------------------------
   Bibliothèque de fonctions partagée par bibliotheque.html et ludotheque.html
   - Parseur CSV robuste (gère guillemets, virgules internes, accents)
   - Rendu des cartes (couverture avec repli propre, étoiles accessibles)
   ---------------------------------------------------------------------- */

function escapeHtml(str){
  return (str||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/**
 * Parseur CSV "vanilla" conforme RFC 4180 : gère les champs entre guillemets
 * (avec virgules ou guillemets échappés "" à l'intérieur), sans dépendance externe.
 */
function parseCSV(text){
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for(let i = 0; i < text.length; i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; }
        else{ inQuotes = false; }
      }else{
        field += c;
      }
    }else{
      if(c === '"'){ inQuotes = true; }
      else if(c === ','){ row.push(field); field = ''; }
      else if(c === '\r'){ /* ignoré, \n gère le saut de ligne */ }
      else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
      else{ field += c; }
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows;
}

/** Transforme un CSV (texte brut) en tableau d'objets, à partir de la ligne d'en-têtes. */
function csvToObjects(text){
  const rows = parseCSV((text||'').trim());
  if(!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(c => (c||'').trim() !== ''))
    .map(r => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (r[idx] || '').trim(); });
      return obj;
    });
}

/** Charge et parse un fichier CSV distant. Retourne [] en cas d'échec (fichier absent, etc.). */
async function loadCSV(url){
  try{
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) return [];
    const text = await res.text();
    return csvToObjects(text);
  }catch(e){
    console.error('Échec du chargement de ' + url, e);
    return [];
  }
}

/** Étoiles pleines/vides, avec un libellé compréhensible par les lecteurs d'écran. */
function starsBlock(noteStr){
  const note = parseInt(noteStr, 10);
  if(!noteStr || isNaN(note) || note < 1) return '';
  const clamped = Math.min(5, Math.max(0, note));
  const stars = '★★★★★☆☆☆☆☆'.slice(5-clamped, 10-clamped);
  return `<div class="coll-stars" role="img" aria-label="Note : ${clamped} sur 5">${stars}</div>`;
}

/** Une carte de livre : couverture (avec repli propre si l'image manque ou casse), titre, auteur, note, et une petite carte au survol/tap. */
function bookCardHtml(item){
  const title = item.titre || 'Sans titre';
  const cover = item.image_url
    ? `<img src="${escapeHtml(item.image_url)}" alt="Couverture de ${escapeHtml(title)}" loading="lazy" class="coll-cover" onerror="this.onerror=null;this.replaceWith(collPlaceholder('${escapeHtml(title).replace(/'/g,"\\'")}'));">`
    : collPlaceholderHtml(title);
  return `
    <div class="coll-card">
      <div class="coll-cover-wrap">
        ${cover}
        ${collInfoOverlayHtml(title, item.auteur, item.note, item.ressenti)}
      </div>
      <div class="coll-title">${escapeHtml(title)}</div>
      ${item.auteur ? `<div class="coll-sub">${escapeHtml(item.auteur)}</div>` : ''}
      ${starsBlock(item.note)}
    </div>
  `;
}

/** Une carte de jeu : jaquette, titre, plateforme (facultative), note, et une petite carte au survol/tap. */
function gameCardHtml(item){
  const title = item.titre || 'Sans titre';
  const cover = item.image_url
    ? `<img src="${escapeHtml(item.image_url)}" alt="Jaquette de ${escapeHtml(title)}" loading="lazy" class="coll-cover" onerror="this.onerror=null;this.replaceWith(collPlaceholder('${escapeHtml(title).replace(/'/g,"\\'")}'));">`
    : collPlaceholderHtml(title);
  return `
    <div class="coll-card">
      <div class="coll-cover-wrap">
        ${cover}
        ${collInfoOverlayHtml(title, item.plateforme, item.note, item.ressenti)}
      </div>
      <div class="coll-title">${escapeHtml(title)}</div>
      ${item.plateforme ? `<div class="coll-sub">${escapeHtml(item.plateforme)}</div>` : ''}
      ${starsBlock(item.note)}
    </div>
  `;
}

/**
 * La petite carte qui apparaît au survol (ordinateur) ou au tap (mobile/tablette) sur une couverture.
 * Reste contenue dans le cadre de la couverture (jamais de débordement sur les couvertures voisines).
 * N'affiche que ce qui existe réellement — aucune zone vide si `ressenti` (ou le sous-titre) est absent.
 */
function collInfoOverlayHtml(title, subtitle, noteStr, ressenti){
  const stars = starsBlock(noteStr);
  return `
    <div class="coll-info-overlay">
      <div class="coll-info-title">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="coll-info-sub">${escapeHtml(subtitle)}</div>` : ''}
      ${stars ? `<div class="coll-info-stars">${stars}</div>` : ''}
      ${ressenti ? `<div class="coll-info-ressenti">« ${escapeHtml(ressenti)} »</div>` : ''}
    </div>
  `;
}

/** Repli en HTML (chaîne) — pas de couverture renseignée dans le CSV. */
function collPlaceholderHtml(title){
  return `<div class="coll-cover coll-cover-placeholder" role="img" aria-label="Pas de couverture pour ${escapeHtml(title)}">${escapeHtml(title)}</div>`;
}
/** Repli en noeud DOM — utilisé quand l'image casse au chargement (onerror). */
function collPlaceholder(title){
  const div = document.createElement('div');
  div.className = 'coll-cover coll-cover-placeholder';
  div.setAttribute('role','img');
  div.setAttribute('aria-label', 'Pas de couverture pour ' + title);
  div.textContent = title;
  return div;
}

/**
 * Sur ordinateur/souris, la petite carte apparaît au survol (géré en pur CSS, voir .coll-card:hover).
 * Sur tactile (pas de vrai survol), un tap l'ouvre, un tap ailleurs la referme, une seule ouverte à la fois.
 * Délégation d'événement sur le document : fonctionne même si la grille est (re)générée dynamiquement.
 */
(function(){
  const isTouch = window.matchMedia && window.matchMedia('(hover: none)').matches;
  if(!isTouch) return;
  document.addEventListener('click', function(e){
    const card = e.target.closest('.coll-card');
    document.querySelectorAll('.coll-card.open').forEach(c=>{ if(c!==card) c.classList.remove('open'); });
    if(card) card.classList.toggle('open');
  });
})();
