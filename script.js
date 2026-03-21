/**
 * CONFIGURACIÓN GLOBAL
 */
let datos = [];
const TIPOS_VALIDOS = ["HVO", "PER", "COC"];
const COLUMNAS = ["FePrefEnt.", "Solic.", "Solicitante", "Material", "Número de material", "Ctd pedido UMV"];

/**
 * Carga y procesa el archivo Excel
 */
document.getElementById("archivo").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        datos = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        // Llenar filtros automáticamente
        detectarFiltros();
        alert("Archivo cargado correctamente.");
    };
    reader.readAsArrayBuffer(file);
});

/**
 * Analiza los datos para mostrar fechas y tipos disponibles
 */
function detectarFiltros() {
    const fechas = [...new Set(datos.map(r => r["FePrefEnt."]).filter(Boolean))];
    document.getElementById("listaFechas").innerHTML = fechas.map(f => `
        <label class="opcion"><input type="radio" name="fecha" value="${f}"> <span>${f}</span></label>
    `).join('');

    const tipos = new Set();
    datos.forEach(r => {
        const t = r["Solicitante"]?.split(" ").pop();
        if (TIPOS_VALIDOS.includes(t)) tipos.add(t);
    });
    document.getElementById("listaTipos").innerHTML = [...tipos].map(t => `
        <label class="opcion"><input type="checkbox" name="tipo" value="${t}" checked> <span>${t}</span></label>
    `).join('');
}

function setTienda(t) { document.getElementById("busquedaTienda").value = t; }

/**
 * Renderiza la tabla en la parte inferior de la misma página
 */
function generarPedido() {
    const tienda = document.getElementById("busquedaTienda").value.trim();
    const fecha = document.querySelector('input[name="fecha"]:checked')?.value;
    const tipos = [...document.querySelectorAll('input[name="tipo"]:checked')].map(e => e.value);

    if (!tienda || !fecha || tipos.length === 0) return alert("Faltan datos.");

    const filtrados = datos.filter(r => 
        r["Solicitante"]?.includes(tienda) && 
        r["FePrefEnt."] == fecha && 
        tipos.includes(r["Solicitante"]?.split(" ").pop())
    );

    if (filtrados.length === 0) return alert("Sin resultados.");

    // Dibujar la tabla en el div de resultados
    document.getElementById("resultado").innerHTML = `
        <div class="tabla-container" id="area-visible">
            <table class="tabla-pedido">
                <thead><tr>${COLUMNAS.map(c => `<th>${c}</th>`).join('')}</tr></thead>
                <tbody>
                    ${filtrados.map(f => `<tr>${COLUMNAS.map(c => `<td>${f[c] ?? ""}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
        </div>
        <button class="btn-whatsapp" onclick="compartirImagen('${tienda}')">📲 Compartir en WhatsApp</button>
    `;
}

/**
 * Crea una captura de la tabla y la comparte
 */
async function compartirImagen(nTienda) {
    const btn = document.querySelector(".btn-whatsapp");
    const original = document.querySelector(".tabla-pedido");
    btn.innerText = "⏳ Procesando...";

    // TRUCO: Creamos un clon invisible que no tenga límites de ancho para la foto
    const clon = original.cloneNode(true);
    clon.style.width = "auto";
    clon.style.position = "absolute";
    clon.style.top = "-9999px";
    clon.style.left = "-9999px";
    document.body.appendChild(clon);

    try {
        const canvas = await html2canvas(clon, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff"
        });

        canvas.toBlob(async (blob) => {
            const file = new File([blob], "pedido.png", { type: "image/png" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    text: `*${nTienda}*`
                });
            } else {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `Pedido_${nTienda}.png`;
                a.click();
            }
            btn.innerText = "📲 Compartir en WhatsApp";
            document.body.removeChild(clon);
        });
    } catch (e) {
        alert("Error al generar imagen");
        btn.innerText = "📲 Compartir en WhatsApp";
    }
}