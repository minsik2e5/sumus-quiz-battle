import { readFileSync } from 'node:fs';
import { parseJsonc, testEnvProblems } from './test-app-check.mjs';

// V13.149 테스트 앱 배포 직전 가드(.github/workflows/deploy-test.yml): 설정이나 dry-run 결과가 운영을 가리키면 멈춘다.
const config = parseJsonc(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const problems = testEnvProblems(config);
const dry = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : '';
if (process.argv[2] && dry.includes('supabase.co')) problems.push('dry-run 결과에 Supabase 주소가 있습니다.');
if (process.argv[2] && !/VOCA_STANDALONE \("1"\)/.test(dry)) problems.push('dry-run 결과에 VOCA_STANDALONE=1이 없습니다.');
if (problems.length) { console.error('[test-app-guard] 배포 중단:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('[test-app-guard] OK: 테스트 앱(sumus-voca-test)만, Supabase 없이 배포합니다.');
