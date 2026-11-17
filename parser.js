/* ---------- 1. DataFlash .BIN parser ---------- */
const SZ={b:1,B:1,M:1,h:2,H:2,c:2,C:2,i:4,I:4,e:4,E:4,L:4,f:4,d:8,q:8,Q:8,n:4,N:16,Z:64,a:64};
function rd(dv,o,ch){switch(ch){
 case'b':return dv.getInt8(o);case'B':case'M':return dv.getUint8(o);
 case'h':return dv.getInt16(o,true);case'H':return dv.getUint16(o,true);
 case'c':return dv.getInt16(o,true)/100;case'C':return dv.getUint16(o,true)/100;
 case'i':return dv.getInt32(o,true);case'I':return dv.getUint32(o,true);
 case'e':return dv.getInt32(o,true)/100;case'E':return dv.getUint32(o,true)/100;
 case'L':return dv.getInt32(o,true)/1e7;case'f':return dv.getFloat32(o,true);
 case'd':return dv.getFloat64(o,true);
 case'q':return Number(dv.getBigInt64(o,true));case'Q':return Number(dv.getBigUint64(o,true));
 case'n':case'N':case'Z':{let s='';for(let k=0;k<SZ[ch];k++){const c=dv.getUint8(o+k);if(!c)break;s+=String.fromCharCode(c)}return s}
 default:return 0}}
const WANT=new Set(['ATT','POS','GPS','RCOU','MODE','BAT','BARO']);
function parseBin(buf){
 const dv=new DataView(buf),u=new Uint8Array(buf),n=u.length;
 const F={128:{len:89,name:'FMT',f:'BBnNZ',c:['Type','Length','Name','Format','Columns']}};
 const d={},cnt={};let p=0;
 while(p<n-3){
  if(u[p]!==0xA3||u[p+1]!==0x95){p++;continue}
  const fm=F[u[p+2]];
  if(!fm||p+fm.len>n){p++;continue}
  const isF=fm.name==='FMT';
  if(isF||WANT.has(fm.name)){
   let o=p+3;const r={};
   for(let i=0;i<fm.f.length;i++){r[fm.c[i]]=rd(dv,o,fm.f[i]);o+=SZ[fm.f[i]]||0}
   if(isF)F[r.Type]={len:r.Length,name:r.Name,f:r.Format,c:r.Columns.split(',')};
   else(d[fm.name]||(d[fm.name]=[])).push(r);
  }
  cnt[fm.name]=(cnt[fm.name]||0)+1;
  p+=fm.len;
 }
 return{d,cnt};
}

