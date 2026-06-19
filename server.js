const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

let memoryCache = null;
let lastCacheUpdate = 0;
const CACHE_EXPIRY = 15 * 60 * 1000; // 15-minute backend lifetime

app.use(express.static(path.join(__dirname, 'public')));

// MediaWiki Action API execution to parse the template dynamically
async function fetchWikiIcon(heroName) {
    try {
        const wikiEndpoint = `https://mobile-legends.fandom.com/api.php?action=parse&text=${encodeURIComponent(`{{hi|name=${heroName}}}`)}&format=json&origin=*`;
        const response = await fetch(wikiEndpoint, { headers: { 'User-Agent': 'MLBB-IconScraperProxy/1.0' } });
        const data = await response.json();
        const htmlPayload = data?.parse?.text?.['*'] || '';
        
        // Extract absolute image source asset from generated template code
        const sourceUrlMatch = htmlPayload.match(/src="([^"]+)"/);
        if (sourceUrlMatch && sourceUrlMatch[1]) {
            return sourceUrlMatch[1].split('/revision')[0]; // Clean out cache buster arguments
        }
    } catch (err) {
        console.error(`Error processing Fandom CDN matching for: ${heroName}`, err);
    }
    return null;
}

// Data parser logic engine
async function compilePatchData() {
    const targetRedditUrl = 'https://www.reddit.com/user/Tigreal/submitted.json?limit=50';
    const response = await fetch(targetRedditUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 Android-App-Scraper-Wrapper/1.0' }
    });
    const content = await response.json();
    const timelineItems = content?.data?.children || [];
    
    const structuredOutput = [];
    const nonHeroKeywords = ['skill', 'passive', 'ultimate', 'attribute', 'mechanics', 'update', 'rarity', 'description', 'entering', 'leaving', 'battlefield', 'system'];

    for (const post of timelineItems) {
        const title = post.data.title || '';
        if (!title.toLowerCase().includes('patch notes')) continue;

        const isAdvancedServer = title.toLowerCase().includes('adv. server');
        const serverType = isAdvancedServer ? 'Advanced Server' : 'Original Server';
        
        const formatVersion = title.match(/Patch Notes\s+([\d\.]+)/i);
        const patchVersion = formatVersion ? formatVersion[1] : 'Direct Sync';
        const postTimestamp = post.data.created_utc * 1000;
        const permanentLink = `https://www.reddit.com${post.data.permalink}`;
        
        const markdownLines = (post.data.selftext || '').split('\n');
        let activeHeroTracking = null;

        for (const line of markdownLines) {
            // Evaluates format syntax match: [Item Name] (Symbol)
            const structuralMatch = line.match(/\[([^\]]+)\]\s*\(([^)]+)\)/);
            if (structuralMatch) {
                const elementLabel = structuralMatch[1].trim();
                const symbolIdentifier = structuralMatch[2].trim();

                const isUtilityLine = nonHeroKeywords.some(key => elementLabel.toLowerCase().includes(key));
                
                if (!isUtilityLine && elementLabel.length > 1) {
                    activeHeroTracking = elementLabel;
                    
                    let balanceCategory = 'Adjustment';
                    if (symbolIdentifier.includes('↑')) balanceCategory = 'Buff';
                    if (symbolIdentifier.includes('↓')) balanceCategory = 'Nerf';
                    if (symbolIdentifier.includes('>>')) balanceCategory = 'Changes';

                    const lineDetails = line.replace(structuralMatch[0], '').replace(/^[ㅤ\s•\-]+/, '').trim();

                    structuredOutput.push({
                        hero: activeHeroTracking,
                        version: patchVersion,
                        server: serverType,
                        type: balanceCategory,
                        symbol: symbolIdentifier,
                        details: lineDetails || 'Sub-adjustments itemized below.',
                        timestamp: postTimestamp,
                        redditLink: permanentLink
                    });
                } else if (activeHeroTracking && isUtilityLine) {
                    // Chain properties down if parsing a subsequent attribute block of the active hero
                    const tailIndex = structuredOutput.length - 1;
                    if (tailIndex >= 0 && structuredOutput[tailIndex].hero === activeHeroTracking) {
                        structuredOutput[tailIndex].details += `\n• ${elementLabel} (${symbolIdentifier}): ${line.replace(structuralMatch[0], '').replace(/^[ㅤ\s•\-]+/, '').trim()}`;
                    }
                }
            }
        }
    }

    // Isolate unique entities to reduce payload pipeline calls
    const masterHeroList = [...new Set(structuredOutput.map(entry => entry.hero))];
    const imageLookups = {};
    
    await Promise.all(masterHeroList.map(async (name) => {
        const link = await fetchWikiIcon(name);
        if (link) imageLookups[name] = link;
    }));

    return structuredOutput.map(item => ({
        ...item,
        icon: imageLookups[item.hero] || null
    }));
}

app.get('/api/patches', async (req, res) => {
    const timestampDelta = Date.now();
    if (memoryCache && (timestampDelta - lastCacheUpdate < CACHE_EXPIRY)) {
        return res.json(memoryCache);
    }
    try {
        const updatedDataPayload = await compilePatchData();
        memoryCache = updatedDataPayload;
        lastCacheUpdate = timestampDelta;
        res.json(memoryCache);
    } catch (failure) {
        if (memoryCache) return res.json(memoryCache);
        res.status(500).json({ error: 'Data parsing thread error initiated.' });
    }
});

app.listen(PORT, () => console.log(`Server launched flawlessly on target port: ${PORT}`));
