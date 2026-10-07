import { mkdirSync, writeFileSync } from 'node:fs';
import { GameEngine } from '../apps/server/src/engine';
import { simulateShot, distanceToHull } from '../packages/physics/src/index';
import { pack } from '../packages/terrain/src/index';
import type { Weapon } from '../packages/protocol/src/index';
mkdirSync('dist/fixtures', { recursive: true });
for (const name of ['lobby','aiming','miss','direct-hit','self-hit','crater','scatter','cluster','drilling','settling','transition','reconnect','draw']) {
  const e = new GameEngine({ code:'DEMO42',mode:'standard',seed:12,simulate:async i=>simulateShot(i),publish:()=>{} }); e.addPlayer('fixture-a','Fixture A'); e.addPlayer('fixture-b','Fixture B'); e.state.phase = name==='lobby' ? 'waiting' : name==='draw' ? 'finished' : 'aiming'; e.state.active=0; e.state.round=1;
  if(name==='draw') e.state.result={winner:null,reason:'Fixture draw'};
  const weapon: Weapon = name==='scatter' ? 'scatter' : name==='cluster'||name==='reconnect' ? 'cluster' : name==='drilling' ? 'borer' : 'standard';
  const angle = name==='self-hit'||name==='settling' ? 90 : name==='miss' ? 180 : name==='drilling'?25:45;
  let result=simulateShot({mask:e.mask,tanks:e.state.tanks,shooter:0,aim:{angle,power:name==='drilling'?35:67,weapon},wind:0,version:0});
  if(name==='direct-hit') { let found=false;for(let a=35;a<=70&&!found;a+=5)for(let power=55;power<=100;power++){const candidate=simulateShot({mask:e.mask,tanks:e.state.tanks,shooter:0,aim:{angle:a,power,weapon},wind:0,version:0});if(candidate.events.some(event=>event.type==='explosion'&&distanceToHull(event,e.state.tanks[1])<=2)){result=candidate;found=true;break;}}if(!found)throw Error('Direct-hit fixture search failed'); }
  if(name==='drilling'&&!result.events.some(e=>e.type==='drill'))throw Error('Drilling fixture missing drill event');
  const timeline={id:`fixture-${name}`,matchId:e.state.matchId,turnId:1,start:0,duration:result.duration,baseVersion:0,tracks:result.tracks,events:result.events,tanks:result.tanks,patch:result.patch,opponent:result.opponent,self:result.self,net:result.net};
  writeFileSync(`dist/fixtures/${name}.json`,JSON.stringify({fixture:true,label:`FIXTURE / ${name}`,state:e.state,terrainBase64:Buffer.from(pack(e.mask)).toString('base64'),timeline}));
}
