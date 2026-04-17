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

// チーム名 英語 → 日本語（大谷キャリア用）
const TEAM_NAME_JA = {
  'Los Angeles Angels': 'エンゼルス',
  'Los Angeles Dodgers': 'ドジャース',
};
const toJa = (name) => TEAM_NAME_JA[name] ?? name;

// チーム名 英語 → 日本語（日本人選手用・全30球団）
const MLB_TEAM_JA_FULL = {
  'Los Angeles Dodgers':    'LAドジャース',
  'Los Angeles Angels':     'LAエンゼルス',
  'New York Yankees':       'NYYヤンキース',
  'New York Mets':          'NYMメッツ',
  'Chicago Cubs':           'CHCカブス',
  'Chicago White Sox':      'CWSホワイトソックス',
  'Boston Red Sox':         'BOSレッドソックス',
  'San Francisco Giants':   'SFGジャイアンツ',
  'Toronto Blue Jays':      'TORブルージェイズ',
  'Houston Astros':         'HOUアストロズ',
  'Atlanta Braves':         'ATLブレーブス',
  'Philadelphia Phillies':  'PHIフィリーズ',
  'St. Louis Cardinals':    'STLカーディナルス',
  'San Diego Padres':       'SDパドレス',
  'Arizona Diamondbacks':   'ARIダイヤモンドバックス',
  'Colorado Rockies':       'COLロッキーズ',
  'Minnesota Twins':        'MINツインズ',
  'Cleveland Guardians':    'CLEガーディアンズ',
  'Detroit Tigers':         'DETタイガース',
  'Kansas City Royals':     'KCロイヤルズ',
  'Baltimore Orioles':      'BALオリオールズ',
  'Tampa Bay Rays':         'TBレイズ',
  'Miami Marlins':          'MIAマーリンズ',
  'Washington Nationals':   'WASナショナルズ',
  'Pittsburgh Pirates':     'PITパイレーツ',
  'Cincinnati Reds':        'CINレッズ',
  'Milwaukee Brewers':      'MILブルワーズ',
  'Oakland Athletics':      'OAKアスレチックス',
  'Athletics':              'OAKアスレチックス',
  'Seattle Mariners':       'SEAマリナーズ',
  'Texas Rangers':          'TEXレンジャーズ',
};
const toJaTeam = (name) => {
  if (!name) return '—';
  return MLB_TEAM_JA_FULL[name]
      ?? MLB_TEAM_JA_FULL[name.split(' ').slice(-1)[0]]
      ?? name;
};

// 日本人選手リスト
const JP_BATTERS = [
  { ja:'村上宗隆', search:'Munetaka Murakami' },
  { ja:'岡本和真',  search:'Kazuma Okamoto'    },
  { ja:'鈴木誠也',  search:'Seiya Suzuki'      },
  { ja:'吉田正尚',  search:'Masataka Yoshida'  },
];
const JP_PITCHERS = [
  { ja:'山本由伸',   search:'Yoshinobu Yamamoto' },
  { ja:'佐々木朗希', search:'Roki Sasaki'         },
  { ja:'今永昇太',   search:'Shota Imanaga'       },
  { ja:'千賀滉大',   search:'Kodai Senga'         },
  { ja:'菊池雄星',   search:'Yusei Kikuchi'       },
  { ja:'菅野智之',   search:'Tomoyuki Sugano'     },
  { ja:'今井達也',   search:'Tatsuya Imai'        },
];

async function resolveId(searchName) {
  try {
    const d = await fetchJSON(
      `${BASE_URL}/people/search?names=${encodeURIComponent(searchName)}&sportId=1`
    );
    const people = (d.people ?? []).sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
    return people[0]?.id ?? null;
  } catch { return null; }
}

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

  // ── 日本人選手IDを並列解決 ──────────────────────
  const [jpBatWithId, jpPitWithId] = await Promise.all([
    Promise.all(JP_BATTERS.map(p  => resolveId(p.search).then(id => ({ ...p, id })))),
    Promise.all(JP_PITCHERS.map(p => resolveId(p.search).then(id => ({ ...p, id })))),
  ]);

  // ── 大谷・日本人選手の全データを並列取得 ─────────
  const fetchJPStat = async (player, group) => {
    if (!player.id) return { ja: player.ja, id: null, team: '—', stat: null };
    try {
      const d = await fetchJSON(
        `${BASE_URL}/people/${player.id}/stats?stats=season&season=${year}&group=${group}&sportId=1`
      );
      const split = d.stats?.[0]?.splits?.[0];
      return {
        ja:   player.ja,
        id:   player.id,
        team: toJaTeam(split?.team?.name ?? ''),
        stat: split?.stat ?? null,
      };
    } catch { return { ja: player.ja, id: player.id, team: '—', stat: null }; }
  };

  const [hitSeason, pitchSeason, hitCareer, pitchCareer, hitGameLog, pitGameLog,
         ...jpResults] = await Promise.all([
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=season&season=${year}&group=hitting&sportId=${SPORT_ID}`),
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=season&season=${year}&group=pitching&sportId=${SPORT_ID}`),
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=yearByYear&group=hitting&sportId=${SPORT_ID}`),
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=yearByYear&group=pitching&sportId=${SPORT_ID}`),
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=gameLog&season=${year}&group=hitting&sportId=${SPORT_ID}`),
    fetchJSON(`${BASE_URL}/people/${MLB_PLAYER_ID}/stats?stats=gameLog&season=${year}&group=pitching&sportId=${SPORT_ID}`),
    // 日本人打者 (4名)
    ...jpBatWithId.map(p => fetchJPStat(p, 'hitting')),
    // 日本人投手 (7名)
    ...jpPitWithId.map(p => fetchJPStat(p, 'pitching')),
  ]);
  const jpBatStats = jpResults.slice(0, JP_BATTERS.length);
  const jpPitStats = jpResults.slice(JP_BATTERS.length);

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
    jpPlayers: {
      batting:  jpBatStats,
      pitching: jpPitStats,
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
  const jpBatOk = jpBatStats.filter(p => p.stat).length;
  const jpPitOk = jpPitStats.filter(p => p.stat).length;
  console.log(`✅ data.json に保存完了 (${careerBatting.length} 年分の打撃, ${careerPitching.length} 年分の投球, 打撃ゲームログ ${batGameLogs.length} 試合, 投球ゲームログ ${pitGameLogs.length} 登板, 日本人打者 ${jpBatOk}/${JP_BATTERS.length} 名, 日本人投手 ${jpPitOk}/${JP_PITCHERS.length} 名)`);
}

main().catch(err => {
  console.error('❌ エラー:', err.message);
  process.exit(1);
});
