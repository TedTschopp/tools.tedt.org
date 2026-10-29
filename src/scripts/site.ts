const root = document.documentElement;
const media = matchMedia('(prefers-color-scheme: dark)');
let preference = root.dataset.themePreference || 'system';
function applyTheme(value: string) {
  preference = ['light','dark','system'].includes(value) ? value : 'system';
  const theme = preference === 'system' ? media.matches ? 'dark' : 'light' : preference;
  root.dataset.theme = theme; root.dataset.bsTheme = theme; root.dataset.themePreference = preference;
  document.querySelectorAll<HTMLElement>('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice === preference)));
}
applyTheme(preference);
document.querySelectorAll<HTMLElement>('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>{applyTheme(button.dataset.themeChoice || 'system');try{localStorage.setItem('tools-theme',preference);}catch{}}));
media.addEventListener('change',()=>applyTheme(preference));
const form = document.querySelector<HTMLFormElement>('[data-filters]');
if(form){
  const search = document.querySelector<HTMLInputElement>('#search')!;
  const category = document.querySelector<HTMLSelectElement>('#category')!;
  const status = document.querySelector<HTMLSelectElement>('#status')!;
  const tag = document.querySelector<HTMLSelectElement>('#tag')!;
  const sort = document.querySelector<HTMLSelectElement>('#sort')!;
  const grid = document.querySelector<HTMLElement>('[data-tool-grid]')!;
  const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-tool-card]'));
  const initial = new URLSearchParams(location.search);
  search.value = initial.get('q') || ''; category.value = initial.get('category') || ''; status.value = initial.get('status') || ''; tag.value = initial.get('tag') || ''; sort.value = initial.get('sort') || 'featured';
  function filter(){
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count=0;
    const ordered = [...cards].sort((a,b)=>sort.value==='title' ? a.dataset.title!.localeCompare(b.dataset.title!) : sort.value==='recent' ? b.dataset.updated!.localeCompare(a.dataset.updated!) || a.dataset.title!.localeCompare(b.dataset.title!) : Number(a.dataset.index)-Number(b.dataset.index));
    ordered.forEach(card=>{const show=terms.every(t=>card.dataset.search!.includes(t)) && (!category.value || card.dataset.category===category.value) && (!status.value || card.dataset.status===status.value) && (!tag.value || JSON.parse(card.dataset.tags!).includes(tag.value));card.hidden=!show;if(show)count++;grid.append(card);});
    document.querySelector('[data-count]')!.textContent=`(${count})`;
    document.querySelector('[data-results-live]')!.textContent=`${count} tools shown.`;
    (document.querySelector('[data-empty]') as HTMLElement).hidden=count!==0;
    const params=new URLSearchParams();if(search.value)params.set('q',search.value);if(category.value)params.set('category',category.value);if(status.value)params.set('status',status.value);if(tag.value)params.set('tag',tag.value);if(sort.value!=='featured')params.set('sort',sort.value);
    history.replaceState(null,'',location.pathname+(params.size?'?'+params:''));
  }
  form.addEventListener('submit',e=>e.preventDefault());form.addEventListener('input',filter);form.addEventListener('change',filter);sort.addEventListener('change',filter);
  form.addEventListener('reset',()=>{sort.value='featured';setTimeout(filter,0);});
  document.querySelector('[data-clear]')!.addEventListener('click',()=>{search.value='';search.focus();filter();});
  filter();
}
