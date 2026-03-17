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