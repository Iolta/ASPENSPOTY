const fs = require('fs');

const API_URL = 'https://nowplaying.raddios.com/api/nowplaying/aspen';
const MEMORIA_FILE = 'ultimo_tema.txt';

async function monitorearAspen() {
  try {
    // Consultamos la API real de Aspen
    const respuesta = await fetch(API_URL);
    const datos = await respuesta.json();
    
    const artista = datos.artist ? datos.artist.trim() : "";
    const titulo = datos.title ? datos.title.trim() : "";
    
    if (!artista || !titulo) {
      console.log("La radio no reporta canción en este momento (puede ser tanda).");
      return;
    }
    
    const cancionCompleta = `${artista} - ${titulo}`;
    
    if (cancionCompleta.toUpperCase().includes("ASPEN")) {
      console.log("Separador institucional o tanda: " + cancionCompleta);
      return;
    }
    
    // Leer la memoria del archivo local
    let ultimoTema = "";
    if (fs.existsSync(MEMORIA_FILE)) {
      ultimoTema = fs.readFileSync(MEMORIA_FILE, 'utf-8').trim();
    }
    
    if (cancionCompleta === ultimoTema) {
      console.log("Sigue sonando: " + cancionCompleta);
      return;
    }
    
    // Guardar el nuevo tema en el archivo de memoria
    fs.writeFileSync(MEMORIA_FILE, cancionCompleta);
    console.log(`¡¡NUEVO TEMA DETECTADO!!: ${cancionCompleta}`);
    
    // Próximo paso: Integrar API de Spotify aquí
    await agregarASpotify(titulo, artista);
    
  } catch (error) {
    console.error("Error al consultar la radio:", error.message);
  }
}

async function agregarASpotify(titulo, artista) {
  console.log(`Listo para enviar a Spotify: ${titulo} de ${artista}`);
}

monitorearAspen();
