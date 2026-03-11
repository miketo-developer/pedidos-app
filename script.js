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
  const tablaOriginal = document.querySelector("#tablaParaUsuario table");
  if (!tablaOriginal) { alert("Genera un pedido primero"); return; }

  // 1. Extraer los datos actuales
  const filasHtml = tablaOriginal.querySelector("tbody").innerHTML;
  const columnas = [
    "FePrefEnt.", "Solic.", "Solicitante", 
    "Material", "Número de material", "Ctd pedido UMV"
  ];

  // 2. Crear el contenido de la "página de captura"
  // Usamos estilos que fuerzan a la tabla a NO tener scroll y ser gigante
  const htmlCaptura = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
      <style>
        body { margin: 0; padding: 20px; background: white; width: fit-content; }
        table { 
          border-collapse: collapse; 
          width: 1200px; /* Forzamos un ancho grande para que no haya saltos de línea */
          font-family: Arial, sans-serif;
          border: 4px solid #26303a; /* Borde para confirmar que es esta versión */
        }
        th { background: #26303a; color: white; padding: 15px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #eee; white-space: nowrap; }
        tr:nth-child(even) { background: #f9f9f9; }
      </style>
    </head>
    <body>
      <div id="captura-target">
        <table>
          <thead>
            <tr>${columnas.map(c => `<th>${c}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
        </table>
      </div>
      <script>
        window.onload = async () => {
          // Pequeña pausa para asegurar renderizado
          await new Promise(r => setTimeout(r, 500));
          const element = document.getElementById('captura-target');
          
          html2canvas(element, {
            scale: 2,
            useCORS: true,
            width: element.offsetWidth,
            height: element.offsetHeight
          }).then(canvas => {
            canvas.toBlob(blob => {
              window.parent.postMessage({ type: 'CAPTURA_LISTA', blob: blob }, '*');
            }, 'image/png');
          });
        };
      </script>
    </body>
    </html>
  `;

  // 3. Crear un iframe temporal pero VISIBLE (al fondo de la página)
  // Lo ponemos visible pero muy abajo para que el navegador lo renderice completo
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.bottom = '-10000px'; 
  iframe.style.width = '1300px'; // Más ancho que la tabla
  iframe.style.height = '5000px'; // Suficiente para cualquier pedido
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(htmlCaptura);
  doc.close();

  // 4. Escuchar la respuesta del iframe
  window.addEventListener('message', async function handler(event) {
    if (event.data.type === 'CAPTURA_LISTA') {
      window.removeEventListener('message', handler);
      const blob = event.data.blob;
      const file = new File([blob], "pedido_completo.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Pedido Completo",
          text: "Enviando pedido desde PWA"
        });
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "pedido.png";
        link.click();
      }
      document.body.removeChild(iframe);
    }
  });
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