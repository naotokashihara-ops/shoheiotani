/**
 * 大谷翔平 成績データ取得スクリプト
 * MLB Stats API (公式) からデータを取得して data.json に保存
 *
 * 使い方: node scripts/fetch-stats.js
 * 必要: Node.js 18+ (fetch 組み込み済み)
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'data.json');

const MLB_PLAYER_ID = 660271; // 大谷翔平
const BASE_URL = 'https://statsapi.mlb.com/api/v1';
const SPORT_ID = 1; // MLB

// チーム名 英語 → 日本語
const TEAM_NAME_JA = {
  'Los Angeles Angels': 'エンゼルス',
  'Los Angeles Dodgers': 'ドジャース',
};
const toJa = (name) => TEAM_NAME_JA[name] ?? name;

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'OhtaniStatsTracker/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// 投球回 "6.1" → 小数 6.333... に変換
function parseIP(ip) {
  const [whole, frac = '0'] = String(ip).split('.');
  return parseInt(whole) + parseInt(frac) / 3;
}

async function main() {
  console.log(`[${new Date().toISOString()}] 成績データ取得開始...`);
  const year = new Date().getFullYear();

  const [hitSeason, pitchSeason, hitCareer, pitchCareer, hitGameLog, pitGameLog] = await Promise.all([
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=season&season=${year}&group=hitting&sportId=${SPORT_ID}`),
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=season&season=${year}&group=pitching&sportId=${SPORT_ID}`),
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=yearByYear&group=hitting&sportId=${SPORT_ID}`),
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=yearByYear&group=pitching&sportId=${SPORT_ID}`),
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=gameLog&season=${year}&group=hitting&sportId=${SPORT_ID}`),
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=gameLog&season=${year}&group=pitching&sportId=${SPORT_ID}`),
  ]);

  // 今シーズン
  const bat = hitSeason.stats[0]?.splits[0]?.stat ?? {};
  const pit = pitchSeason.stats[0]?.splits[0]?.stat ?? {};

  // キャリア (2018以降 MLB のみ)
  const careerBatting = (hitCareer.stats[0]?.splits ?? [])
    .filter(s => parseInt(s.season) >= 2018)
    .map(s => ({
      year: s.season,
      team: toJa(s.team?.name ?? ''),
      avg:  parseFloat(s.stat.avg ?? 0),
      g:    s.stat.gamesPlayed   ?? 0,
      ab:   s.stat.atBats        ?? 0,
      h:    s.stat.hits          ?? 0,
      hr:   s.stat.homeRuns      ?? 0,
      rbi:  s.stat.rbi           ?? 0,
      r:    s.stat.runs          ?? 0,
      so:   s.stat.strikeOuts    ?? 0,
      sb:   s.stat.stolenBases   ?? 0,
      obp:  parseFloat(s.stat.obp ?? 0),
      slg:  parseFloat(s.stat.slg ?? 0),
      ops:  parseFloat(s.stat.ops ?? 0),
      pa:   s.stat.plateAppearances ?? 0,
    }));

  const careerPitching = (pitchCareer.stats[0]?.splits ?? [])
    .filter(s => parseInt(s.season) >= 2018)
    .map(s => ({
      year: s.season,
      team: toJa(s.team?.name ?? ''),
      era:  parseFloat(s.stat.era  ?? 0),
      g:    s.stat.gamesPlayed     ?? 0,
      gs:   s.stat.gamesStarted    ?? 0,
      w:    s.stat.wins            ?? 0,
      l:    s.stat.losses          ?? 0,
      ip:   s.stat.inningsPitched  ?? '0',
      so:   s.stat.strikeOuts      ?? 0,
      bb:   s.stat.baseOnBalls     ?? 0,
      h:    s.stat.hits            ?? 0,
      whip: parseFloat(s.stat.whip ?? 0),
    }));

  // 試合別ログ（グラフ用）
  const batGameLogs = (hitGameLog.stats[0]?.splits ?? []).map(s => ({
    date: s.date,
    h:   s.stat.hits              ?? 0,
    ab:  s.stat.atBats            ?? 0,
    hr:  s.stat.homeRuns          ?? 0,
    rbi: s.stat.rbi               ?? 0,
    bb:  s.stat.baseOnBalls       ?? 0,
    tb:  (s.stat.hits ?? 0) + (s.stat.doubles ?? 0)
         + 2 * (s.stat.triples ?? 0) + 3 * (s.stat.homeRuns ?? 0),
    pa:  s.stat.plateAppearances  ?? 0,
  }));

  const pitGameLogs = (pitGameLog.stats[0]?.splits ?? []).map(s => ({
    date: s.date,
    ip:  s.stat.inningsPitched ?? '0',
    so:  s.stat.strikeOuts     ?? 0,
    er:  s.stat.earnedRuns     ?? 0,
    bb:  s.stat.baseOnBalls    ?? 0,
    h:   s.stat.hits           ?? 0,
  }));

  const data = {
    lastUpdated: new Date().toISOString(),
    gameLogs: {
      batting:  batGameLogs,
      pitching: pitGameLogs,
    },
    currentSeason: {
      year,
      batting: {
        avg:   bat.avg             ?? '.---',
        g:     bat.gamesPlayed     ?? 0,
        ab:    bat.atBats          ?? 0,
        h:     bat.hits            ?? 0,
        hr:    bat.homeRuns        ?? 0,
        rbi:   bat.rbi             ?? 0,
        r:     bat.runs            ?? 0,
        so:    bat.strikeOuts      ?? 0,
        sb:    bat.stolenBases     ?? 0,
        pa:    bat.plateAppearances ?? 0,
        obp:   bat.obp             ?? '.---',
        slg:   bat.slg             ?? '.---',
        ops:   bat.ops             ?? '.---',
      },
      pitching: {
        era:   pit.era             ?? '-.--',
        g:     pit.gamesPlayed     ?? 0,
        gs:    pit.gamesStarted    ?? 0,
        w:     pit.wins            ?? 0,
        l:     pit.losses          ?? 0,
        ip:    pit.inningsPitched  ?? '0.0',
        so:    pit.strikeOuts      ?? 0,
        bb:    pit.baseOnBalls     ?? 0,
        h:     pit.hits            ?? 0,
        whip:  pit.whip            ?? '-.--',
      },
    },
    career: {
      batting:  careerBatting,
      pitching: careerPitching,
    },
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ data.json に保存完了 (${careerBatting.length} 年分の打撃, ${careerPitching.length} 年分の投球, 打撃ゲームログ ${batGameLogs.length} 試合, 投球ゲームログ ${pitGameLogs.length} 登板)`);
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
