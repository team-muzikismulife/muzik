import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('../..');
async function checkSource(directory){
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())await checkSource(file);
    else if(/\.[cm]?[jt]sx?$/.test(file)){
      const content=await fs.readFile(file,'utf8');
      if(/MUZIK_LOCAL_TEST|x-muzik-test-video-fail|검증용 음악|mock-preview-room/.test(content))throw new Error('테스트 구현이 운영 소스에 포함됨');
      for(const match of content.matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)){
        const specifier=match[1];
        const resolved=specifier.startsWith('.')?path.relative(root,path.resolve(path.dirname(file),specifier)).replaceAll('\\','/'):specifier;
        if(/^(?:legacy|tests|examples|firebase|expo)(?:\/|$|-)/.test(resolved))throw new Error(`운영 import 경계 위반: ${path.relative(root,file)}`);
      }
    }
  }
}
for(const directory of ['apps/web/src','packages/domain','supabase/functions'])await checkSource(path.join(root,directory));
const files = await fs.readdir('dist/assets');
for (const file of files.filter(file => file.endsWith('.js'))) {
  const text = await fs.readFile(`dist/assets/${file}`, 'utf8');
  if (/firebaseapp\.com|firestore\.googleapis|expo-router|ReactNative|YOUTUBE_API_KEY|SUPABASE_SERVICE_ROLE_KEY|mock-preview-room|검증용 음악|x-muzik-test-video-fail/.test(text)) throw new Error(`금지된 플랫폼/비밀키/fixture 참조: ${file}`);
}
console.log('PASS 새 번들 Firebase/Expo/서버 키 참조 없음');
