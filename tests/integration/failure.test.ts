import { it, expect } from 'vitest';
import { GameEngine } from '../../apps/server/src/engine';
import { simulateShot, type ShotResult } from '../../packages/physics/src/index';
it('a worker error aborts with no partial terrain or score and a late result cannot overwrite terminal state',async()=>{
  for(const failure of ['error','late']) {
    let now=0,finishJob: ((r:ShotResult)=>void)|undefined, result: ShotResult|undefined;
    const e=new GameEngine({code:'FAIL42',mode:'workshop-quick',seed:1,now:()=>now,countdownMs:1,simulate:input=>{if(failure==='error')return Promise.reject(Error('Worker error'));result=simulateShot(input);return new Promise(r=>{finishJob=r;});},publish:()=>{}});
    e.addPlayer('a','A');e.addPlayer('b','B');for(const slot of [0,1])e.command(slot,{v:1,id:`ready${slot}`,matchId:e.state.matchId,turnId:0,type:'ready',data:true});now=2;e.tick();const checksum=e.state.checksum;
    e.command(e.state.active,{v:1,id:'fire',matchId:e.state.matchId,turnId:e.state.turnId,type:'fire',data:{angle:90,power:60,weapon:'standard'}});
    if(failure==='late'){e.abort('Operator abort');finishJob!(result!);}await Promise.resolve();await Promise.resolve();
    expect(e.state.phase).toBe('aborted');expect(e.state.result?.winner).toBe(null);expect(e.state.checksum).toBe(checksum);expect(e.state.terrainVersion).toBe(0);expect(e.state.players.map(p=>p.score)).toEqual([0,0]);
  }
});
