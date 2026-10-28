import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'research/evidence/source');
const out=path.join(root,'public/assets');
await fs.mkdir(out,{recursive:true});
const config=JSON.parse(await fs.readFile(path.join(source,'assets/game/config.13167.json'),'utf8'));
const pack=JSON.parse(await fs.readFile(path.join(source,'assets/game/pack.json'),'utf8'));
const main=JSON.parse(await fs.readFile(path.join(source,'assets/main/config.335c5.json'),'utf8'));
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function uuid(value){const [part,suffix]=value.split('@');let v=part;if(v.length===22){let hex=v.slice(0,2);for(let i=2;i<22;i+=2)hex+=((alphabet.indexOf(v[i])<<6)|alphabet.indexOf(v[i+1])).toString(16).padStart(3,'0');v=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}return v+(suffix?'@'+suffix:'');}
const records=[];
async function download(c,index,file,extension){const u=uuid(c.uuids[index]);const vi=c.versions.native.findIndex((v,i)=>i%2===0&&v===Number(index));if(vi<0)throw new Error(`Missing native ${index} ${file}`);const fontName={22:'bahnschrift.ttf',91:'AGaramondPro-Bold.ttf',311:'OpenSans-Bold.ttf'}[index];const suffix=extension==='ttf'?`/${fontName}`:`.${extension}`;const url=`https://casino-wbgame.tadagaming.com/videopoker/assets/${c.name}/native/${u.slice(0,2)}/${u}.${c.versions.native[vi+1]}${suffix}`;const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);const bytes=Buffer.from(await response.arrayBuffer());await fs.mkdir(path.dirname(path.join(out,file)),{recursive:true});await fs.writeFile(path.join(out,file),bytes);const record={file,sourceUrl:url,sourceUuid:u,sourcePath:c.paths[index]?.[0]||`packed texture ${u}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),transform:'none'};records.push(record);return record;}
const files=[[14,'background.png','png'],[26,'videopoker-atlas.webp','webp'],[22,'bahnschrift.ttf','ttf'],[91,'garamond-bold.ttf','ttf'],[311,'open-sans-bold.ttf','ttf'],[4,'audio/bgm.mp3','mp3'],[63,'audio/click.mp3','mp3'],[27,'audio/deal.mp3','mp3'],[24,'audio/flip.mp3','mp3'],[104,'audio/hold.mp3','mp3'],[21,'audio/cashout.mp3','mp3'],[1,'audio/double.mp3','mp3'],[41,'audio/lose.mp3','mp3'],[37,'audio/win.mp3','mp3'],[51,'audio/double-deal.mp3','mp3']];
for(let i=0;i<files.length;i+=5)await Promise.all(files.slice(i,i+5).map(([id,file,ext])=>download(config,id,file,ext)));
for(const id of [127,139,141,144,145,148,150,151,152,245])await download(config,id,`atlas-${id}.webp`,id===139||id===245?'png':'webp');
// These three shared textures belong to the main bundle according to game.redirect.
for(const id of [2,3,5,12])await download(main,id,`main-atlas-${id}.webp`,id===12?'png':'webp');
const crops=[];
for(const [index,p]of Object.entries(config.paths)){
 if(p[1]!==3)continue;
 const pi=config.packs['0c70ebca0'].indexOf(Number(index));const item=pack[5][pi];const meta=item?.[0]?.[0];
 if(!meta?.rect||!item[5]?.length)continue;
 const texture=pack[1][item[5][0]]?.split('@')[0];if(!texture)continue;
 const textureId=config.uuids.indexOf(texture);let textureFile=`atlas-${textureId}.webp`;
 if(textureId===14)textureFile='background.png';
 if(textureId===-1||[2,3,5,12].some(id=>main.uuids[id]===texture))textureFile=`main-atlas-${main.uuids.indexOf(texture)}.webp`;
 if(!records.some(r=>r.file===textureFile))continue;
 const file=`ui/${index}.png`;crops.push({index:Number(index),file,sourcePath:p[0],textureFile,rect:meta.rect,rotated:meta.rotated,originalSize:meta.originalSize,offset:meta.offset});
}
const spineItem=pack[5][config.packs['0c70ebca0'].indexOf(82)];
const atlasText=spineItem[0][0][3];await fs.writeFile(path.join(source,'card-atlas.txt'),atlasText);
const spine=[];const lines=atlasText.split(/\r?\n/);for(let i=0;i<lines.length;i++){
 if(!lines[i]||/^\s/.test(lines[i])||lines[i].endsWith('.png')||lines[i].includes(':'))continue;
 const properties={};let j=i+1;while(j<lines.length&&/^\s/.test(lines[j])){const [k,...v]=lines[j].trim().split(':');properties[k]=v.join(':').trim();j++;}
 if(!properties.xy)continue;
 const [x,y]=properties.xy.split(',').map(Number),[width,height]=properties.size.split(',').map(Number);
 const file=`cards/${lines[i].replaceAll('/','-')}.png`;
 spine.push({file,sourcePath:`spine/Card/${lines[i]}`,textureFile:'videopoker-atlas.webp',rect:{x,y,width,height},rotated:properties.rotate==='true',originalSize:{width,height},offset:{x:0,y:0}});
}
await fs.writeFile(path.join(source,'crop-plan.json'),JSON.stringify([...crops,...spine],null,2));
const python=spawnSync('python',['-c',`import json,sys\nfrom pathlib import Path\nfrom PIL import Image\nroot=Path(sys.argv[1]); plan=json.load(open(sys.argv[2],encoding='utf-8')); cache={}\nfor c in plan:\n f=root/c['textureFile']; im=cache.setdefault(str(f),Image.open(f).convert('RGBA')); r=c['rect']; x,y,w,h=r['x'],r['y'],r['width'],r['height']; rot=c['rotated']; tile=im.crop((x,y,x+(h if rot else w),y+(w if rot else h))); tile=tile.transpose(Image.Transpose.ROTATE_90) if rot else tile; target=root/c['file']; target.parent.mkdir(exist_ok=True,parents=True); tile.save(target)\nprint(json.dumps({'crops':len(plan)}))`,out,path.join(source,'crop-plan.json')],{encoding:'utf8'});if(python.status!==0)throw new Error(python.stderr);
for(const c of [...crops,...spine]){const b=await fs.readFile(path.join(out,c.file));const origin=records.find(r=>r.file===c.textureFile);records.push({...c,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),sourceUrl:origin.sourceUrl,sourceSha256:origin.sha256,transform:'metadata-atlas-crop'});}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),engine:'Cocos Creator 3.8.5',assets:records},null,2));
await fs.writeFile(path.join(out,'ui-map.json'),JSON.stringify(Object.fromEntries(crops.map(c=>[c.sourcePath,c.file])),null,2));
console.log(JSON.stringify({assets:records.length,crops:crops.length,spine:spine.length,bytes:records.reduce((s,r)=>s+r.bytes,0)}));
