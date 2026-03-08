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

// --- Generación de Pedido (Vista Usuario) ---

function generarPedido() {
  const tienda = document.getElementById("busquedaTienda").value.trim();
  const fechaSel = document.querySelector('input[name="fecha"]:checked');
  const tiposSeleccionados = [
    ...document.querySelectorAll('input[name="tipo"]:checked'),
  ].map((e) => e.value);

  if (!tienda) { alert("Ingresa una tienda"); return; }
  if (!fechaSel) { alert("Selecciona una fecha"); return; }
  if (tiposSeleccionados.length === 0) { alert("Selecciona al menos un tipo de producto"); return; }

  const fecha = fechaSel.value;

  // Filtrado de datos
  const filasFiltradas = datos.filter((r) => {
    if (!r["Solicitante"] || !r["FePrefEnt."]) return false;
    const partes = r["Solicitante"].split(" ");
    const tipo = partes[partes.length - 1];

    return (
      r["Solicitante"].includes(tienda) &&
      r["FePrefEnt."] == fecha &&
      tiposSeleccionados.includes(tipo)
    );
  });

  const contenedorResultado = document.getElementById("resultado");

  if (filasFiltradas.length === 0) {
    contenedorResultado.innerHTML = '<div class="card">Sin resultados para la búsqueda.</div>';
    return;
  }

  // Renderizado de la tabla para el usuario
  let html = `
    <div class="tabla-wrapper" id="tablaParaUsuario">
      <table class="tabla-pedido">
        <thead>
          <tr>
            ${COLUMNAS_A_MOSTRAR.map(col => `<th>${col}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${filasFiltradas.map(fila => `
            <tr>
              ${COLUMNAS_A_MOSTRAR.map(col => `<td>${fila[col] ?? ""}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <button class="exportar" onclick="compartirImagen()">📲 Compartir imagen completa en WhatsApp</button>
  `;

  contenedorResultado.innerHTML = html;
}




async function compartirImagen() {
  const tabla = document.querySelector("#tablaParaUsuario table");
  if (!tabla) { alert("Primero genera un pedido."); return; }

  // 1. Extraer datos reales de la tabla
  const filas = Array.from(tabla.querySelectorAll("tbody tr"));
  const encabezados = Array.from(tabla.querySelectorAll("thead th")).map(th => th.innerText);
  
  const datos = filas.map(tr => 
    Array.from(tr.querySelectorAll("td")).map(td => td.innerText)
  );

  // 2. Configuración de dibujo (Ajusta estos valores si quieres celdas más anchas)
  const padding = 15;
  const altoFila = 45;
  const anchosColumnas = [120, 100, 250, 250, 150, 100]; // Ancho para cada columna
  const anchoTotal = anchosColumnas.reduce((a, b) => a + b, 0);
  const altoTotal = (datos.length + 1) * altoFila;

  // 3. Crear el Canvas físico
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Ajustar resolución para que se vea nítido (Retina/High DPI)
  const escala = 2;
  canvas.width = anchoTotal * escala;
  canvas.height = altoTotal * escala;
  ctx.scale(escala, escala);

  // Fondo blanco total
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, anchoTotal, altoTotal);

  // --- DIBUJAR ENCABEZADO ---
  ctx.fillStyle = "#26303a"; // EL COLOR DE CONFIRMACIÓN
  ctx.fillRect(0, 0, anchoTotal, altoFila);
  
  ctx.font = "bold 14px Arial";
  ctx.fillStyle = "white";
  ctx.textBaseline = "middle";

  let xActual = 0;
  encabezados.forEach((texto, i) => {
    ctx.fillText(texto, xActual + padding, altoFila / 2);
    xActual += anchosColumnas[i];
  });

  // --- DIBUJAR FILAS ---
  ctx.font = "14px Arial";
  
  datos.forEach((fila, numFila) => {
    const y = (numFila + 1) * altoFila;
    
    // Color de fondo cebra
    if (numFila % 2 !== 0) {
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(0, y, anchoTotal, altoFila);
    }

    // Línea divisoria inferior
    ctx.strokeStyle = "#eeeeee";
    ctx.beginPath();
    ctx.moveTo(0, y + altoFila);
    ctx.lineTo(anchoTotal, y + altoFila);
    ctx.stroke();

    ctx.fillStyle = "#333333";
    xActual = 0;
    fila.forEach((celda, i) => {
      // Truncar texto si es muy largo para la celda
      let textoCortado = celda;
      if (ctx.measureText(textoCortado).width > anchosColumnas[i] - padding * 2) {
        while (ctx.measureText(textoCortado + "...").width > anchosColumnas[i] - padding * 2) {
          textoCortado = textoCortado.slice(0, -1);
        }
        textoCortado += "...";
      }
      
      ctx.fillText(textoCortado, xActual + padding, y + (altoFila / 2));
      xActual += anchosColumnas[i];
    });
  });

  // 4. Convertir a imagen y compartir
  canvas.toBlob(async (blob) => {
    const file = new File([blob], "pedido_completo.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Pedido Completo",
        text: "Resumen de pedido generado exitosamente."
      });
    } else {
      const link = document.createElement("a");
      link.download = "pedido_completo.png";
      link.href = canvas.toDataURL();
      link.click();
    }
  }, "image/png");
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