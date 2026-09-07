let datos=[];
let todasLasColumnasDetectadas=[];
const TIPOS_VALIDOS=["HVO","PER","COC"];
const COLUMNAS_PREDETERMINADAS=["Doc.venta","Pedido de cliente","Fecha doc.","FePrefEnt.","Solic.","Solicitante","Material","Número de material","Ctd pedido UMV"];
const STORAGE_KEY="columnasVisiblesPedidos_v1";
let columnasVisibles=cargarColumnasVisibles();
let fechaDetectadaPorFiltro=null;
let infoFiltro=null;

// --- NUEVO: SISTEMA DE TOASTS (NOTIFICACIONES) ---
function showToast(mensaje, tipo = 'warning') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = mensaje;
    container.appendChild(toast);
    
    // El CSS se encarga de la animación de salida a los 3.5s
    setTimeout(() => {
        if(toast.parentElement) toast.parentElement.removeChild(toast);
    }, 4000); // 4s asegura que el DOM se limpie después de la animación
}

// --- NUEVO: CONTROL DEL BOTTOM SHEET ---
function abrirFiltros() {
    if(datos.length === 0) {
        return showToast("Primero debes elegir un archivo Excel", "warning");
    }
    const overlay = document.getElementById("bottomSheetOverlay");
    overlay.style.display = "flex";
    setTimeout(() => overlay.classList.add("active"), 10);
}

function cerrarFiltros() {
    const overlay = document.getElementById("bottomSheetOverlay");
    overlay.classList.remove("active");
    setTimeout(() => overlay.style.display = "none", 300);
}

// Cerrar Bottom Sheet al tocar fuera de la ventana
document.getElementById("bottomSheetOverlay").addEventListener("click", (e) => {
    if(e.target === document.getElementById("bottomSheetOverlay")) cerrarFiltros();
});
// ------------------------------------------------

function normalizar(s){return String(s).toLowerCase().trim().replace(/\s+/g,' ');}

function encontrarFilaEncabezado(matriz){
  const esperadas=new Set(COLUMNAS_PREDETERMINADAS.map(normalizar));
  ["dp","departamento","pos.","pos","material","um"].forEach(c=>esperadas.add(c));
  let mejorIdx=-1, mejorScore=-1;
  const limite=Math.min(matriz.length,30);
  for(let i=0;i<limite;i++){
    const fila=matriz[i]; if(!fila) continue;
    const noVacias=fila.filter(c=>String(c).trim()!=="");
    if(noVacias.length<3) continue;
    const norm=noVacias.map(c=>normalizar(c));
    let score=0; norm.forEach(nc=>{if(esperadas.has(nc)) score++;});
    if(norm.includes("doc.venta")) score+=3;
    if(norm.includes("solicitante")) score+=2;
    if(norm.includes("feprefent.")) score+=2;
    if(score>mejorScore){mejorScore=score; mejorIdx=i;}
  }
  if(mejorScore>=2) return mejorIdx;
  for(let i=0;i<matriz.length;i++){ if(matriz[i].some(c=>String(c).trim()!=="")) return i; }
  return -1;
}

async function parsearFiltrosExcel(file){
  try{
    if(typeof JSZip==="undefined"){ console.warn("JSZip no cargado"); return null; }
    const zip=await JSZip.loadAsync(file);
    let sheetFile=null;
    const worksheetFiles=Object.keys(zip.files).filter(n=>n.match(/xl\/worksheets\/sheet\d+\.xml/));
    if(worksheetFiles.length===0){ return null; }
    sheetFile=zip.file(worksheetFiles[0]);
    const xml=await sheetFile.async("string");

    const hiddenRows=new Set();
    const regex1=/<row[^>]*\sr="(\d+)"[^>]*hidden="1"/g;
    const regex2=/<row[^>]*hidden="1"[^>]*\sr="(\d+)"/g;
    let m;
    while((m=regex1.exec(xml))!==null){ hiddenRows.add(parseInt(m[1])); }
    while((m=regex2.exec(xml))!==null){ hiddenRows.add(parseInt(m[1])); }

    let filtros={};
    let fechaFiltro=null;
    const autoFilterMatch=xml.match(/<autoFilter[\s\S]*?<\/autoFilter>/);
    if(autoFilterMatch){
      const autoXml=autoFilterMatch[0];
      const colRegex=/<filterColumn[^>]*colId="(\d+)"[^>]*>([\s\S]*?)<\/filterColumn>/g;
      while((m=colRegex.exec(autoXml))!==null){
        const colId=parseInt(m[1]);
        const inner=m[2];
        const vals=[];
        const valRegex=/<filter[^>]*val="([^"]+)"\s*\/>/g;
        let vm;
        while((vm=valRegex.exec(inner))!==null){ vals.push(vm[1]); }
        filtros[colId]=vals;
      }
      if(filtros[4] && filtros[4].length>0){ fechaFiltro=filtros[4][0]; }
    }
    return {hiddenRows, filtros, fechaFiltro};
  }catch(e){
    return null;
  }
}

document.getElementById("archivo").addEventListener("change", async (e)=>{
  const file=e.target.files[0]; if(!file) return;
  limpiarTabla();
  document.getElementById("listaFechas").innerHTML="";
  document.getElementById("listaTipos").innerHTML="";
  datos=[]; todasLasColumnasDetectadas=[]; fechaDetectadaPorFiltro=null; infoFiltro=null;

  try{
    const infoFiltros=await parsearFiltrosExcel(file);
    let hiddenRowsSet=new Set();
    let fechaDesdeXml=null;
    if(infoFiltros){
      hiddenRowsSet=infoFiltros.hiddenRows;
      fechaDesdeXml=infoFiltros.fechaFiltro;
      if(fechaDesdeXml){ fechaDetectadaPorFiltro=fechaDesdeXml; }
    }

    const dataArray=await file.arrayBuffer();
    const data=new Uint8Array(dataArray);
    const workbook=XLSX.read(data,{type:"array"});
    const sheet=workbook.Sheets[workbook.SheetNames[0]];

    const matriz=XLSX.utils.sheet_to_json(sheet,{header:1, defval:""});
    const headerIndex=encontrarFilaEncabezado(matriz);
    
    // Cambio: alert por Toast
    if(headerIndex===-1){ return showToast("No se encontró encabezado en el Excel", "error"); }

    const headerRow=matriz[headerIndex].map(h=>String(h).trim());
    todasLasColumnasDetectadas=headerRow.filter(h=>h!=="");

    const filasInfo=sheet['!rows']||[];
    const isFilaOculta=(excelRowNum)=>{
      if(hiddenRowsSet.has(excelRowNum)) return true;
      const info=filasInfo[excelRowNum-1];
      return info && info.hidden===true;
    };

    const filasDatos=matriz.slice(headerIndex+1);
    datos=filasDatos.map((fila,idx)=>{
      const excelRow=headerIndex+2+idx;
      if(!fila.some(c=>String(c).trim()!=="")) return null;
      const obj={_excelRow:excelRow, _visible:!isFilaOculta(excelRow)};
      headerRow.forEach((col,colIdx)=>{ if(!col) return; obj[col]=fila[colIdx]??""; });
      return obj;
    }).filter(Boolean);

    const mapa={}; headerRow.forEach(r=>{ if(r){ const n=normalizar(r); if(!mapa[n]) mapa[n]=r; } });
    datos=datos.map(row=>{ const nuevo={...row}; COLUMNAS_PREDETERMINADAS.forEach(col=>{ const n=normalizar(col); if(nuevo[col]===undefined && mapa[n]) nuevo[col]=row[mapa[n]]??""; }); return nuevo; });

    if(datos.length>0){
      const visibles=datos.filter(d=>d._visible);
      const totalVis=visibles.length;
      const totalOcu=datos.length-totalVis;

      if(!fechaDetectadaPorFiltro && totalVis>0 && totalVis < datos.length){
        const conteo={}; visibles.forEach(r=>{ const f=String(r["FePrefEnt."]||"").trim(); if(f) conteo[f]=(conteo[f]||0)+1; });
        let maxF=null,maxC=0; Object.entries(conteo).forEach(([f,c])=>{ if(c>maxC){maxC=c; maxF=f;}});
        if(maxF){ fechaDetectadaPorFiltro=maxF; }
      }

      if(fechaDesdeXml && !fechaDetectadaPorFiltro){ fechaDetectadaPorFiltro=fechaDesdeXml; }

      if(fechaDetectadaPorFiltro){
        infoFiltro={fecha:fechaDetectadaPorFiltro, visibles: totalVis>0?totalVis:datos.length, ocultas: totalOcu, total: datos.length};
      }

      if(!localStorage.getItem(STORAGE_KEY)){
        columnasVisibles=COLUMNAS_PREDETERMINADAS.filter(c=>todasLasColumnasDetectadas.some(td=>normalizar(td)===normalizar(c)) || datos[0].hasOwnProperty(c));
        if(columnasVisibles.length===0) columnasVisibles=[...todasLasColumnasDetectadas];
      } else { columnasVisibles=cargarColumnasVisibles(); }

      detectarFiltros();
      actualizarModalColumnas();
      
      // Cambio: Eliminamos los alerts molestos de "Archivo cargado" como solicitaste. Todo se carga en silencio.
    }
  }catch(err){
    showToast("Error al procesar archivo: " + err.message, "error");
  }
});

function cargarColumnasVisibles(){ try{ const g=localStorage.getItem(STORAGE_KEY); if(g){ const p=JSON.parse(g); if(Array.isArray(p)&&p.length) return p; } }catch{} return [...COLUMNAS_PREDETERMINADAS]; }
function guardarColumnasVisibles(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(columnasVisibles)); }
function limpiarTabla(){ document.getElementById("resultado").innerHTML=""; }

function detectarFiltros(){
  const todas=[...new Set(datos.map(r=>r["FePrefEnt."]).filter(Boolean))].sort();
  const lista=document.getElementById("listaFechas");
  let orden=todas;
  if(fechaDetectadaPorFiltro && todas.includes(fechaDetectadaPorFiltro)){ orden=[fechaDetectadaPorFiltro, ...todas.filter(f=>f!==fechaDetectadaPorFiltro)]; }
  lista.innerHTML=orden.map(f=>{ const es=f===fechaDetectadaPorFiltro; return `<label class="opcion ${es?'opcion-destacada':''}"><input type="radio" name="fecha" value="${f}" ${es?'checked':''}><span>${f} ${es?'✅ (filtro Excel)':''}</span></label>`; }).join('');
  if(infoFiltro){ const div=document.createElement('div'); div.className='info-filtro'; div.innerHTML=`📂 Excel filtrado: <strong>${infoFiltro.visibles}</strong> visibles de <strong>${infoFiltro.total}</strong>. Fecha: <strong>${fechaDetectadaPorFiltro}</strong>`; lista.prepend(div); }
  const tipos=new Set(); datos.forEach(r=>{ const t=String(r["Solicitante"]??"").split(" ").pop(); if(TIPOS_VALIDOS.includes(t)) tipos.add(t); });
  const listaTipos=document.getElementById("listaTipos");
  listaTipos.innerHTML=[...tipos].map(t=>`<label class="opcion"><input type="checkbox" name="tipo" value="${t}"><span>${t}</span></label>`).join('');
  document.getElementById("busquedaTienda").oninput=limpiarTabla;
  lista.onchange=limpiarTabla;
  listaTipos.onchange=limpiarTabla;
}

function setTienda(t){ document.getElementById("busquedaTienda").value=t; limpiarTabla(); }

function generarPedido(){
  const tienda=document.getElementById("busquedaTienda").value.trim();
  const fecha=document.querySelector('input[name="fecha"]:checked')?.value;
  const tipos=[...document.querySelectorAll('input[name="tipo"]:checked')].map(e=>e.value);
  const cont=document.getElementById("resultado");
  
  // Cambio: alert por Toast
  if(!tienda||!fecha||tipos.length===0) return showToast("Falta seleccionar tienda, fecha o tipo de producto", "warning");
  
  const filtrados=datos.filter(r=>String(r["Solicitante"]??"").includes(tienda) && String(r["FePrefEnt."])==String(fecha) && tipos.includes(String(r["Solicitante"]??"").split(" ").pop()));
  if(filtrados.length===0){ cont.innerHTML=`<div class="mensaje-vacio">⚠️ Sin pedido</div>`; }
  else{
    const nombreSolicitante = filtrados[0]?.["Solicitante"] || `Tienda ${tienda}`;
    const fechaTitulo = fecha || "";
    cont.innerHTML=`<div class="tabla-container" id="contenedorCaptura"><div class="titulo-solicitante"><span class="titulo-izq">${nombreSolicitante}</span><span class="titulo-der">${fechaTitulo}</span></div><table class="tabla-pedido"><thead><tr>${columnasVisibles.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${filtrados.map(f=>`<tr>${columnasVisibles.map(c=>`<td>${f[c]??""}</td>`).join('')}</tr>`).join('')}</tbody></table></div><button class="btn-whatsapp" onclick="compartirImagen('${tienda}')">📲 Compartir en WhatsApp</button>`;
  }
  setTimeout(()=>cont.scrollIntoView({behavior:'smooth',block:'start'}),100);
}

async function compartirImagen(nTienda){
  const btn=document.querySelector(".btn-whatsapp"); const orig=document.querySelector("#contenedorCaptura") || document.querySelector(".tabla-container") || document.querySelector(".tabla-pedido"); if(!orig) return;
  btn.innerText="⏳ Procesando..."; btn.disabled=true;
  const clon=orig.cloneNode(true); clon.style.width="auto"; clon.style.position="absolute"; clon.style.top="-9999px"; document.body.appendChild(clon);
  try{
    const canvas=await html2canvas(clon,{scale:2,useCORS:true,backgroundColor:"#ffffff"});
    canvas.toBlob(async(blob)=>{
      const file=new File([blob],"pedido.png",{type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],text:`*${nTienda}*`}); }
      else{ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`Pedido_${nTienda}.png`; a.click(); }
      btn.innerText="📲 Compartir en WhatsApp"; btn.disabled=false; document.body.removeChild(clon);
    });
  }catch(e){ 
      showToast("Error al generar la imagen", "error"); 
      btn.disabled=false; 
      try{document.body.removeChild(clon);}catch{} 
  }
}

const modal=document.getElementById("modalAjustes");
const btnAjustes=document.getElementById("btnAjustes");
const btnCerrar=document.getElementById("btnCerrarModal");
const btnGuardar=document.getElementById("btnGuardarAjustes");
btnAjustes.addEventListener("click",()=>{ if(todasLasColumnasDetectadas.length===0 && datos.length===0) todasLasColumnasDetectadas=[...new Set([...COLUMNAS_PREDETERMINADAS,...columnasVisibles])]; actualizarModalColumnas(); modal.style.display="flex"; });
function cerrarModal(){ modal.style.display="none"; }
btnCerrar.addEventListener("click",cerrarModal);
modal.addEventListener("click",(e)=>{ if(e.target===modal) cerrarModal(); });
btnGuardar.addEventListener("click",()=>{
  const checks=[...document.querySelectorAll('#listaColumnasAjustes input[type="checkbox"]')];
  const sel=checks.filter(c=>c.checked).map(c=>c.value);
  
  // Cambio: alert por Toast
  if(!sel.length){ return showToast("Debes seleccionar al menos 1 columna", "warning"); }
  
  columnasVisibles=sel; guardarColumnasVisibles(); cerrarModal();
  if(document.querySelector(".tabla-pedido")) generarPedido();
});
function seleccionarPredeterminadas(){
  const checks=[...document.querySelectorAll('#listaColumnasAjustes input[type="checkbox"]')];
  checks.forEach(ch=>{ ch.checked=COLUMNAS_PREDETERMINADAS.map(n=>normalizar(n)).includes(normalizar(ch.value)); });
}
function actualizarModalColumnas(){
  const cont=document.getElementById("listaColumnasAjustes");
  let fuente=todasLasColumnasDetectadas.length ? todasLasColumnasDetectadas : [...new Set([...COLUMNAS_PREDETERMINADAS,...columnasVisibles])];
  const predSet=new Set(COLUMNAS_PREDETERMINADAS.map(normalizar));
  const ordenadas=[...COLUMNAS_PREDETERMINADAS.filter(c=>fuente.some(f=>normalizar(f)===normalizar(c))), ...fuente.filter(f=>!predSet.has(normalizar(f))).sort((a,b)=>a.localeCompare(b))];
  const unicas=[]; const vistos=new Set();
  ordenadas.forEach(c=>{ const n=normalizar(c); if(!vistos.has(n)){ vistos.add(n); unicas.push(c); } });
  const visiblesNorm=new Set(columnasVisibles.map(normalizar));
  cont.innerHTML=unicas.map(col=>`<label class="opcion"><input type="checkbox" value="${col}" ${visiblesNorm.has(normalizar(col))?"checked":""}><span>${col}</span></label>`).join('');
}

