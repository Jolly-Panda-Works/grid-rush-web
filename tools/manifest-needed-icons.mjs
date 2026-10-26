import {readFile,writeFile} from 'node:fs/promises';
const dir='client/public/ui-kit-premium/';
const doc=await readFile('docs/icons-needed.md','utf8');
const ids=[...doc.matchAll(/^\|\s*\d+\s*\|\s*`([^`]+)`/gm)].map(m=>m[1]);
if(ids.length!==44)throw Error(`Expected 44 icon ids, found ${ids.length}`);
const sheets=[];
for(const [file,start,count] of [['achievements-atlas.png',0,16],['ui-icons-atlas.png',16,16],['game-icons-atlas.png',32,12]]){
 const b=await readFile(dir+file),width=b.readUInt32BE(16),height=b.readUInt32BE(20);
 if(width!==1254||height!==1254)throw Error(`Unexpected sheet dimensions: ${file} ${width}x${height}`);
 sheets.push({file,width,height,columns:4,rows:4,cellWidth:313.5,cellHeight:313.5,emptyCells:count===12?[13,14,15,16]:[],icons:ids.slice(start,start+count).map((id,i)=>({id,cell:i+1,row:Math.floor(i/4)+1,column:i%4+1}))});
}
await writeFile(dir+'icons-needed-manifest.json',JSON.stringify({source:'docs/icons-needed.md',tool:'built-in image_gen',order:'row-major, left to right',note:'Original generated sheets; not sliced. Cells are 313.5 px wide, so use consistent rounded boundaries if slicing into integer pixel rectangles.',sheets},null,2));
console.log('Verified 44 icon ids, three 1254x1254 PNG sheets; manifest saved.');
