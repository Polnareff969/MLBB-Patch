let localDataStore = [];
let targetServer = 'All';

const searchInput = document.getElementById('searchInput');
const statusIndicator = document.getElementById('statusIndicator');
const timelineOutput = document.getElementById('timelineOutput');

async function launchSystem() {
    const storedCache = localStorage.getItem('cache_mlbb_data');
    const storedTime = localStorage.getItem('cache_mlbb_time');
    const systemTime = Date.now();

    // Instant local memory render layer
    if (storedCache && storedTime && (systemTime - parseInt(storedTime) < 30 * 60 * 1000)) {
        localDataStore = JSON.parse(storedCache);
        statusIndicator.classList.add('hidden');
        timelineOutput.classList.remove('hidden');
        processUIOutput();
    }

    // Secondary deep verification sync
    try {
        const stream = await fetch('/api/patches');
        const packet = await stream.json();
        
        if (packet && !packet.error) {
            localDataStore = packet;
            localStorage.setItem('cache_mlbb_data', JSON.stringify(packet));
            localStorage.setItem('cache_mlbb_time', systemTime.toString());
            
            statusIndicator.classList.add('hidden');
            timelineOutput.classList.remove('hidden');
            processUIOutput();
        }
    } catch (err) {
        if (!localDataStore.length) {
            statusIndicator.textContent = 'Connection pipeline timed out. Refreshing required.';
        }
    }
}

function updateServerFilter(selection) {
    targetServer = selection;
    ['btnAll', 'btnOrg', 'btnAdv'].forEach(id => {
        document.getElementById(id).className = "px-3 py-1.5 text-[11px] font-medium rounded-md transition-all text-slate-500 hover:text-slate-300";
    });
    
    if (selection === 'All') document.getElementById('btnAll').className = "px-3 py-1.5 text-[11px] font-medium rounded-md transition-all bg-white/[0.08] text-white";
    if (selection === 'Original Server') document.getElementById('btnOrg').className = "px-3 py-1.5 text-[11px] font-medium rounded-md transition-all bg-white/[0.08] text-white";
    if (selection === 'Advanced Server') document.getElementById('btnAdv').className = "px-3 py-1.5 text-[11px] font-medium rounded-md transition-all bg-white/[0.08] text-white";
    
    processUIOutput();
}

function processUIOutput() {
    const rawMatchTerm = searchInput.value.toLowerCase().trim();
    timelineOutput.innerHTML = '';

    const executionFilter = localDataStore.filter(item => {
        const queryPass = item.hero.toLowerCase().includes(rawMatchTerm);
        const serverPass = targetServer === 'All' || item.server === targetServer;
        return queryPass && serverPass;
    }).sort((alpha, beta) => beta.timestamp - alpha.timestamp);

    if (executionFilter.length === 0) {
        timelineOutput.innerHTML = `<div class="text-center py-16 text-xs text-slate-600 font-light tracking-wide">No chronological data matching entries.</div>`;
        return;
    }

    executionFilter.forEach(item => {
        const UIElement = document.createElement('div');
        UIElement.className = "bg-white/[0.02] backdrop-blur-md border border-white/[0.05] rounded-xl p-4 flex gap-4 items-start shadow-sm transition-all duration-300 hover:border-white/[0.1]";
        
        let visualLabelStyle = "bg-slate-800 text-slate-400";
        if (item.type === 'Buff') visualLabelStyle = "bg-emerald-950/40 text-emerald-400 border border-emerald-500/10";
        if (item.type === 'Nerf') visualLabelStyle = "bg-rose-950/40 text-rose-400 border border-rose-500/10";
        if (item.type === 'Adjustment') visualLabelStyle = "bg-amber-950/40 text-amber-400 border border-amber-500/10";

        const shortName = item.hero.substring(0, 2).toUpperCase();
        const iconLayout = item.icon 
            ? `<img src="${item.icon}" alt="" class="w-10 h-10 rounded-full border border-white/10 object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
            : '';
        const placeholderContainer = `<div class="w-10 h-10 rounded-full border border-white/[0.08] bg-slate-900/60 flex items-center justify-center text-[10px] font-medium text-slate-500" style="${item.icon ? 'display:none;' : 'display:flex;'}">${shortName}</div>`;

        UIElement.innerHTML = `
            <div class="relative flex-shrink-0">${iconLayout}${placeholderContainer}</div>
            <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1.5">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-medium text-white tracking-wide">${item.hero}</span>
                        <span class="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold tracking-wider uppercase ${visualLabelStyle}">${item.type}</span>
                    </div>
                    <span class="text-[10px] font-mono text-slate-500 bg-black/40 px-2 py-0.5 border border-white/[0.02] rounded">${item.version} • ${item.server === 'Advanced Server' ? 'ADV' : 'ORG'}</span>
                </div>
                <p class="text-xs text-slate-400 leading-relaxed font-light whitespace-pre-line">${item.details}</p>
                <div class="mt-2.5 pt-2 border-t border-white/[0.02] flex items-center justify-between text-[10px] text-slate-600 font-mono">
                    <span>${new Date(item.timestamp).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</span>
                    <a href="${item.redditLink}" target="_blank" rel="noopener noreferrer" class="hover:text-slate-400 transition-colors">Thread ↗</a>
                </div>
            </div>
        `;
        timelineOutput.appendChild(UIElement);
    });
}

searchInput.addEventListener('input', processUIOutput);
window.addEventListener('DOMContentLoaded', launchSystem);
