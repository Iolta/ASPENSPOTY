const fs = require('fs');

const API_URL = 'https://np.tritondigital.com/public/nowplaying?mountName=ASPEN&numberToFetch=1';
const MEMORIA_FILE = 'ultimo_tema.txt';

// Tu puente de Pipedream
const PIPEDREAM_WEBHOOK_URL = 'https://eowzj4kcru43bqq.m.pipedream.net';

async function monitorearAspen() {
  try {
    const respuesta = await fetch(API_URL);
    if (!respuesta.ok) throw new Error(`HTTP Error: ${respuesta.status}`);
    const textoXML = await respuesta.text();
    
    const artistaMatch = textoXML.match(/<property name="track_artist_name"><!\[CDATA\[(.*?)]]><\/property>/);
    const tituloMatch = textoXML.match(/<property name="cue_title"><!\[CDATA\[(.*?)]]><\/property>/);
    
    const artista = artistaMatch ? artistaMatch[1].trim() : "";
    const titulo = tituloMatch ? tituloMatch[1].trim() : "";
    
    if (!artista || !titulo) {
      console.log("No hay canción reportada en Triton en este momento.");
      return;
    }
    
    const cancionCompleta = `${artista} - ${titulo}`;
    if (cancionCompleta.toUpperCase().includes("ASPEN")) {
      console.log("Separador ignorado: " + cancionCompleta);
      return;
    }
    
    let ultimoTema = "";
    if (fs.existsSync(MEMORIA_FILE)) {
      ultimoTema = fs.readFileSync(MEMORIA_FILE, 'utf-8').trim();
    }
    
    // Forzamos el envío en esta prueba quitando momentáneamente la traba de duplicados
    console.log(`¡¡TEMA DETECTADO!!: ${cancionCompleta}`);
    
    // Enviamos el json estructurado al puente
    const resPipedream = await fetch(PIPEDREAM_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artista, titulo })
    });
    
    if (resPipedream.ok) {
      fs.writeFileSync(MEMORIA_FILE, cancionCompleta);
      console.log("Enviado al puente de Pipedream con éxito.");
    } else {
      console.error(`Error en el puente: ${resPipedream.status}`);
    }

  } catch (error) {
    console.error("Error en ejecución:", error.message);
  }
}

monitorearAspen();
