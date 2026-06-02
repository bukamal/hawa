const fs=require('fs'), path=require('path');
const dest=path.join(__dirname,'..','lib');
if(!fs.existsSync(dest)) fs.mkdirSync(dest,{recursive:true});
const src=path.join(__dirname,'..','node_modules','sql.js','dist','sql-wasm.wasm');
if(fs.existsSync(src)) fs.copyFileSync(src,path.join(dest,'sql-wasm.wasm'));
else console.error('sql-wasm.wasm not found');
