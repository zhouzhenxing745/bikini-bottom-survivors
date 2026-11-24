const ARMORY_ESCAPES={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const armoryText=value=>String(value??'').replace(/[&<>"']/g,char=>ARMORY_ESCAPES[char]);
const armoryNumber=new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2});
const armoryAmount=value=>Number.isFinite(value)?armoryNumber.format(value):armoryText(value);

function renderArmorySlot(slot) {
  const {index,label,kind,weapon,upgradePrice,canUpgrade,sellPrice}=slot;
  const key=armoryText(index);
  const name=armoryText(label);
  const category=armoryText(kind);
  if(!weapon){
    return `<article class="armory-slot armory-slot-empty">
      <div class="armory-slot-bar"><b>${name}</b><span>${category}</span></div>
      <div class="armory-empty-message"><span aria-hidden="true">+</span>空武器槽</div>
    </article>`;
  }
  const weaponName=armoryText(weapon.name);
  const rank=Number(weapon.tier);
  const tier=Number.isInteger(rank)&&rank>=1?`${rank} 阶`:armoryText(weapon.tier);
  const tierColor=Number.isInteger(rank)?Math.min(4,Math.max(1,rank)):1;
  const hasUpgrade=upgradePrice!=null;
  const canSell=sellPrice!=null;
  return `<article class="armory-slot" data-tier="${tierColor}">
    <div class="armory-slot-bar"><b>${name}</b><span>${category}</span></div>
    <div class="armory-equipped">
      <span class="armory-glyph" aria-hidden="true">${armoryText(weapon.glyph)}</span>
      <div><strong>${weaponName}</strong><small class="armory-tier">${tier}</small></div>
    </div>
    <dl class="armory-stats">
      <div><dt>伤害</dt><dd>${armoryAmount(weapon.damage)}</dd></div>
      <div><dt>攻速/秒</dt><dd>${armoryAmount(weapon.speed)}</dd></div>
      <div><dt>射程</dt><dd>${armoryAmount(weapon.range)}</dd></div>
    </dl>
    <div class="armory-actions">
      <button type="button" class="armory-action armory-buy" data-slot-upgrade="${key}"
        aria-label="${hasUpgrade?`升阶 ${weaponName} · ${armoryAmount(upgradePrice)} 补给点`:`${weaponName} 已达最高阶`}" ${hasUpgrade&&canUpgrade?'':'disabled'}>
        <span>${hasUpgrade?(canUpgrade?'升阶':'点数不足'):'已满阶'}</span>${hasUpgrade?`<small>${armoryAmount(upgradePrice)} 点</small>`:''}
      </button>
      <button type="button" class="armory-action" data-slot-sell="${key}"
        aria-label="出售 ${weaponName}${canSell?` · 获得 ${armoryAmount(sellPrice)} 补给点`:''}" ${canSell?'':'disabled'}>
        <span>出售</span>${canSell?`<small>+${armoryAmount(sellPrice)} 点</small>`:''}
      </button>
    </div>
  </article>`;
}

function renderArmoryOffer(offer,points) {
  const {index,type,glyph,name,detail,kind,price,locked,sold,canBuy,buyLabel}=offer;
  const key=armoryText(index);
  const title=armoryText(name);
  const typeName=type==='weapon'?'武器':'道具';
  const unavailable=price>points?'点数不足':'暂不可买';
  const action=armoryText(sold?'已售出':buyLabel||(canBuy?'购买':unavailable));
  return `<article class="armory-offer${locked&&!sold?' armory-offer-locked':''}${sold?' armory-offer-sold':''}" data-offer-type="${type==='weapon'?'weapon':'item'}">
    <div class="armory-offer-top">
      <span class="armory-glyph" aria-hidden="true">${armoryText(glyph)}</span>
      <div><strong>${title}</strong><small>${typeName}${kind?` · ${armoryText(kind)}`:''}</small></div>
    </div>
    <p class="armory-description">${armoryText(detail)}</p>
    <div class="armory-actions">
      <button type="button" class="armory-action armory-buy" data-offer-buy="${key}"
        aria-label="${action} ${title}${sold?'':` · ${armoryAmount(price)} 补给点`}" ${!sold&&canBuy?'':'disabled'}>
        <span>${action}</span>${sold?'':`<small>${armoryAmount(price)} 点</small>`}
      </button>
      <button type="button" class="armory-action armory-lock" data-offer-lock="${key}"
        aria-pressed="${String(Boolean(locked&&!sold))}" aria-label="锁定 ${title}以保留到下一波" ${sold?'disabled':''}>
        ${locked&&!sold?'已锁定':'锁定'}
      </button>
    </div>
  </article>`;
}

function renderArmory(model) {
  return `<div class="armory">
    <section class="armory-section" aria-labelledby="armory-equipment-title">
      <div class="armory-heading"><h3 id="armory-equipment-title">出战武器</h3></div>
      <div class="armory-grid">${model.slots.map(renderArmorySlot).join('')}</div>
      ${model.inventory?`<p class="armory-inventory"><strong>已购道具</strong> ${armoryText(model.inventory)}</p>`:''}
    </section>
    <section class="armory-section" aria-labelledby="armory-shop-title">
      <div class="armory-heading">
        <h3 id="armory-shop-title">补给商店</h3>
        <strong class="armory-balance"><span>补给点</span> ${armoryAmount(model.points)}</strong>
      </div>
      <div class="armory-toolbar">
        <p>锁定的补给不会刷新，并保留到下一波。</p>
        <button type="button" class="armory-action armory-reroll" data-shop-reroll ${model.reroll.enabled?'':'disabled'}>
          刷新补给 <small>${armoryAmount(model.reroll.price)} 点</small>
        </button>
      </div>
      <div class="armory-grid">${model.offers.map(offer=>renderArmoryOffer(offer,model.points)).join('')}</div>
    </section>
  </div>`;
}
