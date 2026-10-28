import fs from 'node:fs/promises';
import { TextureAtlas } from '@pixi-spine/base';
import { BaseTexture, TextureMatrix } from '@pixi/core';
import { SkeletonBinary, AtlasAttachmentLoader, Skeleton, MeshAttachment, RegionAttachment, AnimationState, AnimationStateData } from '@pixi-spine/runtime-3.8';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const source='research/evidence/source';
const atlasText=await fs.readFile(`${source}/card-atlas.txt`,'utf8');
const atlas=new TextureAtlas(atlasText,(_,callback)=>callback(new BaseTexture(null,{width:1397,height:1397})));
const data=new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(new Uint8Array(await fs.readFile(`${source}/card-skeleton.bin`)));
console.log(JSON.stringify({skins:data.skins.map(s=>s.name),animations:data.animations.map(s=>s.name),slots:data.slots.map(s=>({name:s.name,attachment:s.attachmentName}))}));
const plans=[];
for(const skin of data.skins){
 if(skin.name==='default')continue;
 const skeleton=new Skeleton(data);skeleton.setSkin(skin);skeleton.setToSetupPose();
 // Freeze the source's face-up idle animation rather than drawing a substitute card.
 const animation=data.findAnimation('Card_Open');
 if(animation){const state=new AnimationState(new AnimationStateData(data));state.setAnimation(0,animation.name,false);state.update(animation.duration);state.apply(skeleton);}
 skeleton.updateWorldTransform();
 const parts=[];
 for(const slot of skeleton.drawOrder){
  const attachment=slot.getAttachment();if(!attachment)continue;
  let vertices,uvs,triangles;
  if(attachment instanceof MeshAttachment){vertices=new Float32Array(attachment.worldVerticesLength);attachment.computeWorldVertices(slot,0,attachment.worldVerticesLength,vertices,0,2);uvs=new Float32Array(attachment.regionUVs.length);const matrix=new TextureMatrix(attachment.region.texture);matrix.update();matrix.multiplyUvs(attachment.regionUVs,uvs);triangles=attachment.triangles;}
  else if(attachment instanceof RegionAttachment){attachment.setRegion(attachment.region);attachment.updateOffset();vertices=new Float32Array(8);attachment.computeWorldVertices(slot.bone,vertices,0,2);uvs=attachment.uvs;triangles=[0,1,2,2,3,0];}
  else continue;
  parts.push({name:attachment.name,vertices:Array.from(vertices),uvs:Array.from(uvs),triangles:Array.from(triangles),alpha:slot.color.a*attachment.color.a,slot:slot.data.name});
 }
 plans.push({skin:skin.name,parts});
}
await fs.writeFile(`${source}/card-render-plan.json`,JSON.stringify(plans));
const python=spawnSync('python',['scripts/bake-cards.py'],{encoding:'utf8'});if(python.status!==0)throw new Error(python.stderr);console.log(python.stdout);
const manifest=JSON.parse(await fs.readFile('public/assets/manifest.json','utf8'));
const names=[...(await fs.readdir('public/assets/deck')).map(n=>`deck/${n}`),'logo.png'];
manifest.assets=manifest.assets.filter(a=>!names.includes(a.file));
for(const file of names){const bytes=await fs.readFile(`public/assets/${file}`);manifest.assets.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),transform:file==='logo.png'?'metadata-atlas-crop':'source-spine-mesh-rasterization',sourcePath:file==='logo.png'?'main/LOGO':'res/spine/Card',sourceUrl:manifest.assets.find(a=>a.file===(file==='logo.png'?'main-atlas-3.webp':'videopoker-atlas.webp')).sourceUrl,metadataSource:file==='logo.png'?'research/evidence/source/assets/main/pack.json':'research/evidence/source/card-skeleton.bin'});}
await fs.writeFile('public/assets/manifest.json',JSON.stringify(manifest,null,2));
