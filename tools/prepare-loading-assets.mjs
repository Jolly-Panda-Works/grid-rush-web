import {readFile,writeFile} from 'node:fs/promises';
const root='client/public/ui-kit-premium/';
const b=await readFile(root+'loading-bar-layers.png');
const W=b.readUInt32BE(16),H=b.readUInt32BE(20);
const regions={border:[35,140,1700,220],background:[130,405,1510,180],fill:[130,625,1510,180]};
for(const [id,[x,y,w,h]] of Object.entries(regions)){
 const image=`data:image/png;base64,${b.toString('base64')}`;
 await writeFile(root+`loading-bar-${id}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><defs><clipPath id="crop"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><image href="${image}" width="${W}" height="${H}" clip-path="url(#crop)"/></svg>`);
}
const names=['رستم','سهراب','آرش','سیاوش','زال','تهمینه','گردآفرید','رودابه','شهرزاد','فردوسی'];
await writeFile(root+'persian-characters-manifest.json',JSON.stringify({file:'persian-characters-unframed.png',columns:2,rows:5,transparent:true,framed:false,order:'left-to-right, top-to-bottom',characters:names.map((name,i)=>({name,cell:i+1,row:Math.floor(i/2)+1,column:i%2+1})),note:'Original generated atlas; character depictions are artistic interpretations.'},null,2));
await writeFile(root+'loading-bar-manifest.json',JSON.stringify({source:'loading-bar-layers.png',layers:regions,files:Object.keys(regions).map(k=>`loading-bar-${k}.svg`),note:'Self-contained SVG viewports embed original raster artwork without changing pixels. Layer widths differ: fit background/fill into the frame opening; reveal fill with a clipping mask.'},null,2));
console.log('Prepared three independent bar layers and ten-character manifest.');
