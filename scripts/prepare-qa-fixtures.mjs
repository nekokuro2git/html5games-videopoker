import fs from 'node:fs/promises';
import { newGame, transition, validateSave } from '../src/engine.mjs';
const deck = (prefix, n = 54) => [...prefix, ...Array.from({ length: n }, (_, i) => i).filter(i => !prefix.includes(i))];
function deal(hand) { return transition(newGame(), { type: 'DEAL', deck: deck(hand) }); }
function win(hand) { let s=deal(hand); for(let i=0;i<5;i++)if(!s.held[i])s=transition(s,{type:'HOLD',index:i});return transition(s,{type:'DRAW',at:'2026-10-28T12:00:00.000Z'}); }
let hold=deal([13,27,33,52,53]);
for(let i=0;i<5;i++)if(hold.held[i] !== (i>=3))hold=transition(hold,{type:'HOLD',index:i});
const four=win([0,9,48,52,53]);
let double=transition(win([1,14,28,2,33]),{type:'DOUBLE',deck:deck([1,17,27,29,3,48],52)});
double=transition(double,{type:'GUESS',choice:'small'});
double=transition(double,{type:'CONTINUE'});
const push=structuredClone(double);push.double.deck=[6,...push.double.deck.filter(id=>id!==6)];
const fixtures={ready:newGame(),hold,four,double,push};
await fs.mkdir('qa/fixtures',{recursive:true});
for(const [name,value]of Object.entries(fixtures)){if(!validateSave(value))throw new Error(`Invalid fixture ${name}`);await fs.writeFile(`qa/fixtures/${name}.json`,JSON.stringify(value,null,2));}
console.log(JSON.stringify({fixtures:Object.keys(fixtures)}));
