const fs=require('fs'), path=require('path');
const src=path.join(__dirname,'..','node_modules','sql.js','dist');
const dest=path.join(__dirname,'..','lib');
if(!fs.existsSync(dest)) fs.mkdirSync(dest,{recursive:true});
['sql-wasm.js','sql-wasm.wasm'].forEach(f=>{ if(fs.existsSync(path.join(src,f))) fs.copyFileSync(path.join(src,f),path.join(dest,f)); });
