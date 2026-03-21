/**
 * VARIABLES GLOBALES Y CONFIGURACIÓN
 */
let datos = [];
const TIPOS_VALIDOS = ["HVO", "PER", "COC"];
const COLUMNAS_A_MOSTRAR = [
  "FePrefEnt.",
  "Solic.",
  "Solicitante",
  "Material",
  "Número de material",
  "Ctd pedido UMV"
];

/**
 * Listener para detectar la carga del archivo Excel.
 */
document.getElementById("archivo").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) procesarArchivo(file);
});

/**
 * Lee el archivo Excel y convierte la primera hoja en un objeto JSON usable.
 * @param {File} file - El archivo seleccionado por el usuario.
 */
function procesarArchivo(file) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      datos = XLSX.utils.sheet_to_json(firstSheet);

      if (datos.length > 0) {
        detectarFechas();
        detectarTipos();
        alert(`Éxito: ${datos.length} filas cargadas.`);
      }
    } catch (e) {
      alert("Error al leer el Excel. Verifica el formato.");
    }
  };
  reader.readAsArrayBuffer(file);
}

/**
 * Extrae las fechas únicas de la columna 'FePrefEnt.' para llenar el filtro.
 */
function detectarFechas() {
  const fechas = [...new Set(datos.map(r => r["FePrefEnt."]).filter(Boolean))];
  const cont = document.getElementById("listaFechas");
  cont.innerHTML = fechas.map(f => `
    <label class="opcion">
      <input type="radio" name="fecha" value="${f}"> <span>${f}</span>
    </label>
  `).join('');
}

/**
 * Extrae los tipos de producto (HVO, PER, COC) del final del nombre del Solicitante.
 */
function detectarTipos() {
  const tiposPresentes = new Set();
  datos.forEach(r => {
    if (!r["Solicitante"]) return;
    const partes = r["Solicitante"].split(" ");
    const t = partes[partes.length - 1];
    if (TIPOS_VALIDOS.includes(t)) tiposPresentes.add(t);
  });

  const cont = document.getElementById("listaTipos");
  cont.innerHTML = [...tiposPresentes].map(t => `
    <label class="opcion">
      <input type="checkbox" name="tipo" value="${t}" checked> <span>${t}</span>
    </label>
  `).join('');
}

/**
 * Asigna rápidamente un número de tienda al campo de búsqueda.
 */
function setTienda(t) {
  document.getElementById("busquedaTienda").value = t;
}

/**
 * Filtra los datos y activa la vista de pantalla completa para captura.
 */
function generarPedido() {
  const tienda = document.getElementById("busquedaTienda").value.trim();
  const fechaSel = document.querySelector('input[name="fecha"]:checked');
  const tiposSel = [...document.querySelectorAll('input[name="tipo"]:checked')].map(e => e.value);

  if (!tienda || !fechaSel || tiposSel.length === 0) {
    alert("Por favor completa los filtros.");
    return;
  }

  const filtrados = datos.filter(r => {
    if (!r["Solicitante"] || !r["FePrefEnt."]) return false;
    const tipo = r["Solicitante"].split(" ").pop();
    return r["Solicitante"].includes(tienda) && 
           r["FePrefEnt."] == fechaSel.value && 
           tiposSel.includes(tipo);
  });

  if (filtrados.length === 0) return alert("No hay datos para esa selección.");
  
  mostrarVistaCaptura(filtrados, tienda);
}

/**
 * Crea y muestra la "actividad" de pantalla completa con la tabla final.
 * @param {Array} filas - Datos ya filtrados.
 * @param {String} nTienda - Número de tienda para el mensaje de WhatsApp.
 */
function mostrarVistaCaptura(filas, nTienda) {
  const vista = document.getElementById("vista-captura");
  document.querySelector(".app").style.display = "none";
  vista.style.display = "block";

  vista.innerHTML = `
    <div class="toolbar-captura">
      <button class="btn-regresar" onclick="regresar()">⬅️ Filtros</button>
      <button class="btn-whatsapp" id="btnShare">📸 ENVIAR A WHATSAPP</button>
    </div>
    <div class="contenedor-render">
      <div id="target-foto" style="background: white; padding: 20px;">
        <table class="tabla-final">
          <thead>
            <tr>${COLUMNAS_A_MOSTRAR.map(c => `<th>${c}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${filas.map(f => `<tr>${COLUMNAS_A_MOSTRAR.map(col => `<td>${f[col] ?? ""}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("btnShare").onclick = () => procesarCaptura(nTienda);
}

/**
 * Genera la imagen con html2canvas y dispara el menú de compartir.
 * @param {String} nTienda - El número de tienda en formato negritas.
 */
async function procesarCaptura(nTienda) {
  const btn = document.getElementById("btnShare");
  btn.innerText = "⏳ Generando...";
  btn.disabled = true;

  const target = document.getElementById("target-foto");
  try {
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      width: target.scrollWidth,
      height: target.scrollHeight
    });

    canvas.toBlob(async (blob) => {
      const file = new File([blob], "pedido.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: `*${nTienda}*` // <-- AQUÍ SE ENVÍA LA TIENDA EN NEGRITAS
        });
      } else {
        const link = document.createElement("a");
        link.download = `Pedido_${nTienda}.png`;
        link.href = URL.createObjectURL(blob);
        link.click();
      }
      btn.innerText = "📸 ENVIAR A WHATSAPP";
      btn.disabled = false;
    });
  } catch (e) {
    alert("Error al crear imagen.");
    btn.disabled = false;
  }
}

/**
 * Cierra la vista de captura y regresa a los filtros principales.
 */
function regresar() {
  document.querySelector(".app").style.display = "block";
  document.getElementById("vista-captura").style.display = "none";
}

/**
 * SERVICE WORKER REGISTRATION (PWA)
 */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(console.error);
}













/*
// script.js
let datos = [];
const TIPOS_VALIDOS = ["HVO", "PER", "COC"];

// Columnas que queremos mostrar y capturar
const COLUMNAS_A_MOSTRAR = [
  "FePrefEnt.",
  "Solic.",
  "Solicitante",
  "Material",
  "Número de material",
  "Ctd pedido UMV"
];

// --- Inicialización y Carga de Archivo ---

document.getElementById("archivo").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  procesarArchivo(file);
});

function procesarArchivo(file) {
  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      datos = XLSX.utils.sheet_to_json(sheet);

      if (datos.length === 0) {
        alert("El archivo está vacío o no tiene el formato correcto.");
        return;
      }

      detectarFechas();
      detectarTipos();
      alert(`Archivo cargado correctamente. ${datos.length} filas detectadas.`);
    } catch (error) {
      console.error("Error al procesar el Excel:", error);
      alert("Error al leer el archivo Excel. Asegúrate de que es un archivo válido.");
    }
  };
  reader.readAsArrayBuffer(file);
}

// --- Filtros e Interfaz ---

function detectarFechas() {
  const fechas = new Set();
  datos.forEach((r) => {
    if (r["FePrefEnt."]) fechas.add(r["FePrefEnt."]);
  });

  const cont = document.getElementById("listaFechas");
  cont.innerHTML = "";

  if (fechas.size === 0) {
    cont.innerHTML = "<p>No hay fechas disponibles.</p>";
    return;
  }

  fechas.forEach((f) => {
    cont.innerHTML += `
      <label class="opcion">
        <input type="radio" name="fecha" value="${f}">
        <span>${f}</span>
      </label>
    `;
  });
}

function detectarTipos() {
  const tipos = new Set();
  datos.forEach((r) => {
    if (!r["Solicitante"]) return;
    const partes = r["Solicitante"].split(" ");
    const tipo = partes[partes.length - 1];
    if (TIPOS_VALIDOS.includes(tipo)) {
      tipos.add(tipo);
    }
  });

  const cont = document.getElementById("listaTipos");
  cont.innerHTML = "";

  tipos.forEach((t) => {
    cont.innerHTML += `
      <label class="opcion">
        <input type="checkbox" name="tipo" value="${t}" checked>
        <span>${t}</span>
      </label>
    `;
  });
}

function setTienda(t) {
  document.getElementById("busquedaTienda").value = t;
}




// ************************************************ 
// --- Generación de Pedido (Vista Usuario) ---
// Reemplaza estas funciones en tu script.js

function generarPedido() {
  const tienda = document.getElementById("busquedaTienda").value.trim();
  const fechaSel = document.querySelector('input[name="fecha"]:checked');
  const tiposSeleccionados = Array.from(document.querySelectorAll('input[name="tipo"]:checked')).map(e => e.value);

  if (!tienda || !fechaSel || tiposSeleccionados.length === 0) {
    alert("Completa todos los filtros antes de continuar.");
    return;
  }

  const filasFiltradas = datos.filter((r) => {
    if (!r["Solicitante"] || !r["FePrefEnt."]) return false;
    const partes = r["Solicitante"].split(" ");
    const tipo = partes[partes.length - 1];
    return r["Solicitante"].includes(tienda) && r["FePrefEnt."] == fechaSel.value && tiposSeleccionados.includes(tipo);
  });

  if (filasFiltradas.length === 0) {
    alert("Sin resultados.");
    return;
  }

  mostrarPantallaCompleta(filasFiltradas);
}

function mostrarPantallaCompleta(filas) {
  const appPrincipal = document.querySelector(".app");
  const vistaCaptura = document.getElementById("vista-captura");

  // Ocultamos la interfaz principal (Simulamos cambio de pestaña/activity)
  appPrincipal.style.display = "none";
  vistaCaptura.style.display = "block";

  const cuerpoTabla = filas.map(fila => `
    <tr>
      ${COLUMNAS_A_MOSTRAR.map(col => `<td>${fila[col] ?? ""}</td>`).join('')}
    </tr>
  `).join('');

  vistaCaptura.innerHTML = `
    <div class="toolbar-captura">
      <button class="btn-regresar" onclick="regresarPrincipal()">⬅️ Volver a Filtros</button>
      <button class="btn-whatsapp" id="btnCompartir">📸 COMPARTIR EN WHATSAPP</button>
    </div>
    
    <div class="contenedor-render">
      <div id="target-foto">
        <table class="tabla-final">
          <thead>
            <tr>${COLUMNAS_A_MOSTRAR.map(c => `<th>${c}</th>`).join('')}</tr>
          </thead>
          <tbody>${cuerpoTabla}</tbody>
        </table>
      </div>
    </div>
  `;

  // Lógica del botón de captura
  document.getElementById('btnCompartir').onclick = async function() {
    this.innerText = "⏳ Procesando...";
    this.disabled = true;

    const target = document.getElementById('target-foto');
    
    try {
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: target.scrollWidth,
        height: target.scrollHeight
      });

      canvas.toBlob(async (blob) => {
        const file = new File([blob], "pedido.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Pedido",
            text: "Resumen de pedido"
          });
        } else {
          descargarCanvas(canvas);
        }
        this.innerText = "📸 COMPARTIR EN WHATSAPP";
        this.disabled = false;
      }, 'image/png');
    } catch (e) {
      alert("Error en captura");
      this.disabled = false;
    }
  };
}

function regresarPrincipal() {
  document.querySelector(".app").style.display = "block";
  document.getElementById("vista-captura").style.display = "none";
  document.getElementById("vista-captura").innerHTML = "";
}




// ************************************************ 



async function compartirImagen() {
  const tablaOriginal = document.querySelector("#tablaParaUsuario table");
  if (!tablaOriginal) { alert("Primero genera un pedido."); return; }

  const filasHtml = tablaOriginal.querySelector("tbody").innerHTML;
  
  // 1. Abrir la nueva pestaña
  const nuevaVentana = window.open("", "_blank");
  if (!nuevaVentana) {
    alert("Por favor, permite las ventanas emergentes para exportar la imagen.");
    return;
  }

  // 2. Escribir el contenido en la nueva pestaña
  // Usamos el color #26303a para confirmar que es la versión nueva
  nuevaVentana.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Capturando Pedido...</title>
      <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f0f2f5; display: flex; flex-direction: column; align-items: center; }
        .instrucciones { background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; max-width: 600px; border: 1px solid #ffeeba; }
        #captura-area { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: fit-content; }
        table { border-collapse: collapse; min-width: 800px; }
        th { background: #26303a; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #eee; white-space: nowrap; }
        tr:nth-child(even) { background: #f8f9fa; }
        .btn-ready { background: #25d366; color: white; border: none; padding: 15px 30px; font-size: 18px; border-radius: 50px; font-weight: bold; cursor: pointer; margin-top: 20px; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3); }
      </style>
    </head>
    <body>
      <div class="instrucciones">
        <b>Paso final:</b> Verifica que la tabla se vea completa y presiona el botón verde para enviar a WhatsApp.
      </div>

      <div id="captura-area">
        <table>
          <thead>
            <tr>
              <th>FePrefEnt.</th><th>Solic.</th><th>Solicitante</th>
              <th>Material</th><th>Número de material</th><th>Ctd pedido UMV</th>
            </tr>
          </thead>
          <tbody>${filasHtml}</tbody>
        </table>
      </div>

      <button id="btnCaptura" class="btn-ready">📸 ENVIAR A WHATSAPP</button>

      <script>
        document.getElementById('btnCaptura').onclick = async function() {
          this.innerText = "Procesando...";
          this.disabled = true;
          
          const area = document.getElementById('captura-area');
          const canvas = await html2canvas(area, {
            scale: 2,
            useCORS: true,
            logging: false,
            width: area.scrollWidth,
            height: area.scrollHeight
          });

          canvas.toBlob(async (blob) => {
            const file = new File([blob], "pedido.png", { type: "image/png" });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'Pedido',
                text: 'Resumen de pedido'
              });
              window.close(); // Cierra la pestaña tras compartir
            } else {
              // Fallback descarga
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = "pedido.png";
              link.click();
              alert("Imagen descargada. Ahora puedes adjuntarla en WhatsApp.");
            }
          }, 'image/png');
        };
      </script>
    </body>
    </html>
  `);
  nuevaVentana.document.close();
}






// Función auxiliar para descargar la imagen si navigator.share falla
function descargarCanvas(canvas) {
  const link = document.createElement("a");
  link.download = "pedido-completo.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// --- PWA y Carga desde Compartir (Sin cambios significativos) ---

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => console.log("Service Worker registrado"))
      .catch((err) => console.log("Error registrando SW", err));
  });
}

// Funciones para manejar archivos compartidos (launchQueue, etc.) se mantienen igual...
async function cargarArchivoCompartido() {
  const cache = await caches.open("shared-file");
  const response = await cache.match("ultimo-archivo");
  if (!response) return;
  const blob = await response.blob();
  procesarArchivo(blob);
}
window.addEventListener("load", cargarArchivoCompartido);

if ("launchQueue" in window) {
  launchQueue.setConsumer(async (launchParams) => {
    if (!launchParams.files.length) return;
    const fileHandle = launchParams.files[0];
    const file = await fileHandle.getFile();
    procesarArchivo(file);
  });
}
*/